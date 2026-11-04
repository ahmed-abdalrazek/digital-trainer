# Graph Report - digital-trainer  (2026-11-04)

## Corpus Check
- 58 files · ~52,576 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 20 file(s) not represented in the graph (top: .woff2 9, .css 7, (none) 3)

## Summary
- 644 nodes · 1291 edges · 38 communities (31 shown, 7 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 138 edges (avg confidence: 0.85)
- Token cost: 347,209 input · 0 output

## Community Hubs (Navigation)
- Product Docs & Requirements
- Board Quality Checks
- Admin Demo UI
- Board Canvas Renderer
- Build Week Slides
- Gradio App Endpoints
- Preparation Workflow Tests
- Platform Admin Pages
- Engine API & Audio
- Collision Layout Pass
- Lesson Store Persistence
- Engine Turn Tests
- Agent Planning & Search
- Student Platform Pages
- Share Card & Screenshots
- Mock Engine
- Lesson Store Tests
- Step Prep & TTS
- Lesson Generation & Parsing
- Preparation API Handlers
- Prepared Turn Playback
- Whiteboard Architecture Concepts
- Build Week Stack
- Fine-tuned Board Models
- Turn Pipeline & Streaming
- Hackathon Origins
- Agent Traces
- Op Sanitization
- TTS Preview Storage
- Board Model Prompt
- Arrow/Callout Trimming
- Streaming JSON Parser
- Quality Workspace
- Small-Model Coach
- Pace Dial

## God Nodes (most connected - your core abstractions)
1. `Digital Trainer Platform PRD` - 29 edges
2. `run_turn()` - 22 edges
3. `improve_step_board()` - 20 edges
4. `layout_pass()` - 20 edges
5. `WorkflowError` - 17 edges
6. `heading()` - 16 edges
7. `render()` - 16 edges
8. `renderOp()` - 16 edges
9. `Requirements Traceability Matrix` - 16 edges
10. `_template()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Tutori Loopback Binding` --rationale_for--> `Tutori Live Lecture Hall`  [INFERRED]
  docs/DEMO_LIMITATIONS.md → README.md
- `Main Demo Shell (index.html)` --implements--> `RTL Government Institutional Visual Direction`  [INFERRED]
  index.html → docs/DESIGN_SPEC.md
- `Static HTML/CSS/JS Demo Choice` --rationale_for--> `Main Demo Shell (index.html)`  [INFERRED]
  docs/PROJECT_AUDIT.md → index.html
- `Demo Limitations` --references--> `Tutori Live Lecture Hall`  [INFERRED]
  docs/DEMO_LIMITATIONS.md → README.md
- `Project Context` --references--> `Tutori Live Lecture Hall`  [INFERRED]
  docs/PROJECT_CONTEXT.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Codex Onboarding Document Set** — docs_agents_codex_instructions, docs_codex_start_prompt_codex_start_prompt, docs_codex_tasks_codex_task_plan, docs_prd_digital_trainer_platform, docs_project_context_project_context, docs_design_spec_admin_demo_design_spec [EXTRACTED 1.00]
- **Tutori Lesson Review and Publish Flow** — readme_tutori_live_lecture, readme_networking_101_lesson, readme_lesson_preparation_store, readme_openai_api [EXTRACTED 1.00]
- **Production Readiness Gates** — docs_agents_server_side_permission_enforcement, docs_prd_acceptance_criteria, docs_project_audit_p0_gaps, docs_prd_audit_log, docs_prd_organizational_data_isolation [INFERRED 0.85]
- **Original ZeroGPU Four-Model Stack** — tutori_readme_gemma_4_12b, tutori_readme_minicpm5_1b, tutori_readme_higgs_audio_v2, tutori_readme_whisper_large_v3_turbo [EXTRACTED 1.00]
- **Model Proposes, Engine Disposes Drawing Pipeline** — tutori_readme_structured_whiteboard_operations, tutori_docs_field_notes_composite_op_vocabulary, tutori_readme_collision_aware_layout_engine, tutori_readme_diagram_specialist, tutori_readme_canvas_renderer [INFERRED 0.85]
- **Build Week OpenAI/ElevenLabs API Stack** — tutori_readme_gpt_6_luna, tutori_readme_gpt_transcribe, tutori_readme_elevenlabs_multilingual_v2 [EXTRACTED 1.00]
- **Plan/Teach/Coach/Draw roles served by GPT-5.6 Luna** — tutori_docs_demo_assets_agent_stack_plan_role, tutori_docs_demo_assets_agent_stack_teach_role, tutori_docs_demo_assets_agent_stack_coach_role, tutori_docs_demo_assets_agent_stack_draw_role, tutori_docs_demo_assets_agent_stack_gpt_5_6_luna [EXTRACTED 1.00]
- **Codex rebuild workflow: migrate, diagnose, rebuild, verify & ship** — tutori_docs_demo_assets_codex_rebuild_migrate_step, tutori_docs_demo_assets_codex_rebuild_diagnose_step, tutori_docs_demo_assets_codex_rebuild_rebuild_step, tutori_docs_demo_assets_codex_rebuild_verify_ship_step [EXTRACTED 1.00]
- **Whiteboard lesson demos of the voice-first tutor** — tutori_docs_demo_assets_loss_current, tutori_docs_demo_assets_sky_blue_current, tutori_static_tutori_share_voice_first_whiteboard_tutor [INFERRED 0.85]
- **Model/provider branding variants (OpenAI API vs OpenRouter GPT-5.6 Luna)** — tutori_static_tutori_share_openai_api_badge, tutori_static_tutori_share_gpt56_luna_openrouter_badge, tutori_docs_demo_assets_sky_blue_current_model_stack_badges [INFERRED 0.75]

## Communities (38 total, 7 thin omitted)

### Community 0 - "Product Docs & Requirements"
Cohesion: 0.06
Nodes (60): Codex Instructions (AGENTS), Codex Start Prompt, Codex Task Plan (Phases 0-4), Demo Completion Criteria, Priorities P0-P3, Demo Limitations, Illustrative Role Switcher (not authorization), Local Demo CSV Export (+52 more)

### Community 1 - "Board Quality Checks"
Cohesion: 0.08
Nodes (30): check_final_ops(), fuzz(), rop(), rtext(), load_engine_ns(), render_bboxes(), simulate_lesson(), _binary_search() (+22 more)

### Community 2 - "Admin Demo UI"
Cohesion: 0.11
Nodes (45): attendance(), audit, closeModal(), content(), contentAudit, contentRows, courseDetail(), courseRecords (+37 more)

### Community 3 - "Board Canvas Renderer"
Cohesion: 0.11
Nodes (42): actx(), b64ToBuf(), bake(), bindPen(), bindSubmissionBridge(), bindToolbar(), catmullRom(), clearAgent() (+34 more)

### Community 4 - "Build Week Slides"
Cohesion: 0.08
Nodes (33): Coach Role, Draw Role, GPT-5.6 Luna (low reasoning, OpenRouter), GPT Audio Mini (calm, validated narration), OpenRouter (one routed model team), Plan Role, Agent Stack PNG Render, Agent Stack Slide (Build Week Architecture) (+25 more)

### Community 5 - "Gradio App Endpoints"
Cohesion: 0.09
Nodes (14): admin_dashboard(), apply_coach_suggestions(), lesson_preparation_audio_file(), lesson_preparation_state(), prepare_audio_turn(), prepare_board_turn(), prepare_chip_turn(), prepare_demo_lecture() (+6 more)

### Community 6 - "Preparation Workflow Tests"
Cohesion: 0.12
Nodes (6): _board(), normalize_state(), publish(), review_section(), PreparationWorkflowTests, SavedBoardGenerationTests

### Community 7 - "Platform Admin Pages"
Cohesion: 0.21
Nodes (22): attendancePage(), dashboard(), detailModal(), exportCsv(), filterOptions(), formFor(), genericPage(), handleAction() (+14 more)

### Community 8 - "Engine API & Audio"
Cohesion: 0.10
Nodes (7): _api_key(), _encode_browser_audio(), _headers(), _load_local_env(), openai_chat_stream(), set_tts_voice(), transcribe()

### Community 9 - "Collision Layout Pass"
Cohesion: 0.11
Nodes (15): _clamp_pt(), _free_spot(), layout_pass(), bbox_at(), fit_x(), lbl_bbox(), lbl_fit(), _move_callout_ring_to_shape_edge() (+7 more)

### Community 10 - "Lesson Store Persistence"
Cohesion: 0.24
Nodes (13): _connect(), get_published_sections(), get_published_steps(), get_workflow(), initialize(), _now(), publish(), save_published_audio() (+5 more)

### Community 11 - "Engine Turn Tests"
Cohesion: 0.14
Nodes (4): _friendly_generation_error(), EngineTurnTests, lesson_json(), GenerationErrorTests

### Community 12 - "Agent Planning & Search"
Cohesion: 0.12
Nodes (13): analyze_board(), build_agent_plan(), _build_messages(), _duration_spec(), _extract_urls(), _fetch_page(), _forced_search_queries(), known_quick_fallback() (+5 more)

### Community 13 - "Student Platform Pages"
Cohesion: 0.28
Nodes (17): assignmentsPage(), attendancePage(), classroomPage(), courseDetailPage(), coursesPage(), courseTile(), escapeHtml(), filteredCourses() (+9 more)

### Community 14 - "Share Card & Screenshots"
Cohesion: 0.15
Nodes (17): Demo screenshot: Loss whiteboard lesson, Whiteboard toolbar (color pens, eraser, undo, clear mine/all), Loss: a measure of wrongness (input -> prediction -> compare -> loss -> updated model), Demo screenshot: Why the Sky Is Blue lesson (full app UI), Tutori app layout: board, transcript, voice recorder, text input, suggestion stickies, Board caption with Socratic quick-check question, Model stack badges: OpenRouter, GPT-5.6 Luna, Luna whiteboard vision, Whisper Large V3 Turbo, GPT Audio Mini voice, Rayleigh scattering lesson diagram (sun, air molecule, eye, wavelength curve) (+9 more)

### Community 15 - "Mock Engine"
Cohesion: 0.25
Nodes (5): _demo_lesson(), run_turn(), _step(), _templated_lesson(), _tone_audio()

### Community 16 - "Lesson Store Tests"
Cohesion: 0.16
Nodes (7): _approve_demo_section(), _preparation_outputs(), _publish_demo_lesson(), _reject_demo_section(), approve_current(), reject_current(), LessonStoreTests

### Community 17 - "Step Prep & TTS"
Cohesion: 0.18
Nodes (9): _apply_controls(), dedup_ops(), _op_bbox(), _op_sig(), _rebuild_layout(), prepare_step(), synthesize(), _target_bboxes() (+1 more)

### Community 18 - "Lesson Generation & Parsing"
Cohesion: 0.15
Nodes (8): coach_update(), cpm_generate(), decide_search(), extract_lesson_steps(), _first_json_object(), llm_generate(), parse_lesson_json(), render_board()

### Community 19 - "Preparation API Handlers"
Cohesion: 0.24
Nodes (8): _generate_lesson_audio(), _generate_lesson_board(), lesson_preparation_approve(), lesson_preparation_audio(), lesson_preparation_publish(), lesson_preparation_reject(), tutori_social_metadata(), WorkflowError

### Community 20 - "Prepared Turn Playback"
Cohesion: 0.20
Nodes (7): _payload(), _preview_demo_section(), run_prepared_turn(), run_turn(), render(), _save_lesson_audio(), _track_board()

### Community 21 - "Whiteboard Architecture Concepts"
Cohesion: 0.22
Nodes (9): Layout Fuzz Harness, Zero-Tolerance Layout Engine, System Packages (libsndfile1, ffmpeg), Hand-Drawn Canvas Renderer, Collision-Aware Layout Engine, Deterministic Diagram Specialist, Native Scaled Graph Primitive, Tutori Whiteboard Tutor (+1 more)

### Community 22 - "Build Week Stack"
Cohesion: 0.29
Nodes (10): GPT Audio Mini narration, Build Week Demo Narration Script, OpenRouter access (per demo script), Codex Engineering Environment, ElevenLabs Multilingual v2 TTS, gpt-6-luna (GPT-5.6 Luna) tutor model, gpt-transcribe microphone transcription, data/lesson_preparation.sqlite3 (+2 more)

### Community 23 - "Fine-tuned Board Models"
Cohesion: 0.32
Nodes (7): ZeroGPU Hardware Constraints, Nemotron ASR (rejected), tutori-board-gemma LoRA Artist, TUTORI_BOARD_MODEL flag, tutori-board-nemotron LoRA Artist, tutori-whiteboard-lessons Dataset, Whisper Large V3 Turbo

### Community 24 - "Turn Pipeline & Streaming"
Cohesion: 0.29
Nodes (6): DuckDuckGo Keyless Web Search, Agent-Controlled Expanding Whiteboard, Lesson Step Streaming, How a Turn Works (turn pipeline), Python Requirements (gradio 5.50.0, requests, ddgs, truststore), Trace Event Types (status, step, final)

### Community 25 - "Hackathon Origins"
Cohesion: 0.29
Nodes (7): Field Notes: Building Tutori, Ask Tutori About the Board (vision), Gemma 4 12B Teacher + Vision, HF Build Small Hackathon, Higgs Audio v2 Voice, Original ZeroGPU Hackathon Submission, Belinda Voice Reference Transcript

### Community 26 - "Agent Traces"
Cohesion: 0.29
Nodes (7): Gradio :has() CSS Selector Gotcha, Teacher's Studio Design System (Off-Brand), Merit Badges Claimed, Agent Traces (Sharing is Caring), trace-gradient-descent.json, trace-rockets-orbit.json, trace-space-exploration.json

### Community 27 - "Op Sanitization"
Cohesion: 0.33
Nodes (4): _fix_text(), _merge_text_groups(), _normalize_op(), sanitize_step()

### Community 30 - "Arrow/Callout Trimming"
Cohesion: 0.40
Nodes (3): _cap_arrow(), _cap_callout(), _stroke_len()

### Community 32 - "Quality Workspace"
Cohesion: 0.83
Nodes (3): mountCaseFilters(), renderQuality(), setQualityNav()

### Community 33 - "Small-Model Coach"
Cohesion: 0.83
Nodes (3): Learner Profile (BrowserState), MiniCPM5 1B Research Planner + Study Coach, Sticky-Note Follow-up Questions

## Ambiguous Edges - Review These
- `OpenAI Build Week Edition` → `OpenRouter access (per demo script)`  [AMBIGUOUS]
  tutori/docs/build-week-demo-script.txt · relation: conceptually_related_to
- `OpenAI API / Direct API Connection badge` → `GPT-5.6 Luna / Powered by OpenRouter badge (PNG only)`  [AMBIGUOUS]
  tutori/static/tutori-share.png · relation: conceptually_related_to

## Knowledge Gaps
- **40 isolated node(s):** `lesson_preparation.sqlite3 Review/Publish Store`, `OpenAI API`, `ElevenLabs API`, `Priorities P0-P3`, `Demo Completion Criteria` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 159 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `improve_step_board()` connect `Board Quality Checks` to `Engine API & Audio`, `Engine Turn Tests`, `Agent Planning & Search`, `Mock Engine`, `Step Prep & TTS`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `layout_pass()` (e.g. with `bbox_at()` and `lbl_bbox()`) actually correct?**
  _`layout_pass()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `lesson_preparation.sqlite3 Review/Publish Store`, `OpenAI API`, `ElevenLabs API` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Product Docs & Requirements` be split into smaller, more focused modules?**
  _Cohesion score 0.05698778833107191 - nodes in this community are weakly interconnected._
- **Why does `review_section()` connect `Preparation Workflow Tests` to `Lesson Store Persistence`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `OpenAI Build Week Edition` and `OpenRouter access (per demo script)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `OpenAI API / Direct API Connection badge` and `GPT-5.6 Luna / Powered by OpenRouter badge (PNG only)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._