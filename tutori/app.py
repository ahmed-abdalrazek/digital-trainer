"""
Tutori lesson room and saved introductory-programming lesson.

Students play the teacher-approved saved lesson; follow-up questions use the
separate OpenAI-powered tutor when an API key is configured.
"""

import base64
import json
import os
import re
import tempfile
import uuid
from pathlib import Path

import gradio as gr
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
import lesson_store
from lesson_store import WorkflowError

# The API engine is the default everywhere; mock mode is explicit for offline UI work.
if os.environ.get("TUTORI_MOCK") != "1":
    try:
        import engine as ENGINE
    except Exception:
        import traceback
        traceback.print_exc()
        print("[tutori] API engine unavailable — falling back to mock")
        import mock_engine as ENGINE
else:
    import mock_engine as ENGINE

MODEL_LABEL = getattr(ENGINE, "MODEL_ID", "mock engine")
ASR_LABEL = getattr(ENGINE, "ASR_ID", "mock")
TTS_LABEL = getattr(ENGINE, "TTS_ID", "mock")

ROOT = Path(__file__).parent
BOARD_JS = (ROOT / "static" / "board.js").read_text(encoding="utf-8")
CSS = (ROOT / "static" / "style.css").read_text(encoding="utf-8")


FONT_FACES = (ROOT / "static" / "fonts" / "faces.css").read_text(encoding="utf-8")

PUBLIC_URL = "https://tutori.ssh.codes/"
SHARE_IMAGE_URL = f"{PUBLIC_URL}static/tutori-share.png?v=20260721-luna"
SOCIAL_DESCRIPTION = (
    "Ask a question out loud and Tutori teaches it while drawing a clear, "
    "live whiteboard lesson powered by the OpenAI API."
)
SOCIAL_META = f"""
<meta name="description" content="{SOCIAL_DESCRIPTION}" />
<meta property="og:title" content="Tutori — your whiteboard tutor" />
<meta property="og:type" content="website" />
<meta property="og:url" content="{PUBLIC_URL}" />
<meta property="og:site_name" content="Tutori" />
<meta property="og:description" content="{SOCIAL_DESCRIPTION}" />
<meta property="og:image" content="{SHARE_IMAGE_URL}" />
<meta property="og:image:secure_url" content="{SHARE_IMAGE_URL}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Tutori drawing a live lesson on a whiteboard" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Tutori — your whiteboard tutor" />
<meta name="twitter:description" content="{SOCIAL_DESCRIPTION}" />
<meta name="twitter:image" content="{SHARE_IMAGE_URL}" />
<meta name="twitter:image:alt" content="Tutori drawing a live lesson on a whiteboard" />
"""

HEAD = f"""
<style>{FONT_FACES}</style>
<script>{BOARD_JS}</script>
"""

HEADER_HTML = """
<div id="tutori-header">
  <div class="head-left">
    <div class="logo"><span class="mark">✏️</span> المدرب الرقمي
      <span class="sub">قاعة المحاضرة التفاعلية</span>
    </div>
    <svg class="squiggle" viewBox="0 0 320 14" preserveAspectRatio="none" aria-hidden="true">
      <path d="M4 9 Q 44 2, 84 8 T 164 8 T 244 9 T 316 6"/>
    </svg>
    <div class="tag">أساسيات البرمجة · من فهم المشكلة إلى بناء الخوارزمية · ٥ دقائق</div>
  </div>
  <span class="live-student-tag" id="tutori-live-status">● المحاضر جاهز</span>
</div>
"""

CHIPS = [
    "ما الفرق بين مدخلات المسألة ومخرجاتها؟",
    "اكتب خطوات خوارزمية حساب متوسط ثلاث درجات",
    "ماذا يحدث إذا كان المتوسط يساوي 60 بالضبط؟",
    "اختبر فهمي بسؤال عن مخطط التدفق",
]

EMPTY_PROFILE = {}


def _payload(turn_id, voice_on, status, detail, steps, completion_text="", lesson_total=0):
    # CUMULATIVE: every payload carries all steps so far (browser dedupes by
    # "i"). Gradio coalesces fast generator yields into latest-state — an
    # incremental protocol silently loses steps when that happens.
    n_ops = sum(len(s.get("board") or []) for s in steps)
    heavy = sum(1 for s in steps for op in (s.get("board") or [])
                if op.get("op") in ("axes", "graph", "polygon", "notes", "curve"))
    return json.dumps({
        "turn": turn_id,
        "voice": bool(voice_on),
        "status": status,
        "status_detail": detail,
        "completion_text": completion_text,
        "lesson_total": int(lesson_total or 0),
        "big": bool(n_ops >= 9 or heavy >= 4),
        "steps": steps,
    })


def _track_board(board_ops, step_board):
    """Mirror what the lesson drew so the next turn knows the board state."""
    for op in step_board or []:
        if op.get("op") == "clear":
            board_ops = []
        elif op.get("op") == "erase":
            targets = set(op.get("targets") or ([op.get("target")] if op.get("target") else []))
            board_ops = [old for old in board_ops if str(old.get("id")) not in targets]
        else:
            board_ops.append(op)
    return board_ops[-80:]


N_CHIPS = len(CHIPS)


def run_turn(audio_path, typed_text, snapshot, chat, convo, profile,
             notes, board_ops, pace, lesson_minutes, web_on, voice_on,
             prepared=False, saved_lesson=None, workflow_error=None):
    """Bridges ENGINE.run_turn events into streaming Gradio updates."""
    chat = list(chat or [])
    convo = list(convo or [])
    profile = dict(profile or {})
    notes = notes or ""
    board_ops = list(board_ops or [])
    turn_id = uuid.uuid4().hex[:10]

    has_input = bool(saved_lesson or workflow_error or audio_path or (typed_text or "").strip() or snapshot)
    if not has_input:
        yield (gr.update(), chat, convo, profile, profile, notes, board_ops,
               gr.update(), gr.update(),
               *([gr.update()] * (2 * N_CHIPS)))
        return

    user_label = (typed_text or "").strip() or ("🎙️ …" if audio_path else "🖼️ (my whiteboard)")
    if not prepared:
        chat.append({"role": "user", "content": user_label})
        chat.append({"role": "assistant", "content": "✏️ *composing the first clean panel…*"})
    question_for_context = (saved_lesson or {}).get("title") or user_label
    says = []
    sent_steps = []
    chip_vals = None  # set when the study coach suggests follow-ups

    def render(status="thinking", detail=""):
        n = N_CHIPS
        if chip_vals:
            chips = ([gr.update(value=s) for s in chip_vals[:n]] +
                     [gr.update()] * (n - min(n, len(chip_vals))))
            states = (list(chip_vals[:n]) +
                      [gr.update()] * (n - min(n, len(chip_vals))))
        else:
            chips = [gr.update()] * n
            states = [gr.update()] * n
        completion_text = "اكتملت المحاضرة ✓" if saved_lesson else "انتهى الشرح ✓"
        lesson_total = len((saved_lesson or {}).get("steps") or [])
        return (_payload(turn_id, voice_on, status, detail, sent_steps, completion_text, lesson_total),
                chat, convo, profile, profile, notes, board_ops,
                gr.update(value=None), gr.update(value=""),
                *chips, *states)

    yield render(detail="Thinking…")

    seq = 0
    error = None
    print(f"[tutori] turn {turn_id}: starting engine", flush=True)
    try:
        if workflow_error:
            events = [{"type": "final", "error": workflow_error}]
        elif saved_lesson:
            events = [{"type": "status", "status": "teaching",
                       "detail": f"تشغيل النسخة المعتمدة {saved_lesson['version']}…"}]
            events.extend({"type": "step", "step": step} for step in saved_lesson["steps"])
            events.append({"type": "final", "text": " ".join(s["say"] for s in saved_lesson["steps"]),
                           "error": None, "question": saved_lesson["title"]})
        else:
            events = ENGINE.run_turn(audio_path, typed_text, snapshot, convo, profile,
                                     notes, board_ops, pace, lesson_minutes, web_on, voice_on)
        for ev in events:
            kind = ev.get("type")
            if seq == 0 and kind != "step":
                print(f"[tutori] turn {turn_id}: event {kind}", flush=True)
            if kind == "status":
                yield render(ev.get("status", "thinking"), ev.get("detail", ""))
            elif kind == "transcript":
                question_for_context = ev["text"]
                chat[-2]["content"] = f"🎙️ {ev['text']}"
                yield render("thinking", "Heard you!")
            elif kind == "research":
                fresh = ev.get("notes", "")
                if fresh:
                    notes = (notes + "\n" + fresh)[-4000:]
            elif kind == "step":
                step = dict(ev["step"], i=seq)
                says.append(step.get("say", ""))
                board_ops = _track_board(board_ops, step.get("board"))
                chat[-1]["content"] = "✏️ " + " ".join(s for s in says if s)
                sent_steps.append(step)
                yield render("teaching", f"Teaching — step {seq + 1}")
                seq += 1
            elif kind == "memory":
                profile = dict(ev.get("profile") or profile)
            elif kind == "coach":
                chip_vals = ev.get("suggestions") or None
            elif kind == "final":
                error = ev.get("error")
                question_for_context = ev.get("question") or question_for_context
    except Exception as e:
        msg = str(e)
        print(f"[tutori] turn {turn_id}: engine raised: {msg[:300]}", flush=True)
        if seq > 0:
            error = None  # we already taught something — end the turn gracefully
        elif "openai_api_key" in msg.lower():
            error = "Set OPENAI_API_KEY from the OpenAI API platform; ChatGPT Go billing does not cover API requests."
        elif any(term in msg.lower() for term in ("401", "403", "429", "insufficient_quota", "billing")):
            error = "OpenAI API access or billing limit reached. Check your API key, billing, and usage limits."
        else:
            error = "The OpenAI API request failed. Check the server log, then retry."

    if error:
        chat[-1]["content"] = f"⚠️ {error}"
        yield render("error", error)
        return

    final_text = " ".join(s for s in says if s).strip() or chat[-1]["content"]
    if saved_lesson:
        final_text += "\n\n✅ اكتملت المحاضرة."
    chat[-1]["content"] = "✏️ " + final_text
    convo.append({"role": "user", "content": question_for_context})
    convo.append({"role": "assistant", "content": final_text[:1200]})
    yield render("done", "")


def _prepare_request(chat, *, typed_text="", audio_path=None, snapshot=""):
    """Acknowledge a submission before it enters Gradio's model queue."""
    typed_text = (typed_text or "").strip()
    if not (typed_text or audio_path or snapshot):
        return gr.update(), {}, gr.update()

    chat = list(chat or [])
    if (chat and chat[-1].get("role") == "assistant" and
            "composing the first clean panel" in str(chat[-1].get("content", ""))):
        chat[-1] = {"role": "assistant", "content": "⏹️ *Interrupted by the new question.*"}
    user_label = typed_text or ("🎙️ Listening…" if audio_path else "🖼️ (my whiteboard)")
    chat.append({"role": "user", "content": user_label})
    chat.append({"role": "assistant", "content": "✏️ *composing the first clean panel…*"})
    request = {
        "request_id": uuid.uuid4().hex,
        "audio_path": audio_path,
        "typed_text": typed_text,
        "snapshot": snapshot or "",
    }
    return chat, request, ""


def prepare_text_turn(typed_text, snapshot, chat):
    # Deliberately omit the microphone component here. Gradio's file
    # preprocessing made typed submissions wait behind stale/empty audio work.
    return _prepare_request(chat, typed_text=typed_text, snapshot=snapshot)


def prepare_demo_lecture(snapshot, chat):
    lesson = lesson_store.get_published_steps()
    chat, request, clear_text = _prepare_request(
        chat, typed_text=(lesson or {}).get("title", "تشغيل المحاضرة"), snapshot=""
    )
    if lesson:
        request["saved_lesson"] = lesson
    else:
        request["workflow_error"] = "المحاضرة الجديدة ما زالت مسودة. راجع أجزائها واعتمدها وانشرها من الداشبورد أولًا."
    return chat, request, clear_text


def prepare_replay_lecture(chat, convo, board_ops):
    # Replay the published snapshot. Replaying never calls the lesson generator.
    fresh_chat, request, _ = prepare_demo_lecture("", [])
    return fresh_chat, request, "", [], [], ""


def prepare_chip_turn(chip_text, snapshot, chat):
    return _prepare_request(chat, typed_text=chip_text, snapshot=snapshot)


def prepare_audio_turn(audio_path, snapshot, chat):
    return _prepare_request(chat, audio_path=audio_path, snapshot=snapshot)


def prepare_board_turn(snapshot, chat):
    return _prepare_request(chat, snapshot=snapshot)


def run_prepared_turn(request, chat, convo, profile, notes, board_ops,
                      pace, lesson_minutes, web_on, voice_on):
    """Run one acknowledged request through the model-backed lesson engine."""
    request = dict(request or {})
    if not request:
        return
    for update in run_turn(
        request.get("audio_path"), request.get("typed_text", ""),
        request.get("snapshot", ""), chat, convo, profile, notes, board_ops,
        pace, lesson_minutes, web_on, voice_on, prepared=True,
        saved_lesson=request.get("saved_lesson"),
        workflow_error=request.get("workflow_error"),
    ):
        # The full renderer also returns mic/text/chip controls. Never make
        # those outputs of a long-running event: Gradio marks outputs pending,
        # which used to disable Enter, Send, and examples mid-generation.
        coach_values = update[9 + N_CHIPS:9 + 2 * N_CHIPS]
        coach = ([value for value in coach_values if isinstance(value, str)]
                 or gr.update())
        yield (*update[:7], coach)


def apply_coach_suggestions(suggestions):
    suggestions = list(suggestions or CHIPS)[:N_CHIPS]
    suggestions += CHIPS[len(suggestions):N_CHIPS]
    return (*[gr.update(value=value) for value in suggestions], *suggestions)


def reset_session():
    # chat, convo, typed text, board mirror, mic, research notes
    return [], [], "", [], gr.update(value=None), ""


def forget_me():
    return {}, {}


def _save_tts_preview(audio_b64):
    """Persist a short generated preview so Gradio can serve it as audio."""
    if not audio_b64:
        return None
    audio = base64.b64decode(audio_b64)
    suffix = ".wav" if audio.startswith(b"RIFF") else ".mp3"
    with tempfile.NamedTemporaryFile(prefix="tutori-voice-", suffix=suffix,
                                     delete=False) as output:
        output.write(audio)
        return output.name


def _save_lesson_audio(audio_b64):
    if not audio_b64:
        raise RuntimeError("لم يصل ملف صوت من خدمة الذكاء الاصطناعي. راجع مفتاح API واتصال الخدمة.")
    audio = base64.b64decode(audio_b64)
    suffix = ".wav" if audio.startswith(b"RIFF") else ".mp3"
    folder = ROOT / "data" / "audio"
    folder.mkdir(parents=True, exist_ok=True)
    destination = folder / f"lesson-{uuid.uuid4().hex}{suffix}"
    destination.write_bytes(audio)
    return str(destination), len(audio)


def _generate_lesson_audio(text):
    synthesize = getattr(ENGINE, "synthesize", None)
    if not callable(synthesize) or not os.environ.get("ELEVENLABS_API_KEY", "").strip():
        raise RuntimeError("أضف ELEVENLABS_API_KEY إلى إعدادات تشغيل Tutori لتوليد الصوت.")
    audio_b64, duration = synthesize(str(text or "")[:4000])
    if not audio_b64:
        reason = str(getattr(ENGINE, "_TTS_BLOCK_REASON", ""))
        if "paid_plan_required" in reason:
            raise RuntimeError(
                "حساب ElevenLabs الحالي مجاني، ولا يسمح باستخدام هذا الصوت عبر API. "
                "فعّل خطة مدفوعة أو أضف رصيد API، ثم أعد توليد الصوت."
            )
        if "401" in reason or "invalid_api_key" in reason.lower():
            raise RuntimeError("مفتاح ELEVENLABS_API_KEY غير صالح أو غير مفعّل.")
        if "429" in reason or "quota" in reason.lower():
            raise RuntimeError("رصيد أو حد استخدام ElevenLabs غير كافٍ لتوليد الصوت.")
        if "403" in reason or "paid_plan_required" in reason:
            raise RuntimeError("ElevenLabs رفض الوصول لهذا الصوت أو النموذج. تحقق من صلاحية الصوت لخطة API.")
        if "404" in reason:
            raise RuntimeError("معرّف صوت ElevenLabs غير موجود أو غير متاح لهذا المفتاح.")
        if "422" in reason:
            raise RuntimeError("ElevenLabs رفض إعدادات الطلب أو النص. راجع النموذج ومعرّف الصوت.")
        if "CERTIFICATE_VERIFY_FAILED" in reason or "SSLCertVerificationError" in reason:
            raise RuntimeError("تعذر التحقق الآمن من شهادة اتصال ElevenLabs. حدّث حزم Python وشهادات النظام.")
        if reason:
            raise RuntimeError(f"تعذر توليد الصوت: {reason[:180]}")
        raise RuntimeError("تعذر توليد صوت ElevenLabs. لم تُرجع الخدمة تفاصيل إضافية.")
    audio_path, _size = _save_lesson_audio(audio_b64)
    return audio_path, float(duration or 0), "elevenlabs"


def _generate_lesson_board(title, explanation):
    """Ask the configured OpenAI model for a clear, lesson-specific board diagram."""
    chat = getattr(ENGINE, "openai_chat", None)
    if not callable(chat):
        raise RuntimeError("محرك الذكاء الاصطناعي غير متاح لتجهيز رسم السبورة.")
    prompt = (
        "أنشئ مخطط سبورة تعليميًا واضحًا يشرح هذا المقطع فقط. "
        "استخدم العربية الفصحى أو العربية السعودية، واجعل العبارات قصيرة ودقيقة. "
        "أعد JSON فقط بالشكل {\"board\":[...]} دون Markdown. "
        "العمليات المسموحة: clear، title، text، box، arrow، polygon. "
        "ابدأ بـ clear ثم title واحد. ارسم فكرة واحدة واضحة باستخدام 3 أو 4 عقد كبيرة فقط. "
        "اكتب داخل العقد كلمات مفتاحية قصيرة (سطر أو سطران، 4 كلمات كحد أقصى)، لا تنسخ الشرح كاملًا. "
        "اجعل تسلسل القراءة من اليمين إلى اليسار، مع أسهم قصيرة وواضحة لا تمر فوق النصوص. "
        "استخدم الأزرق للمدخلات، والبرتقالي للمعالجة أو القرار، والأخضر للنتيجة، والأحمر لمسار لا فقط. "
        "اجعل العناوين والعقد ضمن y من 18 إلى 64 واترك فراغًا حولها. "
        "إحداثيات x من 0 إلى 100 وy من 0 إلى 75. text يحتاج at:[x,y]. "
        "box يحتاج at:[x,y], w من 18 إلى 38, h من 10 إلى 18, label. "
        "لا تجعل العقد متداخلة أو ملتصقة. arrow يحتاج from:[x,y] وto:[x,y] وطوله بين 5 و35. "
        "للسؤال نعم/لا استخدم polygon بأربع نقاط بشكل معين وlabel قصير، ثم ارسم فرعين واضحين." 
        "استخدم text إضافيًا واحدًا فقط إذا كان يضيف ملاحظة تعليمية ضرورية. لا تزخرف ولا تكرر العنوان. "
        "العنوان: " + str(title) + "\nنص الشرح: " + str(explanation)
    )
    system = "أنت مصمم سبورات تعليمية دقيقة، ومهمتك تحويل شرح عربي إلى مخطط بسيط. لا تُرجع board فارغة أبدًا."
    last_error = ""
    for attempt in range(2):
        try:
            raw = chat(
                [{"role": "system", "content": system},
                 {"role": "user", "content": prompt + ("\nالمحاولة السابقة لم تنجح: " + last_error + ". أعد JSON كاملًا وفيه 4 عمليات رسم على الأقل." if last_error else "")}],
                model=getattr(ENGINE, "MODEL_ID", "gpt-6-luna"), max_tokens=1100,
                temperature=0.2, json_mode=True, reasoning="low", timeout=90,
            )
            parsed = json.loads(raw)
            candidate = parsed if isinstance(parsed, list) else parsed.get("board", parsed.get("operations", []))
            board_json = json.dumps(candidate, ensure_ascii=False)
            operations = lesson_store.validate_board(board_json)
            if len(operations) < 4 or operations[0].get("op") != "clear":
                raise WorkflowError("الرسم فارغ أو ناقص")
            return json.dumps(operations, ensure_ascii=False)
        except (TypeError, AttributeError, json.JSONDecodeError, WorkflowError) as exc:
            last_error = str(exc) or "تنسيق الرسم غير صالح"

    # Keep approval usable if the model returns an empty or malformed diagram twice.
    # The narration's own sentences become a simple, valid sequence of board cards.
    phrases = [part.strip(" \t،؛:—-–") for part in re.split(r"[.!؟؛\n]+", str(explanation))]
    phrases = [part for part in phrases if len(part.split()) >= 3]
    if len(phrases) < 3:
        phrases = [part.strip() for part in re.split(r"[،,]+", str(explanation)) if len(part.split()) >= 3]
    phrases = (phrases + [str(explanation).strip()])[:4]
    operations = [{"op": "clear"}, {"op": "title", "text": str(title)[:80]}]
    ys = [8, 24, 40, 56]
    for index, phrase in enumerate(phrases):
        label = phrase[:34].rstrip(" ،؛:…")
        operations.append({"op": "box", "at": [30, ys[index]], "w": 40, "h": 9, "label": label})
        if index < len(phrases) - 1:
            operations.append({"op": "arrow", "from": [50, ys[index] + 9], "to": [50, ys[index + 1]]})
    return json.dumps(lesson_store.validate_board(json.dumps(operations, ensure_ascii=False)), ensure_ascii=False)


def _preparation_outputs(message=""):
    workflow = lesson_store.get_workflow()
    sections = workflow["sections"]
    index = workflow["current_index"]
    count = len(sections)
    if workflow["state"] == "published":
        status = f"✅ نُشرت النسخة {workflow['published_version']} من «{workflow['title']}». تشغيل الطلاب يعيد هذه النسخة المحفوظة."
        title, explanation, board = "المحاضرة منشورة", "", "[]"
        can_review = can_publish = False
    elif index < count:
        section = sections[index]
        state_label = "بانتظار المراجعة" if section["status"] == "review" else "أُعيد للمراجعة"
        status = f"الحالة: {state_label} · الجزء {index + 1} من {count}. يفتح الاعتماد الجزء الذي يليه فقط."
        title = f"### {section['title']}\n\nهدف التعلم: {section['objective']}"
        explanation, board = section["explanation"], section["board_ops"]
        can_review, can_publish = True, False
    else:
        status = f"✅ اعتُمدت جميع الأجزاء ({count}). راجع النسخة ثم انشرها للطلاب صراحةً."
        title, explanation, board = "مراجعة نهائية قبل النشر", "", "[]"
        can_review, can_publish = False, True
    if message:
        status = message + "\n\n" + status
    published = lesson_store.get_published_steps() is not None
    return (
        index, status, title, explanation, board,
        gr.update(interactive=can_review), gr.update(interactive=can_review),
        gr.update(interactive=can_publish), gr.update(interactive=published),
        gr.update(interactive=published),
    )


def _approve_demo_section(index, explanation, board_json):
    try:
        lesson_store.approve_current(index, explanation, board_json)
        return _preparation_outputs("حُفظ اعتماد الجزء، وانتقلت المراجعة للجزء التالي.")
    except WorkflowError as exc:
        result = list(_preparation_outputs(str(exc)))
        result[3], result[4] = explanation, board_json
        return result


def _reject_demo_section(index, explanation, board_json):
    try:
        lesson_store.reject_current(index)
        result = list(_preparation_outputs("أُعيد الجزء للتعديل؛ بقيت المراجعة عند الجزء نفسه."))
        result[3], result[4] = explanation, board_json
        return result
    except WorkflowError as exc:
        result = list(_preparation_outputs(str(exc)))
        result[3], result[4] = explanation, board_json
        return result


def _publish_demo_lesson(index):
    try:
        lesson_store.publish(index)
        return _preparation_outputs("نُشرت النسخة المعتمدة. تشغيل الدرس الآن يستخدم المحتوى المحفوظ دون توليد.")
    except WorkflowError as exc:
        return _preparation_outputs(str(exc))


def _preview_demo_section(explanation, board_json):
    try:
        operations = lesson_store.validate_board(board_json)
        step = {"i": 0, "say": str(explanation or "معاينة الرسم"),
                "board": operations, "audio": None, "dur": 4.0}
        return _payload(uuid.uuid4().hex[:10], False, "done", "معاينة عمليات السبورة الفعلية", [step])
    except WorkflowError as exc:
        return _payload(uuid.uuid4().hex[:10], False, "error", str(exc), [])


def _published_button_updates():
    """Keep an already-open classroom tab in sync with dashboard publication."""
    published = lesson_store.get_published_steps() is not None
    return gr.update(interactive=published), gr.update(interactive=published)


with gr.Blocks(
    title="المدرب الرقمي — قاعة المحاضرة",
    theme=gr.themes.Soft(
        primary_hue="indigo", secondary_hue="amber", neutral_hue="stone",
        font=["Tahoma", "Arial", "sans-serif"],
    ),
    css=CSS,
    head=HEAD,
) as demo:

    profile_state = gr.BrowserState(EMPTY_PROFILE, storage_key="tutori_profile_v1")
    convo_state = gr.State([])
    notes_state = gr.State("")     # web research carried across the session
    board_state = gr.State([])     # ops currently on the board (server mirror)
    pending_state = gr.State({})   # acknowledged request waiting for the model queue
    coach_state = gr.State(CHIPS)  # updates chips separately so they never stay locked
    initial_preparation = lesson_store.get_workflow()

    payload_box = gr.Textbox(
        visible=True, elem_id="tutori-payload", elem_classes="payload-sink",
        show_label=False, container=False,
    )
    snap_box = gr.Textbox(visible=False)

    with gr.Row(elem_classes="demo-lecture-cta"):
        gr.HTML(HEADER_HTML, elem_id="tutori-header-shell")
        start_lecture_btn = gr.Button(
            "ابدأ النسخة المنشورة ←", variant="primary", elem_id="demo-start-lecture-btn",
            interactive=lesson_store.get_published_steps() is not None,
        )
        replay_btn = gr.Button(
            "↻ إعادة النسخة المنشورة", elem_id="replay-btn", size="sm",
            interactive=lesson_store.get_published_steps() is not None,
        )
    publish_state_timer = gr.Timer(value=3, active=True)
    publish_state_timer.tick(
        fn=_published_button_updates,
        outputs=[start_lecture_btn, replay_btn],
        show_progress="hidden",
    )

    with gr.Row(equal_height=False, elem_classes="studio-row"):
        # ---------------- whiteboard ----------------
        with gr.Column(scale=15, elem_classes="board-col"):
            gr.HTML('<div id="tutori-board-mount"></div>')
            if ENGINE.MODELS_INFO["mode"] == "mock":
                gr.HTML(
                    '<div id="mode-banner">🧪 <b>وضع تجريبي</b> — المحرك الحقيقي غير مفعّل. '
                    "أضف OPENAI_API_KEY لتشغيل المحاضرة بالذكاء الاصطناعي.</div>"
                )
            elif not os.environ.get("OPENAI_API_KEY", "").strip():
                gr.HTML(
                    '<div id="mode-banner">⚠️ <b>الدرس المنشور يعمل دون توليد</b> — '
                    "إجابات الأسئلة التفاعلية تحتاج إعداد OPENAI_API_KEY ثم إعادة تشغيل Tutori.</div>"
                )

        # ---------------- conversation ----------------
        with gr.Column(scale=8, elem_classes="side-col"):
            with gr.Column(elem_classes="question-panel"):
                gr.Markdown("**اسأل المدرب** · اكتب سؤالك أو سجّله بالصوت.")
                with gr.Row(elem_classes="question-entry"):
                    text_in = gr.Textbox(
                        value="",
                        placeholder="اكتب سؤالك هنا…",
                        show_label=False, lines=3, max_lines=6, scale=5, container=False,
                        elem_id="lesson-question",
                    )
                    send_btn = gr.Button("إرسال السؤال ←", variant="primary", scale=1, min_width=110, elem_id="send-btn")
                mic = gr.Audio(
                    sources=["microphone"], type="filepath", format="wav",
                    label="🎤 تسجيل سؤال صوتي · أوقف التسجيل للإرسال",
                    elem_id="mic-box", show_download_button=False,
                )
            chatbot = gr.Chatbot(
                type="messages", height=260, elem_id="tutori-chat",
                label="سجل المحاضرة",
                avatar_images=(None, None),
                show_copy_button=False,
            )
            with gr.Row(elem_classes="chip-row"):
                chip_btns = [gr.Button(c, size="sm") for c in CHIPS]
            chip_states = [gr.State(c) for c in CHIPS]

            with gr.Accordion("⚙️ إعدادات الشرح", open=False):
                pace = gr.Slider(
                    1, 5, value=3, step=1, label="سرعة الشرح وعمقه",
                    info="١ = مبتدئ وخطوات مبسطة · ٥ = شرح سريع ومتقدم",
                )
                lesson_minutes = gr.Slider(
                    1, 5, value=5, step=1, label="مدة المحاضرة بالدقائق",
                    info="المدة الافتراضية خمس دقائق؛ والحد الأقصى خمس دقائق.",
                )
                web_on = gr.Checkbox(False, label="🔎 البحث على الإنترنت عند الحاجة")
                voice_on = gr.Checkbox(
                    True,
                    label="🔊 تشغيل الردود الصوتية",
                )
                if hasattr(ENGINE, "set_tts_voice"):
                    gr.Markdown(
                        "🔊 صوت المحاضرة من ElevenLabs. أضف `ELEVENLABS_API_KEY` إلى بيئة التشغيل. "
                        f"معرّف الصوت: `{getattr(ENGINE, 'TTS_VOICE_ID', '')}`."
                    )
            with gr.Accordion("🧠 ملف المتعلم", open=False):
                gr.Markdown(
                    "يمكن للمدرب تذكّر مستواك وأهدافك وما أتقنته. تُحفظ هذه الملاحظات "
                    "في هذا المتصفح فقط لمساعدته على ضبط الشرح لاحقًا."
                )
                profile_view = gr.JSON(value=EMPTY_PROFILE, label="بيانات المتعلم")
                forget_btn = gr.Button("🗑️ حذف بياناتي", size="sm")

    # ---------------- wiring ----------------
    # The `js` hook runs client-side BEFORE fn and its return replaces the
    # input values — we use it to inject a fresh whiteboard snapshot into
    # `snap_box`. (gr.State arrives as null in js; pass it through untouched.)
    def _snap_js(fn_name):
        return (
            "(audio, text, snap, chat, convo, profile, notes, board, pace, minutes, web, voice) => "
            f"[audio, text, (window.{fn_name} ? window.{fn_name}() : ''), "
            "chat, convo, profile, notes, board, pace, minutes, web, voice]"
        )

    def _snap_chip_js(fn_name):
        return (
            "(chip, audio, snap, chat, convo, profile, notes, board, pace, minutes, web, voice) => "
            f"[chip, audio, (window.{fn_name} ? window.{fn_name}() : ''), "
            "chat, convo, profile, notes, board, pace, minutes, web, voice]"
        )

    turn_outputs = [
        payload_box, chatbot, convo_state, profile_state, profile_view,
        notes_state, board_state, mic, text_in, *chip_btns, *chip_states,
    ]

    prepared_inputs = [
        pending_state, chatbot, convo_state, profile_state, notes_state,
        board_state, pace, lesson_minutes, web_on, voice_on,
    ]
    prepared_outputs = [
        payload_box, chatbot, convo_state, profile_state, profile_view,
        notes_state, board_state, coach_state,
    ]
    prepared_io = dict(
        fn=run_prepared_turn,
        inputs=prepared_inputs,
        outputs=prepared_outputs,
        queue=True,
        show_progress="hidden",
        concurrency_id="tutori-lessons",
        concurrency_limit=12,
    )
    prepare_outputs = [chatbot, pending_state, text_in]

    coach_state.change(
        fn=apply_coach_suggestions,
        inputs=coach_state,
        outputs=[*chip_btns, *chip_states],
        queue=False,
        show_progress="hidden",
    )

    # Every control first runs a tiny unqueued acknowledgement. Its guaranteed
    # completion event starts the model generator; Gradio State.change does not
    # reliably fire for State values returned by another server callback.
    prepare_events = [
        start_lecture_btn.click(
            fn=prepare_demo_lecture,
            inputs=[snap_box, chatbot], outputs=prepare_outputs,
            js="(snap, chat) => [(window.tutoriSnapshotIfInk ? window.tutoriSnapshotIfInk() : ''), chat]",
            queue=False, show_progress="hidden", trigger_mode="always_last",
        ),
        mic.stop_recording(
            fn=prepare_audio_turn,
            inputs=[mic, snap_box, chatbot], outputs=prepare_outputs,
            js="(audio, snap, chat) => [audio, (window.tutoriSnapshotIfInk ? window.tutoriSnapshotIfInk() : ''), chat]",
            queue=False, show_progress="hidden", trigger_mode="always_last",
        ),
        text_in.submit(
            fn=prepare_text_turn,
            inputs=[text_in, snap_box, chatbot], outputs=prepare_outputs,
            js="(text, snap, chat) => [text, (window.tutoriSnapshotIfInk ? window.tutoriSnapshotIfInk() : ''), chat]",
            queue=False, show_progress="hidden", trigger_mode="always_last",
        ),
        send_btn.click(
            fn=prepare_text_turn,
            inputs=[text_in, snap_box, chatbot], outputs=prepare_outputs,
            js="(text, snap, chat) => [text, (window.tutoriSnapshotIfInk ? window.tutoriSnapshotIfInk() : ''), chat]",
            queue=False, show_progress="hidden", trigger_mode="always_last",
        ),
    ]
    for btn, chip_state in zip(chip_btns, chip_states):
        prepare_events.append(btn.click(
            fn=prepare_chip_turn,
            inputs=[chip_state, snap_box, chatbot], outputs=prepare_outputs,
            js="(chip, snap, chat) => [chip, (window.tutoriSnapshotIfInk ? window.tutoriSnapshotIfInk() : ''), chat]",
            queue=False, show_progress="hidden", trigger_mode="always_last",
        ))

    turn_events = [event.then(**prepared_io, trigger_mode="always_last")
                   for event in prepare_events]

    replay_event = replay_btn.click(
        fn=prepare_replay_lecture,
        inputs=[chatbot, convo_state, board_state],
        outputs=[chatbot, pending_state, text_in, convo_state, board_state, notes_state],
        js="(chat, convo, board) => { window.tutoriClearAll?.(); window.tutoriResetLectureControls?.(); return [chat, convo, board]; }",
        queue=False, show_progress="hidden", trigger_mode="always_last",
        cancels=turn_events,
    )
    replay_event.then(**prepared_io, trigger_mode="always_last")

    payload_box.change(fn=None, inputs=payload_box, outputs=None,
                       js="(p) => { window.tutoriOnPayload(p); }")
    forget_btn.click(forget_me, None, [profile_state, profile_view])
    demo.load(lambda p: p or {}, profile_state, profile_view)

    if os.environ.get("TUTORI_TTS_DEMO") == "1":
        # dev-only narration endpoint (never set on the public Space)
        import spaces as _spaces

        @_spaces.GPU(duration=45)
        def _tts_demo(text):
            audio_b64, dur = ENGINE.synthesize(str(text)[:300])
            return json.dumps({"audio": audio_b64, "dur": dur})

        _tts_in = gr.Textbox(visible=False)
        _tts_out = gr.Textbox(visible=False)
        _tts_btn = gr.Button("tts", visible=False)
        _tts_btn.click(_tts_demo, _tts_in, _tts_out, api_name="tts_demo")



if __name__ == "__main__":
    # Keep Gradio as the application UI, but mount it in a tiny FastAPI shell so
    # the public app has a stable image URL and one authoritative set of social
    # metadata. Gradio 5 otherwise emits two conflicting sets of placeholder
    # Open Graph tags, and many link unfurlers choose the first one.
    web = FastAPI(title="Tutori")
    web.add_middleware(
        CORSMiddleware, allow_origin_regex=r"https?://([a-zA-Z0-9-]+\.test|localhost|127\.0\.0\.1)(:\d+)?",
        allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type"],
    )

    @web.get("/admin", response_class=HTMLResponse)
    async def admin_dashboard():
        dashboard = (ROOT.parent / "index.html").read_text(encoding="utf-8")
        dashboard = dashboard.replace('href="assets/', 'href="/dashboard-assets/')
        dashboard = dashboard.replace('src="assets/', 'src="/dashboard-assets/')
        return HTMLResponse(dashboard, headers={"Cache-Control": "no-store"})

    web.mount("/dashboard-assets", StaticFiles(directory=str(ROOT.parent / "assets")), name="dashboard-assets")

    @web.get("/api/lesson-preparation")
    async def lesson_preparation_state():
        state = lesson_store.get_workflow()
        published = lesson_store.get_published_steps()
        state["ai_audio_ready"] = bool(published and published.get("voice"))
        state["ai_audio_provider"] = published.get("provider") if published else None
        return state

    @web.get("/api/lesson-preparation/audio/{position}")
    async def lesson_preparation_audio_file(position: int):
        version, sections = lesson_store.get_published_sections()
        if not version:
            return JSONResponse({"error": "لا توجد نسخة منشورة."}, status_code=404)
        section = next((item for item in sections if int(item["position"]) == position), None)
        audio_path = Path(section["audio_path"]) if section and section.get("audio_path") else None
        if not audio_path or not audio_path.is_file():
            return JSONResponse({"error": "ملف الصوت لهذا الجزء غير موجود."}, status_code=404)
        media_type = "audio/wav" if audio_path.suffix.lower() == ".wav" else "audio/mpeg"
        return FileResponse(audio_path, media_type=media_type,
                            headers={"Cache-Control": "private, max-age=3600"})

    @web.post("/api/lesson-preparation/approve")
    async def lesson_preparation_approve(request: Request):
        try:
            data = await request.json()
            workflow = lesson_store.get_workflow()
            if int(data.get("expected_index")) != int(workflow["current_index"]):
                raise WorkflowError("تغير الجزء الحالي. حدّث الشاشة ثم أعد المحاولة.")
            explanation = str(data.get("explanation") or "").strip()
            if not explanation:
                raise WorkflowError("أدخل الشرح قبل اعتماد الجزء.")
            section = workflow["sections"][workflow["current_index"]]
            audio_path, audio_duration, audio_provider = await run_in_threadpool(
                _generate_lesson_audio, explanation
            )
            try:
                board_json = await run_in_threadpool(
                    _generate_lesson_board, section["title"], explanation
                )
                return lesson_store.approve_current(
                    data.get("expected_index"), explanation, board_json,
                    audio_path=audio_path, audio_duration=audio_duration, audio_provider=audio_provider,
                )
            except Exception:
                Path(audio_path).unlink(missing_ok=True)
                raise
        except (WorkflowError, TypeError, ValueError, RuntimeError) as exc:
            return JSONResponse({"error": str(exc)}, status_code=400)

    @web.post("/api/lesson-preparation/audio")
    async def lesson_preparation_audio():
        try:
            version, sections = lesson_store.get_published_sections()
            if not version:
                raise WorkflowError("انشر المحاضرة أولًا ثم أنشئ ملفاتها الصوتية.")
            missing = [section for section in sections
                       if section.get("audio_provider") != "elevenlabs"
                       or not section.get("audio_path")
                       or not Path(section["audio_path"]).is_file()]
            if not missing:
                return {"ready": True, "message": "الصوت الذكي جاهز بالفعل."}
            audio = {}
            for section in missing:
                audio[section["position"]] = _generate_lesson_audio(section["explanation"])
            lesson_store.save_published_audio(version, audio)
            return {"ready": True, "message": "تم توليد صوت ElevenLabs وحفظه للنسخة المنشورة."}
        except (WorkflowError, TypeError, ValueError, RuntimeError) as exc:
            return JSONResponse({"error": str(exc)}, status_code=400)

    @web.post("/api/lesson-preparation/reject")
    async def lesson_preparation_reject(request: Request):
        try:
            data = await request.json()
            return lesson_store.reject_current(data.get("expected_index"))
        except (WorkflowError, TypeError, ValueError) as exc:
            return JSONResponse({"error": str(exc)}, status_code=400)

    @web.post("/api/lesson-preparation/publish")
    async def lesson_preparation_publish(request: Request):
        try:
            data = await request.json()
            return lesson_store.publish(data.get("expected_index"))
        except (WorkflowError, TypeError, ValueError) as exc:
            return JSONResponse({"error": str(exc)}, status_code=400)

    web.mount("/static", StaticFiles(directory=str(ROOT / "static")), name="static")

    @web.middleware("http")
    async def tutori_social_metadata(request: Request, call_next):
        response = await call_next(request)
        if request.method != "GET" or request.url.path != "/":
            return response
        if "text/html" not in response.headers.get("content-type", ""):
            return response

        body = b"".join([chunk async for chunk in response.body_iterator])
        page = body.decode("utf-8")
        page = re.sub(
            r"\s*<meta\s+(?:property|name)=\"(?:og:|twitter:)[^\"]+\"[^>]*?/?>",
            "",
            page,
            flags=re.IGNORECASE,
        )
        page = page.replace("<head>", f"<head>\n{SOCIAL_META}", 1)
        headers = dict(response.headers)
        headers.pop("content-length", None)
        headers["cache-control"] = "no-cache"
        return Response(
            page,
            status_code=response.status_code,
            headers=headers,
            media_type="text/html",
        )

    demo.queue(default_concurrency_limit=12)
    web = gr.mount_gradio_app(
        web,
        demo,
        path="/",
        server_name=os.environ.get("GRADIO_SERVER_NAME", "0.0.0.0"),
        server_port=int(os.environ.get("PORT", os.environ.get("GRADIO_SERVER_PORT", "7860"))),
        auth=None,
        ssr_mode=False,
        allowed_paths=[str(ROOT / "static")],
    )

    import uvicorn

    uvicorn.run(
        web,
        host=os.environ.get("GRADIO_SERVER_NAME", "0.0.0.0"),
        port=int(os.environ.get("PORT", os.environ.get("GRADIO_SERVER_PORT", "7860"))),
    )
