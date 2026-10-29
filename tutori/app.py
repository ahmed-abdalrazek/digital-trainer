"""
Tutori — your personal whiteboard tutor.

Speak (or type) a question. Tutori listens, gathers whatever context it needs,
then teaches you out loud while sketching the idea on a whiteboard in real
time. The Gradio edition uses the OpenAI API directly for lesson generation,
transcription, and speech. API usage is billed separately from ChatGPT plans.
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
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

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
    <div class="tag">الشبكات 101 · كيف تنتقل البيانات عبر شبكة الحاسب؟</div>
  </div>
  <span class="live-student-tag">● المحاضر جاهز</span>
</div>
"""

CHIPS = [
    "اشرح إرسال رسالة من الجوال عبر Wi-Fi خطوة بخطوة",
    "ما الفرق بين عنوان IP وعنوان MAC؟",
    "كيف يختار الموجّه المسار المناسب للبيانات؟",
    "اختبر فهمي بسؤال عن حزم البيانات",
]

START_LECTURE_PROMPT = (
    "قدّم محاضرة تفاعلية واحدة بالعربية الفصحى المبسطة لمتدرب مبتدئ "
    "في مقرر الشبكات 101 بعنوان: كيف تنتقل البيانات عبر شبكة الحاسب؟ "
    "اشرح أدوار المرسل ووسيط النقل والمستقبل، وتتبع مثال إرسال رسالة "
    "من هاتف عبر Wi-Fi إلى خادم ويب. ارسم مخططًا واضحًا على السبورة، "
    "وقسّم الشرح إلى خطوات قصيرة، ثم اختم بسؤال واحد للتحقق من الفهم. "
    "لا تبحث في الإنترنت؛ هذا شرح تعليمي لمفهوم أساسي."
)

EMPTY_PROFILE = {}


def _payload(turn_id, voice_on, status, detail, steps):
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
             prepared=False):
    """Bridges ENGINE.run_turn events into streaming Gradio updates."""
    chat = list(chat or [])
    convo = list(convo or [])
    profile = dict(profile or {})
    notes = notes or ""
    board_ops = list(board_ops or [])
    turn_id = uuid.uuid4().hex[:10]

    has_input = bool(audio_path or (typed_text or "").strip() or snapshot)
    if not has_input:
        yield (gr.update(), chat, convo, profile, profile, notes, board_ops,
               gr.update(), gr.update(),
               *([gr.update()] * (2 * N_CHIPS)))
        return

    user_label = (typed_text or "").strip() or ("🎙️ …" if audio_path else "🖼️ (my whiteboard)")
    if not prepared:
        chat.append({"role": "user", "content": user_label})
        chat.append({"role": "assistant", "content": "✏️ *composing the first clean panel…*"})
    question_for_context = user_label
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
        return (_payload(turn_id, voice_on, status, detail, sent_steps),
                chat, convo, profile, profile, notes, board_ops,
                gr.update(value=None), gr.update(value=""),
                *chips, *states)

    yield render(detail="Thinking…")

    seq = 0
    error = None
    print(f"[tutori] turn {turn_id}: starting engine", flush=True)
    try:
        for ev in ENGINE.run_turn(audio_path, typed_text, snapshot, convo, profile,
                                  notes, board_ops, pace, lesson_minutes, web_on, voice_on):
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
    return _prepare_request(
        chat, typed_text=START_LECTURE_PROMPT, snapshot=snapshot
    )


def prepare_replay_lecture(chat, convo, board_ops):
    # Replay from a clean conversation and whiteboard, using the same starter lesson.
    fresh_chat, request, _ = _prepare_request([], typed_text=START_LECTURE_PROMPT)
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


def compare_tts_voices():
    """Generate the same brief Arabic preview with each supported voice."""
    phrase = (
        "عندما ترسل رسالة عبر شبكة واي فاي، تُقسَّم البيانات إلى حزم صغيرة. "
        "ينقلها الموجّه إلى وجهتها، ثم يعيد الجهاز المستقبل ترتيبها."
    )
    previews = []
    for voice in ("marin", "cedar"):
        audio_b64, _duration = ENGINE.synthesize(phrase, voice=voice)
        previews.append(_save_tts_preview(audio_b64))
    if not any(previews):
        return None, None, "تعذّر إنشاء المعاينة. راجع مفتاح OpenAI API وسجلّ التشغيل."
    return (*previews, "اسمع نفس الجملة بالصوتين، ثم اختر الصوت الذي تفضّله للمحاضرات.")


def set_tts_voice(voice):
    return ENGINE.set_tts_voice(voice)


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

    payload_box = gr.Textbox(
        visible=True, elem_id="tutori-payload", elem_classes="payload-sink",
        show_label=False, container=False,
    )
    snap_box = gr.Textbox(visible=False)

    with gr.Row(elem_classes="demo-lecture-cta"):
        gr.HTML(HEADER_HTML, elem_id="tutori-header-shell")
        start_lecture_btn = gr.Button(
            "ابدأ المحاضرة ←", variant="primary", elem_id="demo-start-lecture-btn"
        )
        replay_btn = gr.Button(
            "↻ إعادة من البداية", elem_id="replay-btn", size="sm"
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
                    1, 10, value=3, step=1, label="مدة المحاضرة بالدقائق",
                    info="ثلاث دقائق افتراضيًا؛ ويمكن اختيار مدة من دقيقة إلى عشر دقائق.",
                )
                web_on = gr.Checkbox(False, label="🔎 البحث على الإنترنت عند الحاجة")
                voice_on = gr.Checkbox(
                    True,
                    label="🔊 تشغيل الردود الصوتية",
                )
                if hasattr(ENGINE, "set_tts_voice"):
                    voice_choice = gr.Radio(
                        choices=[("Marin", "marin"), ("Cedar", "cedar")],
                        value=getattr(ENGINE, "TTS_VOICE", "marin"),
                        label="صوت المحاضر",
                        info=("اختر الصوت بعد الاستماع إلى معاينة الجملة العربية نفسها. "
                              "المقارنة ترسل طلبَي صوت إلى OpenAI API."),
                    )
                    compare_voices_btn = gr.Button(
                        "▶ قارن Marin وCedar بالعربية", size="sm"
                    )
                    with gr.Row():
                        marin_preview = gr.Audio(
                            label="Marin", type="filepath", interactive=False,
                            show_download_button=False,
                        )
                        cedar_preview = gr.Audio(
                            label="Cedar", type="filepath", interactive=False,
                            show_download_button=False,
                        )
                    compare_status = gr.Markdown()
                    voice_choice.change(
                        fn=set_tts_voice,
                        inputs=voice_choice,
                        outputs=voice_choice,
                        queue=False,
                        show_progress="hidden",
                    )
                    compare_voices_btn.click(
                        fn=compare_tts_voices,
                        inputs=None,
                        outputs=[marin_preview, cedar_preview, compare_status],
                        queue=True,
                        show_progress="minimal",
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
