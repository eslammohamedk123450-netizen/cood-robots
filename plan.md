# NOVA — Development Plan

The current V1 is a private, voice-first personal companion for Islam. The implementation checklist and exact status are in [TODO.md](TODO.md). The backend contract and security design are in [NOVA_SUPABASE.md](NOVA_SUPABASE.md).

## Current implementation phase

1. Keep the meeting screen focused on the character, microphone, optional typing and conversation transcript.
2. Use the existing Supabase project and owner Auth account; do not create another project or branch.
3. Store provider credentials only in Supabase Vault, never in browser storage or GitHub.
4. Let the owner add multiple OpenAI-compatible provider keys, discover models from each provider, enable/disable models, and route chat requests across enabled models.
5. Render an original procedural 3D full-body robot in the prepared character mount. This is a first 3D prototype, not the final authored character.
6. Keep conversation history in page memory until durable conversation persistence and memory controls are implemented.

## Current Supabase status

- Project URL and publishable client key are configured in the app.
- Owner email/password sign-in is connected to Supabase Auth.
- NOVA tables and RLS are deployed.
- Vault-only provider secret functions are deployed with service_role-only execution.
- Edge Function `nova-ai` is deployed; it validates the user session itself and exposes provider management, model discovery/toggles, and chat fallback.
- The live add-key/model-discovery/chat flow still needs to be exercised using the owner's session and a real provider key.

## Supabase cleanup policy

The existing Supabase project contains more than unused legacy data: the inventory revealed reusable AI routing, model synchronization, memory and conversation infrastructure. Do not mass-delete the existing tables or Edge Functions. Preserve the project, Auth account and migration history. Finish dependency mapping first, then remove only confirmed-unused resources with explicit owner approval. The old Storage bucket currently contains one object and must be handled through the supported Storage API, not direct SQL deletion.

## Explicitly excluded from this V1

No camera, face recognition, wake-word background service, alarms, desktop/device control, smart-home control, or physical robot movement.

## Repository operating rules

Work only on the existing `main` branch in this one repository. Do not create branches, clones, forks, mirrors, worktrees, or alternate copies without Islam's prior explicit permission. Never delegate work to another agent on another branch or copy. Record every task as completed only after implementation; keep live tests and unverified work unchecked.
