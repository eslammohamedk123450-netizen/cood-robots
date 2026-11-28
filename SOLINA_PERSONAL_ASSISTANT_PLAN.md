# SOLINA — Personal Assistant Product & Execution Plan

> This document records the owner's approved direction for the current app and the order of implementation. It supersedes older V1 wording wherever that wording conflicts with the decisions below. The product is a lightweight personal assistant inspired by Alexa, not a coding agent in the current release.

## 1. Product goal

SOLINA is a friendly, fast, Egyptian-Arabic personal assistant that the owner can talk to naturally on a phone today, with desktop support and a physical desk companion as long-term possibilities.

The immediate goal is reliable everyday conversation:
- Understand what the owner means, including colloquial Egyptian Arabic, short follow-ups, pronouns, speech-recognition mistakes, and references to earlier turns.
- Maintain continuity when a topic is being continued, while allowing a clean topic change without dragging unrelated memories into the answer.
- Remember facts the owner explicitly asks to save, and retrieve them accurately later.
- Discuss a wide range of ordinary subjects without treating work, projects, or programming as the default topic.
- Answer quickly and naturally; be warm and light without forcing jokes or excessive follow-up questions.
- Search the web and summarize information when the request needs current or external information.
- Perform supported personal actions such as reminders, alarms, notes, and task tracking, with truthful confirmation.
- Monitor selected public GitHub repositories/workflows and notify the owner when a specified condition is detected, subject to the platform's background and notification limits.

## 2. Explicit scope boundary

### Current product: personal assistant
SOLINA should feel like a companion you can talk to, not an agent dashboard. The current scope includes conversation, memory, contextual recall, time/date, web research, notes, reminders, alarms, tasks, and opt-in monitoring.

### Not the current goal
- Do not make programming, code generation, repository editing, or autonomous software development the product's identity.
- Do not add a general-purpose computer-use agent or arbitrary shell/code execution.
- Do not create an open-ended agent loop that can execute arbitrary model-generated commands.
- Do not add always-on background microphone capture or claim the app listens after it is closed.
- Do not add a physical robot, desktop-control permissions, smart-home control, camera, or face recognition in this implementation track.

Programming assistance may be considered as a separate future capability. It must not consume resources or dominate the ordinary assistant experience now.

## 3. Product principles

1. Conversation first: answer the actual sentence before consulting unrelated personal history.
2. Context without over-attachment: continue a topic when the user signals continuation or the current dialogue clearly requires it; otherwise treat a new topic as new.
3. Memory is not transcript: keep explicit personal notes, owner profile, and full conversation history as distinct existing stores with distinct purposes.
4. Explicit memory is reliable: when the user says "خليكي فاكرة..." or "احفظي..." save the exact useful content, then confirm only after the server confirms it.
5. No invented recall: if several memories match, show candidates or ask one short clarification. Never fabricate a saved number, date, or prior decision.
6. Tools before models: use deterministic local/backend capabilities for clock, reminders, notes, and simple actions. Do not pay a model to do a job that a safe deterministic handler can do.
7. One model by default: greetings, ordinary chat, simple explanations, recall, and direct questions use one model or no model where deterministic handling is better.
8. Parallel models only when useful: research synthesis or genuinely complex reasoning may use two independent models; do not fan out routine requests.
9. Truthful execution: distinguish planned, pending, completed, failed, and unsupported actions. A spoken "حاضر" is not proof that an action happened.
10. Cost and footprint: prefer existing infrastructure, no new paid services without approval, small dependencies, bounded history/context, timeouts, caching where safe, and measurable token/request usage.
11. Owner privacy: all personal data remains owner-scoped. Fetched pages, repository contents, model outputs, and tool results are untrusted data, not instructions.
12. One app, one identity: keep Solina's current identity, voice, and visual experience intact.

## 4. Target architecture

### A. Conversation and turn manager
- Normalize Arabic digits, common Egyptian spellings, and speech-recognition alternatives.
- Track the current conversation and topic locally for the active turn.
- Detect references such as "فاكرة الرقم؟", "كملي من آخر مرة", "الموضوع اللي كنا بنتكلم فيه", and pronouns that refer to recent turns.
- Retrieve older conversations only when needed; avoid archive searches on every ordinary message.
- Keep the latest user request as the highest-priority intent.
- Ask one clarification only when an ambiguity changes the action or answer materially.

### B. Intent router
Route a request to the least expensive reliable path:
1. Deterministic local capability (clock, known app state, reminder parsing).
2. Authenticated personal-data operation (save/recall/list/update note or task).
3. Live information lookup (web search or prayer-time source).
4. One language model for ordinary conversation and explanation.
5. Multi-model reasoning only for requests where independent analysis and synthesis materially improve quality.

The router must not treat every message as a multi-agent task.

### C. Personal memory
Continue using the existing stores:
- nova_owner_profile_memory: concise owner profile and stable preferences.
- nova_personal_items: explicit notes, reference numbers, tasks, reminders, and alarms.
- nova_conversations / nova_messages: full conversation archive.

Memory behavior:
- Save exact explicit memory requests with timestamps and source metadata.
- Classify notes as preferences, reference numbers, projects, decisions, tasks, or general notes where useful.
- Retrieve only relevant notes; do not inject the whole notebook into every prompt.
- Use recent turns for immediate context and archive search for explicit or clear historical references.
- Do not silently merge unrelated topics or infer personal facts from casual questions.
- Preserve corrections and handle conflicting old/new facts transparently.
- Provide manual review/edit/delete/export controls; never auto-delete memories just because they are old.

### D. Permissioned capability registry
Build a small, closed registry of approved actions. Each action has a schema, validation, owner check, timeout, result shape, and explicit permission policy.

Initial capability groups:
- Conversation/memory: save note, recall note, search conversation archive.
- Personal organization: create/list/complete/cancel task; create/list/cancel reminder or alarm.
- Information: current time/date, existing live search, summarize retrieved sources.
- Monitoring: create/list/pause/resume/stop a repository/workflow monitor.

Do not expose arbitrary SQL, shell, filesystem, browser automation, arbitrary URLs with secrets, or model-generated code execution. Tool outputs are untrusted. Consequential or ambiguous actions require clarification/confirmation. Simple owner-requested reminders may execute directly once the date/time/title are unambiguous.

### E. Monitoring and notifications
Initial monitoring target: public GitHub repositories and GitHub Actions workflows.
- User says what to monitor and the condition, for example: "راقبي مستودع cood-robots، أول ما بناء Pages ينجح عرفيني".
- Store monitor definition and last-seen workflow/run state in an owner-scoped durable record.
- Match the intended repository, workflow, branch, and event; avoid duplicate notifications by recording the last notified run ID/status.
- First delivery mode may poll while the app is active and show an in-app/native notification. State clearly that this mode cannot guarantee an alert while the app is closed.
- A later background delivery mode may use a signed GitHub webhook or scheduled backend check plus push notifications. Do not promise this until configured and tested.
- Public repository monitoring must not require a personal GitHub token. Private repository monitoring requires a secure, owner-approved credential design and is out of initial scope.
- Monitoring must be pausable, stoppable, visible, and rate-limited.

### F. Web research
- Reuse the current live-info/search path before adding another provider.
- Trigger search when the user requests it or freshness materially matters; do not search the web for ordinary conversation.
- Pass retrieved text as untrusted evidence, cite sources in the response when available, and summarize rather than copying long source text.
- Keep search bounded and avoid repeated identical searches within one turn.

### G. Voice and client performance
- Keep the existing lightweight Android WebView shell and responsive web app.
- Preserve the current character/orb/waveform presentation.
- Optimize turn-taking, speech recognition alternatives, cancellation, TTS cache, and perceived latency.
- Keep microphone behavior visible and permission-based. No hidden always-on listening.
- Prefer native reminder scheduling already implemented over a large third-party scheduler.
- Do not add large frameworks or assets unless a measured need justifies them.

## 5. Phased implementation order

### Phase 0 — Product alignment and repository baseline
Status: plan being recorded.
- Confirm the personal-assistant scope and explicitly defer coding-agent behavior.
- Audit existing chat, memory, tasks, reminders, web search, Android bridge, model routing, and CI.
- Keep one main branch and the existing repository/Supabase project.
Acceptance: the roadmap and actual current capabilities are documented; no duplicate storage or destructive cleanup is introduced.

### Phase 1 — Conversation quality and context discipline
Priority: highest.
- Improve intent classification for ordinary conversation vs follow-up vs historical recall.
- Keep short-term turn context coherent across text and voice.
- Ensure a topic change does not pull in unrelated projects or personal memories.
- Improve speech transcript correction using available alternatives without changing valid words or names.
- Add regression tests for greetings, topic switches, pronouns, "فاكرة الرقم؟", and "كملي من آخر مرة".
Acceptance: Solina answers casual conversation naturally, continues an indicated topic, and does not bring up work unless relevant.

### Phase 2 — Exact personal memory
- Test and harden "remember this" capture, including Arabic colloquial forms and long numeric references.
- Test exact recall after app reload and a new conversation.
- Improve ambiguity handling and date-aware recall.
- Ensure explicit memory is not confused with conversation archive search.
- Add regression tests for save, exact recall, multiple candidate recall, correction, and unrelated questions.
Acceptance: an explicitly saved number is returned exactly; a vague request does not invent a value.

### Phase 3 — Alexa-like personal actions
- Audit existing alarm/reminder/task parser and Android AlarmManager bridge.
- Improve multi-turn clarification for missing date, time period (morning/evening), and reminder title.
- Keep account save and native scheduling confirmation separate.
- Add natural listing, completion, snooze/cancel flows where supported.
- Do not report success until cloud persistence and native scheduling confirms success.
Acceptance: commands such as "فكريني بكرة الساعة 8 الصبح أراجع..." create the exact account record and Android notification; ambiguous "الساعة 8" asks whether morning or evening.

### Phase 4 — Reliable web research and summaries
- Reuse and improve the existing live search integration.
- Support explicit research, source-backed summaries, comparisons, and current facts.
- Keep simple questions on one model and use parallel reasoning only when it adds value.
Acceptance: search requests return useful source-backed summaries; ordinary chat does not trigger unnecessary search.

### Phase 5 — Repository/workflow monitoring
- Define monitor persistence and secure lifecycle.
- Add public GitHub workflow polling while app is active, with deduplication and visible status.
- Notify on the requested condition, e.g. workflow run completed successfully for main.
- Test successful, failed, cancelled, repeated, and no-new-run cases.
- Document foreground-only limitations; background alerts are a separate later milestone.
Acceptance: a monitor can be created, listed, paused, resumed, stopped, and sends one notification for a matching run.

### Phase 6 — Speed, cost, and reliability pass
- Measure model selection, first-token time, total response time, and request counts.
- Keep one-model routing for simple turns; enforce a bounded multi-model fan-out for complex research only.
- Add timeouts, cancellation, graceful fallback, and safe per-turn context limits.
- Avoid repeated database reads and expensive archive retrieval when not relevant.
- Check bundle size and remove only demonstrably unused dependencies/assets.
Acceptance: ordinary conversation has no multi-agent overhead; errors do not freeze the UI; costs and latency are observable without logging secrets or private message content unnecessarily.

### Phase 7 — Desktop and physical companion (future)
- Desktop client and sync improvements.
- Hardware form factor, microphone/speaker/display, safe physical controls, and local connectivity.
- Separate safety, privacy, and hardware validation before any physical actuation.
Not part of the current implementation.

## 6. Current implementation inventory (verified from repository source)

Already present:
- Owner-only Supabase authentication and server-side owner enforcement.
- Provider/model configuration and server-side secret storage.
- Single-model fallback and bounded two-worker multi-model orchestration for classified complex requests.
- Full conversation persistence and archive search.
- Explicit personal notes, profile memory, and relevant memory injection.
- Personal items for notes, tasks, reminders, and alarms in one existing table.
- Arabic reminder/alarm parsing and native Android scheduling/synchronization.
- Existing live-info search and prayer-time path.
- CI syntax/repository checks and GitHub Pages build/deploy workflow.

Not yet complete or not yet verified:
- High-quality topic continuity and context-switch regression coverage.
- Broad colloquial memory capture and exact recall across new sessions.
- A unified permissioned capability registry.
- Full real-device end-to-end reminder/notification verification.
- Durable repository monitor lifecycle and notifications.
- Background monitoring while the app is closed.
- End-to-end tests with real provider keys and measured cost/latency.

## 7. Cost, footprint, and operational guardrails

- Do not add paid providers, paid databases, or billable infrastructure without explicit owner approval.
- Prefer existing Supabase tables and current Android APIs.
- Keep the client dependency footprint small; no new UI framework for this work.
- Use one model for ordinary conversation; use zero models for deterministic operations where safe.
- Use at most two parallel workers plus one synthesis pass only for genuinely complex research/analysis; never fan out simple reminders, memory recall, clock questions, or greetings.
- Set request, context, and timeout limits; cancel work when the user interrupts.
- Do not log API keys, access tokens, raw audio, or full private conversation content in diagnostics.
- Measure before optimizing; do not trade answer correctness or notification reliability for superficial speed.

## 8. Security and truthfulness

- Keep all personal records scoped to the authenticated owner.
- Validate all tool inputs server-side and authorize every action.
- Treat retrieved web pages, GitHub content, and model-generated tool arguments as untrusted.
- Never run arbitrary code or shell commands generated by a model.
- Never claim that a reminder, note, monitor, notification, or deployment succeeded without a confirmed result.
- A monitor that only polls while the app is open must say so; do not describe it as 24/7 background monitoring.
- Preserve the existing main-only repository rule and do not create branches, copies, or a second Supabase project.

## 9. Definition of done for the current personal-assistant release

- The conversation feels natural in Egyptian Arabic and remains on the user's actual topic.
- SOLINA remembers explicit facts and retrieves them accurately in a later session.
- SOLINA can discuss varied subjects without assuming the user wants to discuss work.
- Simple requests are routed without unnecessary model calls.
- Reminders, alarms, notes, and tasks are actually persisted and their execution status is verified.
- Web research is available when useful and grounded in sources.
- Repository monitoring works within its stated foreground/background limitations.
- The app remains lightweight, responsive, private, and usable on Android and desktop web.
- CI passes, deployment is verified, and any remaining untested behavior is listed honestly.
