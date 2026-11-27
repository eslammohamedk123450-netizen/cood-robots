# NOVA V1 — Execution Checklist

Legend: [x] implemented or deployed; [ ] not yet implemented or not yet verified in a live browser/device.

## Core meeting experience
- [x] Character-first meeting screen; removed camera, face-recognition, guest and command-dashboard demos.
- [x] Voice-first controls with optional text entry and conversation transcript.
- [x] Solina only; legacy dual-persona identity removed.
- [x] Dedicated 3D character mount.
- [x] Original procedural full-body 3D robot scene implemented in `nova-3d.js` using Three.js primitives (not an imported GLB asset).
- [ ] Verify Three.js CDN loading, rendering, resizing and performance on Android Chrome and desktop.
- [ ] Replace the procedural prototype with a polished authored/licensed character model and richer facial/body animation.

## Supabase connection and authentication
- [x] Configure the public Supabase project URL and publishable key in the client; no service-role key is exposed.
- [x] Replace anonymous auto-login with a persistent email/password login for the one existing owner account.
- [x] Add a full-screen owner login gate and a sign-out control in settings.
- [x] Reject every non-owner Auth identity in the UI and again in the backend; no invite codes are active.
- [x] Enforce the exact owner Auth user ID inside the Edge Function.
- [ ] Disable new user sign-ups in Supabase Auth settings (dashboard toggle still required).
- [x] Create NOVA-owned provider/model/preference tables with RLS enabled.
- [x] Add owner-only RLS policies for provider keys, models, preferences and the memory table.
- [x] Create the owner-scoped `nova_memories` table for future persistent memory.
- [x] Add Vault-backed secret storage/retrieval SQL functions callable only by service_role.
- [x] Deploy `nova-ai` Edge Function (active version 11); it verifies the bearer session with Supabase Auth.
- [x] Commit the deployed Edge Function source and the applied SQL migration history under `supabase/`.
- [x] Add multiple provider-key records, server-side model discovery, per-model enable/disable, and automatic fallback across enabled models.
- [x] Add provider dropdown presets for Gemini, OpenRouter, OpenAI, Claude/Anthropic and custom OpenAI-compatible endpoints.
- [x] Add native Gemini and Anthropic model-list and chat adapters.
- [x] Auto-discover models immediately after saving a new provider key.
- [x] Connect voice/text chat requests to the authenticated `nova-ai` endpoint.
- [ ] Test owner login and persistent session restoration in the deployed app.
- [ ] Disable Supabase sign-ups and verify a different email cannot create an account.
- [ ] Test the complete add Gemini key → auto-discover models → chat flow with a real key.
- [ ] Test real Gemini, OpenRouter, OpenAI and Anthropic keys where available; confirm model fallback with intentionally invalid/disabled models.
- [x] Enforce a single owner account at the Edge Function even if someone creates a separate Auth identity.
- [x] Create the owner-only persistent memory table with RLS.
- [x] Add a server-side per-action rate limiter for chat, provider creation, model sync, model toggles and provider listing.
- [ ] Connect the memory engine and UI to `nova_memories`; memory creation/retrieval is not yet wired into chat.
- [ ] Persist conversations and chat messages under the owner account; current chat history is still in page memory only.
- [ ] Add safe provider-key deletion/rotation and Vault secret cleanup.
- [ ] Add manual preferred-model selection and model-specific capability filters.
- [ ] Enable Supabase leaked-password protection in Auth settings.
- [ ] Disable anonymous sign-ins as well as public sign-ups.
- [ ] Enroll owner TOTP MFA and consider AAL2 enforcement for sensitive actions.


## Supabase cleanup and preservation
- [x] Inventory current public tables, row counts, RLS policies, Edge Functions, Storage bucket/object count, Auth user, migrations and Vault extension.
- [x] Preserve the existing Supabase project, owner Auth user and migration history.
- [x] Preserve potentially reusable AI router, model sync, memory and conversation infrastructure pending dependency review.
- [ ] Complete dependency mapping of all legacy SULY tables and 11 pre-existing Edge Functions.
- [ ] Remove only confirmed-unused legacy resources after a final itemized review.
- [ ] Remove the old `suly-media` bucket and its one object using the supported Storage API only after verifying the object is no longer needed.
- [ ] Review the three pre-existing RLS-enabled tables with no policies and decide their intended server-only access model.

## Security and verification
- [x] API provider secrets are never written to browser storage, source code, or GitHub.
- [x] Provider secrets are stored in Supabase Vault; secret read/write RPCs are restricted to service_role.
- [x] Edge Function verifies the signed-in owner and scopes provider/model operations to that owner.
- [x] Enforce bounded request bodies and strict chat message validation.
- [x] Restrict built-in provider presets to official API hostnames; custom endpoints are explicitly trust-based.
- [x] Restrict CORS to the production GitHub Pages origin.
- [x] Add a Content Security Policy to the frontend.
- [x] Add Node syntax and repository smoke checks to CI; Pages deploy waits for checks.
- [ ] Run live integration tests for authentication, CORS, Vault writes/reads, provider model discovery and chat.
- [x] Verify NOVA RLS policies and grants; no public-schema tables were found with RLS disabled.
- [x] Verify Vault RPC execute grants are limited to service_role/postgres.
- [ ] Perform browser E2E tests and real provider-key tests.
- [x] Verify the latest GitHub Actions syntax/smoke-check, build and Pages deployment jobs.
- [ ] Verify the live browser console and microphone/WebGL behavior on Android Chrome.
- [x] Re-run Supabase security and performance advisors after NOVA hardening.
- [ ] Enable leaked-password protection if available and disable public sign-ups.

## Repository operating rules
- Work only on the existing `main` branch and one existing repository copy.
- Never create branches, forks, clones, mirrors, worktrees, or duplicate repositories without Islam's prior explicit permission.
- Never delegate work to another agent on another branch/copy.
- Do not claim a test, build, deployment, or live integration succeeded unless it was actually verified.
- Do not destructively delete existing Supabase resources without an itemized dependency review and explicit owner approval.
