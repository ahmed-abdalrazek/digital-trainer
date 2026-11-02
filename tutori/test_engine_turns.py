import json
import unittest
from unittest.mock import patch

import engine


def lesson_json():
    return json.dumps({"steps": [
        {"say": "نبدأ بالسؤال الذي أرسله الهاتف.", "board": [{"op": "title", "text": "طلب الشبكة"}]},
        {"say": "ثم يمر الطلب عبر الموجّه.", "board": [{"op": "text", "text": "الموجّه", "at": [30, 35]}]},
        {"say": "يصل الطلب إلى الخادم.", "board": [{"op": "text", "text": "الخادم", "at": [60, 35]}]},
        {"say": "يرد الخادم ببيانات الصفحة.", "board": [{"op": "arrow", "from": [62, 40], "to": [45, 40]}]},
    ]})


class EngineTurnTests(unittest.TestCase):
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
        self.assertIn("one coherent 3-minute lesson", next(
            event["detail"] for event in events if event["type"] == "status"
            and "one coherent" in event.get("detail", "")
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


if __name__ == "__main__":
    unittest.main()
