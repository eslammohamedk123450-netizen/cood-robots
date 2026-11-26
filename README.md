# NOVA — Your Personal Companion

NOVA is a private, voice-first digital companion. The first release focuses on a warm character-led meeting experience with Soly (blue) and Soleen (pink), not a command dashboard.

## Current experience
- Character-first meeting screen with optional text entry and voice controls.
- Conversation transcript is displayed locally in the current page session.
- Settings include persona selection, owner display name and AI provider configuration.
- An original procedural full-body 3D robot is rendered in `nova-3d.js`; the CSS character remains as a fallback.
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
- Conversation history is currently page-session memory only. The owner-only `nova_memories` table exists, but the memory engine is not connected to chat yet.
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
