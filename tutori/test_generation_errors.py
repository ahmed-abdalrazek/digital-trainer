import unittest
from unittest.mock import patch

import engine
from engine import _friendly_generation_error


class GenerationErrorTests(unittest.TestCase):
    def test_missing_api_key_gets_actionable_message(self):
        message = _friendly_generation_error(
            "OPENAI_API_KEY is not configured. Create an API key."
        )
        self.assertIn("OPENAI_API_KEY", message)
        self.assertIn("أعد تشغيل الخادم", message)

    def test_rate_limit_gets_usage_message(self):
        self.assertIn("حدّه الحالي", _friendly_generation_error("HTTP 429 rate limit"))

    def test_unknown_error_does_not_leak_provider_details(self):
        message = _friendly_generation_error("private upstream payload secret-token")
        self.assertIn("راجع سجل الخادم", message)
        self.assertNotIn("secret-token", message)

    def test_missing_key_stops_before_a_second_generation_attempt(self):
        with patch.object(engine, "openai_chat", side_effect=RuntimeError(
            "OPENAI_API_KEY is not configured"
        )) as generate, patch.object(engine, "coach_update", return_value=({}, [])):
            events = list(engine.run_turn(
                None, "Explain a web request", "", [], {}, "", [], 3, 1, False, False
            ))
        generate.assert_called_once()
        final = next(event for event in reversed(events) if event["type"] == "final")
        self.assertIn("OPENAI_API_KEY", final["error"])


if __name__ == "__main__":
    unittest.main()
