# NOVA V1 — Execution Checklist

Legend: [x] implemented or deployed; [ ] not yet implemented or not yet verified in a live browser/device.

## Core meeting experience
- [x] Character-first meeting screen; removed camera, face-recognition, guest and command-dashboard demos.
- [x] Voice-first controls with optional text entry and conversation transcript.
- [x] Soly (blue), Soleen (pink), dark/gold NOVA identity.
- [x] Dedicated 3D character mount.
- [x] Original procedural full-body 3D robot scene implemented in `nova-3d.js` using Three.js primitives (not an imported GLB asset).
- [ ] Verify Three.js CDN loading, rendering, resizing and performance on Android Chrome and desktop.
- [ ] Replace the procedural prototype with a polished authored/licensed character model and richer facial/body animation.

## Supabase connection and authentication
- [x] Configure the public Supabase project URL and publishable key in the client; no service-role key is exposed.
- [x] Add owner email/password sign-in through Supabase Auth.
- [x] Create NOVA-owned provider/model/preference tables with RLS enabled.
- [x] Add owner-scoped SELECT policies for provider and model metadata.
- [x] Add Vault-backed secret storage/retrieval SQL functions callable only by service_role.
- [x] Deploy `nova-ai` Edge Function (active version 3); it verifies the bearer session with Supabase Auth.
- [x] Commit the deployed Edge Function source and the applied SQL migration history under `supabase/`.
- [x] Add multiple provider-key records, server-side model discovery, per-model enable/disable, and automatic fallback across enabled models.
- [x] Connect voice/text chat requests to the authenticated `nova-ai` endpoint.
- [ ] Sign in with the owner account in the live app and test the complete add-key → sync-models → enable-model → chat flow.
- [ ] Test a real provider key and confirm successful model fallback with intentionally invalid/disabled models.
- [ ] Persist conversations and owner memory in the database; current chat history is in page memory only.
- [ ] Add safe provider-key deletion/rotation and Vault secret cleanup.
- [ ] Add manual preferred-model selection and model-specific capability filters.
- [ ] Enable Supabase leaked-password protection in Auth settings.

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
- [x] Edge Function checks the signed-in user and scopes provider/model operations to that user.
- [ ] Run live integration tests for authentication, CORS, Vault writes/reads, provider model discovery and chat.
- [ ] Test RLS isolation with the owner session and an unauthenticated session.
- [ ] Verify the GitHub Pages deployment and browser console on Android Chrome.
- [ ] Run the Supabase security advisor again after the remaining cleanup and Auth setting changes.

## Repository operating rules
- Work only on the existing `main` branch and one existing repository copy.
- Never create branches, forks, clones, mirrors, worktrees, or duplicate repositories without Islam's prior explicit permission.
- Never delegate work to another agent on another branch/copy.
- Do not claim a test, build, deployment, or live integration succeeded unless it was actually verified.
- Do not destructively delete existing Supabase resources without an itemized dependency review and explicit owner approval.
