import json
import os
import threading
import unittest
from unittest.mock import patch

import engine
from board_quality import _note_lines, improve_step_board


def lesson_json():
    return json.dumps({"steps": [
        {"say": "نبدأ بالسؤال الذي أرسله الهاتف.", "board": [{"op": "title", "text": "طلب الشبكة"}]},
        {"say": "ثم يمر الطلب عبر الموجّه.", "board": [{"op": "text", "text": "الموجّه", "at": [30, 35]}]},
        {"say": "يصل الطلب إلى الخادم.", "board": [{"op": "text", "text": "الخادم", "at": [60, 35]}]},
        {"say": "يرد الخادم ببيانات الصفحة.", "board": [{"op": "arrow", "from": [62, 40], "to": [45, 40]}]},
    ]})


class EngineTurnTests(unittest.TestCase):
    """The whole-JSON generation path (also the fallback when streaming fails)."""

    def setUp(self):
        env = patch.dict(os.environ, {"TUTORI_STREAM_LESSON": "0"})
        env.start()
        self.addCleanup(env.stop)

    def run_mocked_turn(self, history):
        with patch.object(engine, "openai_chat", return_value=lesson_json()) as generate, \
             patch.object(engine, "coach_update", return_value=({}, [])):
            events = list(engine.run_turn(
                None, "ما وظيفة الموجّه؟" if history else "كيف ينتقل طلب ويب؟",
                "", history, {}, "", [], 3, 3, False, False,
            ))
        return events, generate

    def test_one_generation_produces_one_lesson_instead_of_quick_plus_deep(self):
        events, generate = self.run_mocked_turn([])
        generate.assert_called_once()
        steps = [event for event in events if event["type"] == "step"]
        self.assertEqual(len(steps), 4)
        self.assertIn("شرحًا مترابطًا مدته 3 دقائق", next(
            event["detail"] for event in events if event["type"] == "status"
            and "مترابط" in event.get("detail", "")
        ))

    def test_follow_up_is_a_short_answer_with_conversation_context(self):
        history = [
            {"role": "user", "content": "كيف ينتقل طلب ويب؟"},
            {"role": "assistant", "content": "شرحنا مرور الطلب عبر الموجّه."},
        ]
        events, generate = self.run_mocked_turn(history)
        args, kwargs = generate.call_args
        prompt_text = "\n".join(message["content"] for message in args[0])
        self.assertIn("شرحنا مرور الطلب عبر الموجّه", prompt_text)
        self.assertIn("about 1 minute", args[0][0]["content"])
        self.assertEqual(len([event for event in events if event["type"] == "step"]), 4)

    def test_arabic_content_is_not_replaced_by_english_templates(self):
        english_board = [{"op": "box", "at": [30, 24], "w": 20, "h": 10, "label": "21"}]
        cases = [
            ("اشرح binary search", "Compare the middle value.", english_board),
            ("Explain recursion", "نبدأ بالحالة الأساسية.", english_board),
            ("Explain gradient descent", "Follow the slope.",
             [{"op": "title", "text": "تقليل الخطأ"}]),
            ("Explain neural networks", "Compare the prediction.",
             [{"op": "notes", "lines": ["نحسب الخطأ"], "at": [66, 30]}]),
        ]
        with patch("board_quality._template", side_effect=AssertionError("English template used")):
            for question, say, board in cases:
                with self.subTest(question=question):
                    self.assertEqual(improve_step_board(question, 1, say, board), board)

    def test_arabic_empty_board_keeps_words_diacritics_and_values(self):
        board = improve_step_board(
            "اشرح binary search", 2,
            "المُتوسّط = 66.7؛ نختار النصف الأيمن، نكرر البحث.", [],
        )
        self.assertEqual(len(board), 1)
        self.assertEqual(board[0]["title"], "فكرة أساسية")
        self.assertEqual(board[0]["lines"], [
            "المُتوسّط = 66.7", "نختار النصف الأيمن", "نكرر البحث",
        ])

    def test_note_lines_keep_equations_and_whole_words(self):
        self.assertEqual(_note_lines("So x = 3.5; cached results save time."), [
            "x = 3.5", "cached results save time",
        ])
        lines = _note_lines("نستخدم الخوارزمية للبحث في البيانات المرتبة.")
        self.assertTrue(lines)
        self.assertTrue(all(len(line) <= 26 for line in lines))
        self.assertEqual(lines[0], "نستخدم الخوارزمية للبحث في")

    def test_mocked_arabic_technical_lesson_preserves_narration_and_labels(self):
        raw_steps = [
            {"say": "نبحث عن العدد واحد وعشرين في قائمة مرتبة.", "board": [
                {"op": "clear"}, {"op": "title", "text": "البحث الثنائي"},
                {"op": "box", "at": [64, 24], "w": 22, "h": 10, "label": "الوسط 13"},
            ]},
            {"say": "العدد المطلوب أكبر من العدد الأوسط.", "board": [
                {"op": "box", "at": [30, 24], "w": 22, "h": 10, "label": "الهدف 21"},
            ]},
            {"say": "نختار النصف الأيمن، نكرر البحث.", "board": []},
        ]
        with patch.object(engine, "openai_chat", return_value=json.dumps({"steps": raw_steps})), \
             patch.object(engine, "coach_update", return_value=({}, [])), \
             patch("requests.sessions.Session.request", side_effect=AssertionError("Network used")):
            events = list(engine.run_turn(
                None, "اشرح binary search", "", [], {}, "", [], 3, 1, False, False,
            ))
        steps = [event["step"] for event in events if event["type"] == "step"]
        self.assertEqual([step["say"] for step in steps], [step["say"] for step in raw_steps])
        ops = [op for step in steps for op in step["board"]]
        self.assertEqual([op["text"] for op in ops if op["op"] == "title"], ["البحث الثنائي"])
        self.assertEqual([op["label"] for op in ops if op["op"] == "box"], ["الوسط 13", "الهدف 21"])
        self.assertIn("نختار النصف الأيمن", next(op["lines"] for op in ops if op["op"] == "notes"))
        self.assertIsNone(events[-1]["error"])


class StreamedLessonTests(unittest.TestCase):
    """Steps reach the board while the model is still writing the lesson."""

    def test_first_step_is_yielded_before_the_stream_finishes(self):
        text = lesson_json()
        progress = {"done": False}
        first_seen = threading.Event()
        half = len(text) // 2       # past step 1's closing brace

        def fake_stream(*args, **kwargs):
            for i in range(0, len(text), 40):      # small SSE-like chunks
                if i >= half:
                    # the model is "still writing": hold the rest back until
                    # the test has received the first step
                    first_seen.wait(timeout=5)
                yield text[i:i + 40]
            progress["done"] = True

        with patch.object(engine, "openai_chat_stream", side_effect=fake_stream),              patch.object(engine, "openai_chat", side_effect=AssertionError("fallback used")),              patch.object(engine, "coach_update", return_value=({}, [])):
            turn = engine.run_turn(None, "كيف ينتقل طلب ويب؟", "", [], {}, "", [],
                                   3, 3, False, False)
            first = next(event for event in turn if event["type"] == "step")
            self.assertFalse(progress["done"], "first step waited for the whole lesson")
            first_seen.set()
            rest = list(turn)
        steps = [first["step"]] + [e["step"] for e in rest if e["type"] == "step"]
        self.assertEqual(len(steps), 4)
        self.assertEqual(steps[0]["say"], "نبدأ بالسؤال الذي أرسله الهاتف.")
        self.assertIsNone(rest[-1]["error"])

    def test_stream_failure_falls_back_to_whole_lesson_request(self):
        def broken_stream(*args, **kwargs):
            raise RuntimeError("stream refused")
            yield  # pragma: no cover

        with patch.object(engine, "openai_chat_stream", side_effect=broken_stream),              patch.object(engine, "openai_chat", return_value=lesson_json()) as generate,              patch.object(engine, "coach_update", return_value=({}, [])):
            events = list(engine.run_turn(None, "كيف ينتقل طلب ويب؟", "", [], {}, "", [],
                                          3, 3, False, False))
        generate.assert_called_once()
        self.assertEqual(len([e for e in events if e["type"] == "step"]), 4)


class LessonScopeTests(unittest.TestCase):
    """Inside a lecture, the tutor only answers questions about that lecture."""

    SCOPE = "عنوان المحاضرة: من فهم المشكلة إلى بناء الخوارزمية\n- ٥. تعريف الخوارزمية: ..."

    def turn(self, question, gate_reply):
        def fake_chat(messages, **kwargs):
            if "decide whether a student's question" in messages[0]["content"]:
                if isinstance(gate_reply, Exception):
                    raise gate_reply
                return gate_reply
            raise AssertionError("whole-lesson fallback used")

        def fake_stream(*args, **kwargs):
            yield lesson_json()

        with patch.object(engine, "openai_chat", side_effect=fake_chat),              patch.object(engine, "openai_chat_stream", side_effect=fake_stream) as stream,              patch.object(engine, "coach_update", return_value=({}, [])):
            events = list(engine.run_turn(
                None, question, "", [{"role": "user", "content": "lecture"}], {}, "", [],
                3, 3, False, False, lesson_scope=self.SCOPE, lesson_topic="الخوارزميات"))
        return events, stream

    def test_off_topic_question_gets_a_short_refusal_not_a_lesson(self):
        events, _stream = self.turn("ما هي عاصمة فرنسا؟", '{"related": false}')
        # the answer may start in parallel with the topic check, but none of
        # its steps may reach the learner: only the refusal is shown
        steps = [e["step"] for e in events if e["type"] == "step"]
        self.assertEqual(len(steps), 1)
        self.assertIn("خارج موضوع درسنا", steps[0]["say"])
        self.assertIn("الخوارزميات", steps[0]["say"])
        self.assertEqual(steps[0]["board"], [])
        self.assertTrue(events[-1].get("off_topic"))

    def test_lesson_question_is_answered(self):
        events, stream = self.turn("يعني إيه خوارزمية؟", '{"related": true}')
        stream.assert_called_once()
        self.assertEqual(len([e for e in events if e["type"] == "step"]), 4)
        prompt = stream.call_args[0][0][0]["content"]
        self.assertIn("LESSON SCOPE", prompt)

    def test_scope_check_failure_lets_the_question_through(self):
        events, stream = self.turn("اشرح خريطة التدفق", RuntimeError("network"))
        stream.assert_called_once()


if __name__ == "__main__":
    unittest.main()
