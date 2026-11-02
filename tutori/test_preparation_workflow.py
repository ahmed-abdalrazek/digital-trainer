import unittest

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


if __name__ == "__main__":
    unittest.main()
