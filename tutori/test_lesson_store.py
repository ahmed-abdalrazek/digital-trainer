import tempfile
import unittest
from pathlib import Path

import lesson_store
from preparation_workflow import SECTIONS


class LessonStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.path = Path(self.temp_dir.name) / "lesson.sqlite3"
        self.workflow = lesson_store.get_workflow(self.path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_student_has_no_lesson_until_teacher_publishes(self):
        self.assertIsNone(lesson_store.get_published_steps(self.path))

    def test_approval_is_sequential_and_saved(self):
        updated = lesson_store.approve_current(
            0, SECTIONS[0]["explanation"], SECTIONS[0]["board"], self.path
        )
        self.assertEqual(updated["current_index"], 1)
        self.assertEqual(updated["sections"][0]["status"], "approved")
        with self.assertRaises(lesson_store.WorkflowError):
            lesson_store.approve_current(0, "repeated click", SECTIONS[1]["board"], self.path)

    def test_rejection_keeps_current_section(self):
        updated = lesson_store.reject_current(0, self.path)
        self.assertEqual(updated["current_index"], 0)
        self.assertEqual(updated["sections"][0]["status"], "rejected")

    def test_publish_requires_all_sections_and_student_gets_snapshot(self):
        with self.assertRaises(lesson_store.WorkflowError):
            lesson_store.publish(0, self.path)
        for index, section in enumerate(SECTIONS):
            lesson_store.approve_current(index, section["explanation"], section["board"], self.path)
        published = lesson_store.publish(len(SECTIONS), self.path)
        self.assertEqual(published["published_version"], 1)
        snapshot = lesson_store.get_published_steps(self.path)
        self.assertEqual(snapshot["version"], 1)
        self.assertEqual(len(snapshot["steps"]), len(SECTIONS))
        self.assertEqual(snapshot["steps"][0]["board"][0]["op"], "clear")
        self.assertEqual(snapshot["steps"][0]["board"][1]["op"], "title")
        self.assertFalse(snapshot["voice"])

    def test_published_lesson_loads_persisted_ai_audio_file(self):
        audio_file = Path(self.temp_dir.name) / "voice.mp3"
        audio_file.write_bytes(b"fake-ai-audio")
        for index, section in enumerate(SECTIONS):
            lesson_store.approve_current(
                index, section["explanation"], section["board"], self.path,
                audio_path=str(audio_file), audio_duration=7.5,
            )
        lesson_store.publish(len(SECTIONS), self.path)
        snapshot = lesson_store.get_published_steps(self.path)
        self.assertTrue(snapshot["voice"])
        self.assertEqual(snapshot["steps"][0]["audio_url"], "/api/lesson-preparation/audio/0?v=1&pace=088")
        self.assertEqual(snapshot["steps"][0]["dur"], 7.5)

    def test_drawings_use_renderer_schema_and_bounds(self):
        with self.assertRaises(lesson_store.WorkflowError):
            lesson_store.validate_board('[{"op":"box","x":12,"y":10}]')
        with self.assertRaises(lesson_store.WorkflowError):
            lesson_store.validate_board('[{"op":"arrow","from":[0,0],"to":[99,70]}]')


if __name__ == "__main__":
    unittest.main()
