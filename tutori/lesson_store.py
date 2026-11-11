"""Persistent local store for the Tutori network-lesson approval example."""

import json
import math
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path, PureWindowsPath

from preparation_workflow import DURATION_MINUTES, LESSON_ID, LESSON_TITLE, SECTIONS


DB_PATH = Path(__file__).parent / "data" / "lesson_preparation.sqlite3"
AUDIO_DIR = Path(__file__).parent / "data" / "audio"


def resolve_audio_path(stored):
    """Return the lesson audio file for a stored path, or None if it is missing.

    Paths are saved as absolute paths of the machine that generated them
    (e.g. C:\\...\\data\\audio\\x.mp3), so a database copied to another host
    falls back to the same file name inside this install's data/audio.
    """
    if not stored:
        return None
    path = Path(stored)
    if path.is_file():
        return path
    fallback = AUDIO_DIR / PureWindowsPath(stored).name
    return fallback if fallback.is_file() else None
SUPPORTED_OPS = {"clear", "title", "text", "box", "arrow", "polygon"}


class WorkflowError(ValueError):
    pass


@contextmanager
def _connect(path=DB_PATH):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10, isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
    except Exception:
        if connection.in_transaction:
            connection.rollback()
        raise
    finally:
        connection.close()


def initialize(path=DB_PATH):
    with _connect(path) as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS preparation (
            lesson_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            state TEXT NOT NULL,
            current_index INTEGER NOT NULL,
            published_version INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL DEFAULT 10
        );
        CREATE TABLE IF NOT EXISTS lesson_section (
            lesson_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            title TEXT NOT NULL,
            objective TEXT NOT NULL,
            explanation TEXT NOT NULL,
            board_ops TEXT NOT NULL,
            status TEXT NOT NULL,
            approved_at TEXT,
            audio_path TEXT,
            audio_duration REAL,
            audio_provider TEXT,
            PRIMARY KEY (lesson_id, position),
            FOREIGN KEY (lesson_id) REFERENCES preparation(lesson_id)
        );
        CREATE TABLE IF NOT EXISTS published_lesson (
            lesson_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            sections_json TEXT NOT NULL,
            published_at TEXT NOT NULL,
            PRIMARY KEY (lesson_id, version)
        );
        """)
        preparation_columns = {row[1] for row in db.execute("PRAGMA table_info(preparation)")}
        if "duration_minutes" not in preparation_columns:
            db.execute("ALTER TABLE preparation ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 10")
        columns = {row[1] for row in db.execute("PRAGMA table_info(lesson_section)")}
        if "audio_path" not in columns:
            db.execute("ALTER TABLE lesson_section ADD COLUMN audio_path TEXT")
        if "audio_duration" not in columns:
            db.execute("ALTER TABLE lesson_section ADD COLUMN audio_duration REAL")
        if "audio_provider" not in columns:
            db.execute("ALTER TABLE lesson_section ADD COLUMN audio_provider TEXT")
        row = db.execute("SELECT 1 FROM preparation WHERE lesson_id=?", (LESSON_ID,)).fetchone()
        if not row:
            now = _now()
            db.execute("""INSERT INTO preparation
                          (lesson_id, title, state, current_index, published_version, updated_at, duration_minutes)
                          VALUES (?, ?, ?, ?, 0, ?, ?)""",
                       (LESSON_ID, LESSON_TITLE, "section_review", 0, now, DURATION_MINUTES))
            for index, section in enumerate(SECTIONS):
                db.execute(
                    "INSERT INTO lesson_section (lesson_id, position, title, objective, explanation, board_ops, status, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)",
                    (LESSON_ID, index, section["title"], section["objective"],
                     section["explanation"], section["board"], "review" if index == 0 else "pending"),
                )


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def validate_board(board_json):
    try:
        operations = json.loads(board_json or "[]")
    except (TypeError, json.JSONDecodeError) as exc:
        raise WorkflowError("عمليات السبورة ليست JSON صالحًا.") from exc
    if not isinstance(operations, list) or not operations or len(operations) > 20:
        raise WorkflowError("يجب أن يحتوي الرسم على 1 إلى 20 عملية.")

    def number(value):
        return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)

    def point(value):
        return (isinstance(value, list) and len(value) == 2 and
                all(number(v) for v in value) and 0 <= value[0] <= 100 and 0 <= value[1] <= 75)

    boxes = []
    for op_index, op in enumerate(operations):
        if not isinstance(op, dict) or op.get("op") not in SUPPORTED_OPS:
            raise WorkflowError("يوجد نوع رسم غير مدعوم.")
        kind = op["op"]
        if kind == "clear" and op_index != 0:
            raise WorkflowError("عملية المسح الكامل يجب أن تكون أول عملية في الجزء.")
        if kind in {"title", "text"} and (not isinstance(op.get("text"), str) or not op["text"].strip()):
            raise WorkflowError("عنوان أو نص الرسم فارغ.")
        if kind == "title" and len(op["text"]) > 80:
            raise WorkflowError("عنوان الرسم طويل جدًا.")
        if kind == "text" and not point(op.get("at")):
            raise WorkflowError("إحداثيات النص خارج مساحة السبورة.")
        if kind == "box":
            at, w, h = op.get("at"), op.get("w"), op.get("h")
            if (not point(at) or not number(w) or not number(h) or w <= 0 or h <= 0 or
                    w > 40 or h > 24 or at[0] + w > 100 or at[1] + h > 75 or
                    not isinstance(op.get("label"), str) or not op["label"].strip()):
                raise WorkflowError("أبعاد أو تسمية صندوق الرسم غير صالحة.")
            box = (at[0], at[1], at[0] + w, at[1] + h)
            if any(box[0] < old[2] and box[2] > old[0] and
                   box[1] < old[3] and box[3] > old[1] for old in boxes):
                raise WorkflowError("يوجد تداخل بين صناديق الرسم.")
            boxes.append(box)
        if kind == "arrow":
            if not point(op.get("from")) or not point(op.get("to")):
                raise WorkflowError("نقاط السهم خارج مساحة السبورة.")
            length = math.dist(op["from"], op["to"])
            if length < 5 or length > 35:
                raise WorkflowError("السهم قصير جدًا أو طويل بما لا يناسب الرسم.")
        if kind == "polygon":
            points = op.get("points")
            if (not isinstance(points, list) or not 3 <= len(points) <= 8
                    or not all(point(p) for p in points)
                    or ("label" in op and (not isinstance(op["label"], str) or len(op["label"]) > 40))):
                raise WorkflowError("شكل القرار في الرسم غير صالح.")
    return operations


def get_workflow(path=DB_PATH):
    initialize(path)
    with _connect(path) as db:
        lesson = dict(db.execute("SELECT * FROM preparation WHERE lesson_id=?", (LESSON_ID,)).fetchone())
        sections = [dict(row) for row in db.execute(
            "SELECT * FROM lesson_section WHERE lesson_id=? ORDER BY position", (LESSON_ID,)
        )]
    return {**lesson, "sections": sections}


def _transition(expected_index, action, explanation="", board_json="", path=DB_PATH,
                audio_path=None, audio_duration=None, audio_provider=None):
    initialize(path)
    with _connect(path) as db:
        db.execute("BEGIN IMMEDIATE")
        lesson = db.execute("SELECT * FROM preparation WHERE lesson_id=?", (LESSON_ID,)).fetchone()
        index = int(lesson["current_index"])
        if int(expected_index) != index:
            db.rollback()
            raise WorkflowError("تغير الجزء الحالي. حدّث الشاشة ثم أعد المحاولة.")
        if index >= len(SECTIONS) or lesson["state"] not in {"section_review", "final_review"}:
            db.rollback()
            raise WorkflowError("لا توجد خطوة مراجعة متاحة الآن.")
        section = db.execute(
            "SELECT status FROM lesson_section WHERE lesson_id=? AND position=?", (LESSON_ID, index)
        ).fetchone()
        if action == "reject":
            db.execute("UPDATE lesson_section SET status='rejected' WHERE lesson_id=? AND position=?",
                       (LESSON_ID, index))
            db.execute("UPDATE preparation SET state='section_review', updated_at=? WHERE lesson_id=?",
                       (_now(), LESSON_ID))
        elif action == "approve":
            if section["status"] == "approved":
                db.rollback()
                raise WorkflowError("هذا الجزء معتمد بالفعل.")
            explanation = str(explanation or "").strip()
            if not explanation:
                db.rollback()
                raise WorkflowError("أدخل الشرح قبل اعتماد الجزء.")
            operations = validate_board(board_json)
            db.execute("""UPDATE lesson_section SET explanation=?, board_ops=?, status='approved', approved_at=?,
                          audio_path=?, audio_duration=?, audio_provider=? WHERE lesson_id=? AND position=?""",
                       (explanation, json.dumps(operations, ensure_ascii=False), _now(), audio_path,
                        audio_duration, audio_provider, LESSON_ID, index))
            next_index = index + 1
            new_state = "final_review" if next_index == len(SECTIONS) else "section_review"
            if next_index < len(SECTIONS):
                db.execute("UPDATE lesson_section SET status='review' WHERE lesson_id=? AND position=?",
                           (LESSON_ID, next_index))
            db.execute("UPDATE preparation SET current_index=?, state=?, updated_at=? WHERE lesson_id=?",
                       (next_index, new_state, _now(), LESSON_ID))
        else:
            db.rollback()
            raise WorkflowError("إجراء غير معروف.")
        db.commit()
    return get_workflow(path)


def approve_current(expected_index, explanation, board_json, path=DB_PATH,
                    audio_path=None, audio_duration=None, audio_provider=None):
    return _transition(expected_index, "approve", explanation, board_json, path,
                       audio_path, audio_duration, audio_provider)


def reject_current(expected_index, path=DB_PATH):
    return _transition(expected_index, "reject", path=path)


def publish(expected_index=None, path=DB_PATH):
    initialize(path)
    with _connect(path) as db:
        db.execute("BEGIN IMMEDIATE")
        lesson = db.execute("SELECT * FROM preparation WHERE lesson_id=?", (LESSON_ID,)).fetchone()
        count = db.execute("SELECT COUNT(*) FROM lesson_section WHERE lesson_id=? AND status='approved'",
                           (LESSON_ID,)).fetchone()[0]
        if (lesson["state"] != "final_review" or count != len(SECTIONS) or
                (expected_index is not None and int(expected_index) != lesson["current_index"])):
            db.rollback()
            raise WorkflowError("لا يمكن نشر المحاضرة قبل اعتماد كل الأجزاء.")
        sections = [dict(row) for row in db.execute(
            "SELECT * FROM lesson_section WHERE lesson_id=? ORDER BY position", (LESSON_ID,)
        )]
        version = int(lesson["published_version"]) + 1
        db.execute("INSERT INTO published_lesson VALUES (?, ?, ?, ?)",
                   (LESSON_ID, version, json.dumps(sections, ensure_ascii=False), _now()))
        db.execute("UPDATE preparation SET state='published', published_version=?, updated_at=? WHERE lesson_id=?",
                   (version, _now(), LESSON_ID))
        db.commit()
    return get_workflow(path)



def get_published_sections(path=DB_PATH):
    initialize(path)
    with _connect(path) as db:
        lesson = db.execute("SELECT published_version FROM preparation WHERE lesson_id=?", (LESSON_ID,)).fetchone()
        version = int(lesson["published_version"])
        if not version:
            return None, []
        row = db.execute("SELECT sections_json FROM published_lesson WHERE lesson_id=? AND version=?",
                         (LESSON_ID, version)).fetchone()
    return version, json.loads(row["sections_json"])


def save_published_audio(version, audio_by_position, path=DB_PATH):
    with _connect(path) as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT sections_json FROM published_lesson WHERE lesson_id=? AND version=?",
                         (LESSON_ID, int(version))).fetchone()
        if not row:
            db.rollback()
            raise WorkflowError("النسخة المنشورة تغيرت. حدّث الصفحة ثم أعد المحاولة.")
        sections = json.loads(row["sections_json"])
        for section in sections:
            audio = audio_by_position.get(int(section["position"]))
            if audio:
                section["audio_path"], section["audio_duration"], section["audio_provider"] = audio
        db.execute("UPDATE published_lesson SET sections_json=? WHERE lesson_id=? AND version=?",
                   (json.dumps(sections, ensure_ascii=False), LESSON_ID, int(version)))
        db.commit()


def save_published_boards(version, boards_by_position, path=DB_PATH):
    """Replace board drawings in one published snapshot without touching its audio."""
    with _connect(path) as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT sections_json FROM published_lesson WHERE lesson_id=? AND version=?",
                         (LESSON_ID, int(version))).fetchone()
        if not row:
            db.rollback()
            raise WorkflowError("النسخة المنشورة تغيرت. حدّث الصفحة ثم أعد المحاولة.")
        sections = json.loads(row["sections_json"])
        for section in sections:
            board_json = boards_by_position.get(int(section["position"]))
            if board_json is not None:
                operations = validate_board(board_json)
                section["board_ops"] = json.dumps(operations, ensure_ascii=False)
        db.execute("UPDATE published_lesson SET sections_json=? WHERE lesson_id=? AND version=?",
                   (json.dumps(sections, ensure_ascii=False), LESSON_ID, int(version)))
        db.commit()


def get_published_steps(path=DB_PATH):
    initialize(path)
    with _connect(path) as db:
        lesson = db.execute("SELECT published_version FROM preparation WHERE lesson_id=?", (LESSON_ID,)).fetchone()
        version = int(lesson["published_version"])
        if not version:
            return None
        row = db.execute("SELECT sections_json FROM published_lesson WHERE lesson_id=? AND version=?",
                         (LESSON_ID, version)).fetchone()
    sections = json.loads(row["sections_json"])
    steps = []
    for section in sections:
        say = section["explanation"]
        audio_url = None
        if resolve_audio_path(section.get("audio_path")):
            # Bust any browser cache after re-synthesizing a lesson at a new pace.
            audio_url = f"/api/lesson-preparation/audio/{int(section['position'])}?v={version}&pace=088"
        steps.append({"say": say, "board": json.loads(section["board_ops"]),
                      "audio_url": audio_url, "audio_provider": section.get("audio_provider"),
                      "dur": section.get("audio_duration") or max(5.0, len(say.split()) / 2.2)})
    providers = [step["audio_provider"] for step in steps]
    provider = providers[0] if providers and all(item == providers[0] for item in providers) else None
    return {"title": LESSON_TITLE, "version": version,
            "steps": steps, "voice": all(step["audio_url"] for step in steps), "provider": provider}
