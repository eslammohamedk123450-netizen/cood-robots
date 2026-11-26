# NOVA Supabase Integration and Security

## Project
- Supabase project ref: `razvryvazmqvvqkzetuo`
- Region: `eu-west-1`
- Project URL: `https://razvryvazmqvvqkzetuo.supabase.co`
- Client uses only the public publishable key. This key is public by design and is not an admin secret.
- Never put the service-role key or provider API keys in frontend code, browser storage, Git or logs.

## Authentication and owner allowlist
- NOVA allows one existing Auth user ID: `f980820b-f59d-453c-9df8-2b9afc695c74`.
- The frontend uses `signInWithPassword` and persists the session with the Supabase JS client.
- The UI has no sign-up flow. The owner enters the email and password associated with the existing account.
- The frontend checks the owner user ID. The `nova-ai` Edge Function independently calls `auth.getUser(token)`, rejects anonymous identities and checks the same owner user ID.
- RLS policies on NOVA provider keys, models, preferences and memories require the owner identity.
- Other Auth identities receive HTTP 403 from `nova-ai`, even if a user manages to create an Auth account.
- **Manual dashboard action still required:** disable new user sign-ups and anonymous sign-ins under Supabase Authentication settings. This prevents unnecessary accounts from being created at the Auth service level.
- Supabase leaked-password protection is currently reported disabled by the Security Advisor. Enable it if available on the current project plan.

## NOVA database tables
- `public.nova_api_keys`: provider label, base URL, active state and Vault secret reference. Raw API keys are not stored here.
- `public.nova_api_models`: discovered model IDs, display names and per-model enabled state.
- `public.nova_ai_preferences`: future automatic/manual routing preference and selected model.
- `public.nova_memories`: owner-scoped long-term memory schema. The table exists but is not yet connected to chat.
- `public.nova_rate_limit_buckets`: server-side per-user/action rate-limit counters. RLS is enabled, no client grants/policies exist, and only the privileged server-side function accesses it.
- All NOVA data tables have RLS enabled. Provider/model metadata is owner-readable; provider-key writes and secret operations are performed by the authenticated Edge Function using its server-side service role. The memory table has no direct client grants.

## Vault and privileged functions
- `public.nova_store_api_secret(text,text)` stores credentials using `vault.create_secret`.
- `public.nova_read_api_secret(uuid)` reads from `vault.decrypted_secrets`.
- Both are SECURITY DEFINER with an empty search_path. EXECUTE is revoked from PUBLIC, anon and authenticated; only service_role and postgres retain EXECUTE.
- `public.nova_consume_rate_limit(uuid,text,integer,integer)` atomically consumes a rate-limit slot. It is SECURITY DEFINER with an empty search_path, and EXECUTE is restricted to service_role and postgres.
- The Edge Function never returns raw provider keys to the browser.

## Edge Function: `nova-ai`
- Active deployed version: **11**.
- Source: `supabase/functions/nova-ai/index.ts`.
- Platform JWT verification is disabled because the function explicitly validates the bearer token with Supabase Auth before any action.
- The function rejects all callers except the single owner Auth user ID and rejects anonymous users.
- CORS is restricted to the GitHub Pages production origin.
- Request bodies are streamed with a 400 KB maximum.
- Chat input is limited to 24 messages, 12,000 characters per message, 200,000 total message characters, one leading system message and a final user message.
- Provider request redirects are disabled and provider calls have timeouts.
- Standard provider presets are restricted to official API hosts:
  - Gemini: `generativelanguage.googleapis.com`
  - OpenRouter: `openrouter.ai`
  - OpenAI: `api.openai.com`
  - Anthropic: `api.anthropic.com`
- Custom OpenAI-compatible endpoints must use HTTPS and reject obvious local/private address forms. A custom domain is still a trust decision by the owner; do not enter an untrusted endpoint.
- Per-action limits per owner per 60-second window:
  - `chat`: 20
  - `add_provider`: 5
  - `sync_models`: 10
  - `toggle_model`: 30
  - `list`: 60

## Frontend security and quality
- `index.html` contains a restrictive Content Security Policy for the app's scripts, styles, fonts and Supabase connection.
- The Supabase client is not exposed through a global debug object.
- Dynamic conversation text is inserted with text nodes; no user-supplied HTML rendering is used.
- Provider keys are not stored in LocalStorage/sessionStorage.
- `npm test` runs `node --check` for `app.js` and `nova-3d.js`, plus static repository smoke checks.
- GitHub Actions requires the quality-check job to pass before building and deploying GitHub Pages.

## Current verification state
- Edge Function version 11 is active.
- Supabase SQL migration history includes the owner-only schema and rate-limit migration.
- RLS is enabled on every table in the public schema; no public table was found with RLS disabled.
- Four NOVA data tables have explicit owner-only policies. The rate-limit bucket table intentionally has no client policy or client grants.
- The three pre-existing SULY tables `engine_runtime_catalog`, `hermes_delegation_outbox` and `project_file_revisions` have RLS enabled but no policies. They are fail-closed for client roles; they were not changed because they belong to shared legacy infrastructure.
- Security Advisor still reports leaked-password protection disabled.
- No provider key/model rows exist yet, so real provider discovery and chat have not been tested.
- The owner-only memory table is not yet wired into chat.
- Browser E2E testing on Android Chrome and desktop remains outstanding.

## Existing SULY resources
The Supabase project contains pre-existing SULY routing, model synchronization, memory, conversation and task/agent infrastructure. Do not delete these resources in bulk. Review dependencies and obtain explicit owner approval before destructive cleanup.
