import ast
import json
from pathlib import Path
import re
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import lesson_store
from preparation_workflow import SECTIONS, publish, review_section


class PreparationWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.state = {"index": 0, "approved": [], "edits": {}, "published": False}

    def test_reject_keeps_workflow_on_current_section(self):
        state, _message, _explanation, _board, complete = review_section(
            self.state, SECTIONS[0]["explanation"], SECTIONS[0]["board"], False
        )
        self.assertEqual(state["index"], 0)
        self.assertEqual(state["approved"], [])
        self.assertFalse(complete)

    def test_approval_saves_edits_before_advancing(self):
        edited = "شرح راجعه المدرب."
        state, _message, next_explanation, _board, complete = review_section(
            self.state, edited, SECTIONS[0]["board"], True
        )
        self.assertEqual(state["edits"]["0"]["explanation"], edited)
        self.assertEqual(state["approved"], [0])
        self.assertEqual(state["index"], 1)
        self.assertEqual(next_explanation, SECTIONS[1]["explanation"])
        self.assertFalse(complete)

    def test_invalid_board_does_not_advance(self):
        state, message, _explanation, _board, _complete = review_section(
            self.state, "شرح", '[{"op":"made_up"}]', True
        )
        self.assertEqual(state["index"], 0)
        self.assertIn("لم يُعتمد", message)

    def test_publish_requires_every_section_approved(self):
        state, message = publish(self.state)
        self.assertFalse(state["published"])
        self.assertIn("لا يمكن النشر", message)

    def test_browser_state_can_resume_at_current_section(self):
        state, *_ = review_section(self.state, SECTIONS[0]["explanation"], SECTIONS[0]["board"], True)
        # BrowserState serializes this JSON-compatible object between visits.
        resumed = {"index": state["index"], "approved": state["approved"], "edits": state["edits"]}
        self.assertEqual(resumed["index"], 1)
        self.assertEqual(resumed["approved"], [0])

    def test_publish_after_all_approvals(self):
        state = self.state
        for section in SECTIONS:
            state, *_ = review_section(state, section["explanation"], section["board"], True)
        state, message = publish(state)
        self.assertTrue(state["published"])
        self.assertIn("نُشرت", message)


class SavedBoardGenerationTests(unittest.TestCase):
    def setUp(self):
        # Load only the generator: importing app starts Gradio and opens the live store.
        path = Path(__file__).with_name("app.py")
        tree = ast.parse(path.read_text(encoding="utf-8"))
        node = next(node for node in tree.body
                    if isinstance(node, ast.FunctionDef) and node.name == "_generate_lesson_board")
        self.chat = Mock(return_value='{"board":[]}')
        namespace = {"ENGINE": SimpleNamespace(openai_chat=self.chat), "json": json, "re": re,
                     "lesson_store": lesson_store, "WorkflowError": lesson_store.WorkflowError}
        exec(compile(ast.Module(body=[node], type_ignores=[]), str(path), "exec"), namespace)
        self.generate = namespace["_generate_lesson_board"]
        database = patch.object(lesson_store, "_connect", side_effect=AssertionError("Live store used"))
        database.start()
        self.addCleanup(database.stop)

    def test_fallback_stays_below_title_and_connects_card_edges(self):
        self.chat.side_effect = ["not JSON", '{"board":[]}']
        explanation = "نقرأ الدرجات الثلاث. نجمع الدرجات معًا. نقسم المجموع على ثلاثة. نعرض المتوسط النهائي."
        ops = json.loads(self.generate("حساب المتوسط", explanation))
        self.assertEqual(self.chat.call_count, 2)
        self.assertEqual([op["op"] for op in ops[:2]], ["clear", "title"])
        boxes = [op for op in ops if op["op"] == "box"]
        arrows = [op for op in ops if op["op"] == "arrow"]
        self.assertEqual(len(boxes), 4)
        self.assertEqual(len(arrows), len(boxes) - 1)
        for box in boxes:
            x, y = box["at"]
            self.assertGreaterEqual(y, 18)
            self.assertGreaterEqual(x, 0)
            self.assertLessEqual(x + box["w"], 100)
            self.assertLessEqual(y + box["h"], 75)
        for arrow, before, after in zip(arrows, boxes, boxes[1:]):
            self.assertEqual(arrow["from"], [before["at"][0] + before["w"] / 2,
                                           before["at"][1] + before["h"]])
            self.assertEqual(arrow["to"], [after["at"][0] + after["w"] / 2, after["at"][1]])
        self.assertEqual(lesson_store.validate_board(json.dumps(ops)), ops)

    def test_fallback_deduplicates_short_whole_word_phrases(self):
        first = "تستقبل الخوارزمية الدرجات الثلاث المسجلة"
        second = "نحسب المتوسط الحسابي للدرجات المدخلة"
        explanation = f"{first}. {second}. {first}."
        title = "خطوات حساب المتوسط الحسابي للدرجات الثلاث المدخلة في البرنامج"
        ops = json.loads(self.generate(title, explanation))
        self.assertEqual(ops[1]["text"], " ".join(title.split()[:5]))
        labels = [op["label"] for op in ops if op["op"] == "box"]
        self.assertEqual(len(labels), 2)
        self.assertEqual(len(set(labels)), len(labels))
        for label, source in zip(labels, [first, second]):
            self.assertLessEqual(len(label), 34)
            self.assertLessEqual(len(label.split()), 4)
            self.assertEqual(label.split(), source.split()[:len(label.split())])

    def test_fallback_keeps_short_arabic_clauses_and_decimal_values(self):
        explanation = "المتوسط 66.7، الحد 60؛ النتيجة ناجح."
        ops = json.loads(self.generate("نتيجة المثال", explanation))
        self.assertEqual([op["label"] for op in ops if op["op"] == "box"], [
            "المتوسط 66.7", "الحد 60", "النتيجة ناجح",
        ])

    def test_single_sentence_is_not_duplicated_as_a_summary_card(self):
        ops = json.loads(self.generate("المدخلات", "نقرأ الدرجات الثلاث من المستخدم."))
        self.assertEqual([op["label"] for op in ops if op["op"] == "box"], ["نقرأ الدرجات الثلاث من"])
        self.assertFalse(any(op["op"] == "arrow" for op in ops))

    def test_valid_model_board_is_preserved_and_prompt_keeps_real_narration(self):
        expected = [
            {"op": "clear"}, {"op": "title", "text": "حساب المتوسط"},
            {"op": "box", "at": [30, 20], "w": 40, "h": 10, "label": "المجموع 200"},
            {"op": "box", "at": [30, 40], "w": 40, "h": 10, "label": "المتوسط 66.7"},
        ]
        self.chat.return_value = json.dumps({"board": expected})
        explanation = "الحين نقسم المجموع مئتين على ثلاثة، ويطلع المتوسط تقريبًا ستة وستين فاصلة سبعة."
        self.assertEqual(json.loads(self.generate("حساب المتوسط", explanation)), expected)
        self.chat.assert_called_once()
        prompt = self.chat.call_args.args[0][1]["content"]
        self.assertIn("نص الشرح: " + explanation, prompt)
        self.assertIn("العربية الفصحى", prompt)
        self.assertIn("y<18", prompt)


if __name__ == "__main__":
    unittest.main()
