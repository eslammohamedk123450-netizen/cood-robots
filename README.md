# NOVA — Your Personal Companion

NOVA is a private, voice-first digital companion centered on Solina, its only supported character: a friendly Egyptian female assistant with one consistent identity and voice.

## Android companion app
- A minimal Android WebView shell loads the published Solina experience and exposes a restricted native bridge for scheduled tasks.
- Reminders and wake-up alarms are stored locally on the device and scheduled with Android AlarmManager; pending schedules are restored after reboot or time-zone changes.
- Exact-alarm, notification and (on Android 14+) full-screen alarm access must be granted by the device owner. The first debug APK is produced by the `android-apk.yml` workflow as a downloadable workflow artifact.
- The Android shell requires an internet connection to load the current GitHub Pages app; it is intentionally kept small and does not bundle a second copy of the website.

## Current experience
- Character-first meeting screen with optional text entry and voice controls.
- Conversations and individual user/assistant messages are persisted to the owner's Supabase account, with conversation list, reopen and archive search.
- Historical recall supports semantic keyword matching, relative dates in `Africa/Cairo`, and requested-hour filtering.
- Explicitly saved personal notes are timestamped and categorized as projects, decisions, open tasks, reference numbers or general notes, using the existing personal-items table.
- Settings include persona selection, owner display name and AI provider configuration.
- Solina's animated audio orb and live speech-reactive waveform are the active character presentation; no separate 3D mannequin renderer is part of the current app.
- Camera, face recognition, guest management and device-control demos are excluded from V1.

## Owner-only access
- The app uses persistent Supabase email/password authentication for the one pre-created owner account.
- The frontend checks the immutable Supabase Auth user ID; the Edge Function independently verifies the bearer token and the same owner ID.
- Other authenticated identities are rejected by the backend with HTTP 403. There is no invite-code issuance system.
- The browser session persists on the same browser profile. Clearing site data or changing browser/device requires signing in again.
- The repository is public, so source code is visible. The public Supabase publishable key is intentionally client-side; service-role and provider API secrets are not.

## Supabase and AI providers
- Provider API keys are sent over HTTPS to the authenticated Edge Function and stored in Supabase Vault, never in browser storage or Git.
- Supported presets: Gemini, OpenRouter, OpenAI, Anthropic and custom OpenAI-compatible endpoints.
- Official provider presets are restricted to their official API hostnames.
- Custom endpoints accept a user-supplied HTTPS host. Only use a domain you trust; the API key is sent to that host.
- Model discovery, per-model enable/disable and automatic fallback are handled server-side.
- The `nova-ai` Edge Function validates owner identity, request size and message structure, and applies per-action rate limits.

## Quality checks
- `npm test` runs Node syntax checks for the frontend modules and repository smoke tests.
- GitHub Actions runs these checks before the Pages artifact is built and deployed.
- The Edge Function is deployed from `supabase/functions/nova-ai/index.ts`; SQL migrations are recorded under `supabase/migrations/`.

## Run locally
Serve the repository over localhost:
```sh
python3 -m http.server 4173
```
Open `http://localhost:4173`. This is a static UI preview only: the Edge Function CORS policy allows the production GitHub Pages origin, so local preview cannot use owner authentication or AI APIs unless a deliberate development origin is added. Microphone access requires HTTPS or localhost and browser permission. Three.js and the Supabase client load from external CDNs, so those features need internet access.

## Known limitations
- New user sign-ups still need to be disabled manually in Supabase Auth settings. The NOVA backend already rejects all identities except the owner.
- Supabase's leaked-password protection is currently disabled; enable it if the project plan exposes the setting.
- No real provider key is currently stored in NOVA, so live model discovery and AI chat have not been end-to-end tested.
- Browser-based Android/desktop UI testing, microphone behavior and real-provider testing remain outstanding.
- Long-term memory is intentionally split by purpose: full transcript in `nova_conversations`/`nova_messages`, explicit notes and tasks in `nova_personal_items`, and owner profile context in `nova_owner_profile_memory`. It is not a duplicate memory database.
- Archive recall is keyword-based rather than vector/embedding search; ambiguous matches are presented as candidates. Full browser/device end-to-end tests and real provider-key tests remain outstanding.
- The 3D robot is a procedural prototype, not the final authored/licensed character.
- Provider-key deletion/rotation and Vault cleanup are not implemented yet.

## Security and audit
- [Security audit and remaining actions](SECURITY_AUDIT.md)
- [Supabase integration and security details](NOVA_SUPABASE.md)
- [Execution checklist](TODO.md)
- [Development plan](plan.md)
- Master vision: `NOVA_MASTER_VISION.md`
- V1 scope: `NOVA_V1_SCOPE.md`
- Execution rules: `NOVA_EXECUTION_RULES.md`
- Agent rules: `AGENTS.md`

## Supabase resource preservation
The existing Supabase project also contains older SULY AI routing, model synchronization, memory, conversation and agent infrastructure. Do not bulk-delete these resources. Review dependencies and obtain explicit owner approval before destructive cleanup.


## Adaptive agent orchestration

- Simple conversational requests use one enabled model to preserve latency and API credits.
- Complex research, planning, coding, comparison and multi-step requests can launch two independent enabled models concurrently with different roles (analysis/planning and practical solution/verification).
- When both workers succeed, the primary configured model synthesizes their outputs into one answer. If one worker fails, the surviving worker can still answer; if parallel execution fails, the normal single-model fallback path remains available.
- The response includes internal diagnostic fields `agent_mode` and `agents_used`; timing is logged without exposing provider credentials.
- This is a bounded multi-model reasoning layer, not yet a general function-calling runtime. Live web search and local task/device actions continue through their existing app capabilities.
