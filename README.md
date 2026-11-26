# NOVA — Your Personal Companion

NOVA is a private, voice-first digital companion for Islam. The first release focuses on a warm character-led experience with Soly (blue) and Soleen (pink), rather than a command dashboard.

## Current interface
- A single meeting screen centered on the character.
- Voice is the primary interaction; text entry is optional.
- Conversation transcript can be opened when needed.
- Settings support persona selection, owner display name, automatic anonymous device sessions, and multiple AI provider keys.
- Camera, face recognition, guest management, quick commands and device-control demos are excluded from V1.
- An original procedural full-body 3D robot is rendered inside `character3dMount`; the CSS character remains as fallback if WebGL/Three.js cannot load.

## Supabase integration
- Uses the existing Supabase project with an automatically persisted anonymous device session; no manual email/password sign-in in V1.
- Anonymous Sign-Ins must be enabled once in Supabase Authentication → Providers. The same browser profile retains its session; clearing browser data or switching devices creates a new identity.
- The client contains only the public project URL and publishable key.
- Provider API keys are sent to an authenticated Edge Function and stored in Supabase Vault, never in LocalStorage or GitHub.
- Provider presets include Google Gemini, OpenRouter, OpenAI, Claude/Anthropic and custom OpenAI-compatible endpoints. Base URLs are prefilled and editable.
- Gemini and Anthropic use native API adapters; OpenRouter, OpenAI and custom providers use OpenAI-compatible endpoints.
- Saving a key automatically triggers model discovery; individual models can be enabled/disabled.
- Chat requests try enabled models in sequence and return the first successful response.
- Full details and security boundaries: [NOVA_SUPABASE.md](NOVA_SUPABASE.md).

## Run locally
Serve the repository over localhost:
    python3 -m http.server 4173
Open http://localhost:4173. Microphone access requires HTTPS or localhost and browser permission. The 3D renderer and Supabase client load from external CDNs, so internet access is needed for those features.

## Current limitations and pending verification
- Anonymous Sign-Ins still need to be enabled once in the Supabase dashboard, then the automatic device session and real provider-key/model/chat flow need live testing.
- Anonymous sessions are convenient but do not prove the visitor is Islam; add device pairing or permanent authentication before sharing the public app URL widely.
- Three.js CDN loading, Android Chrome WebGL performance and speech recognition need device testing.
- Browser speech recognition support and Egyptian Arabic accuracy vary by browser/device.
- Browser speech synthesis is still the voice fallback, not the final natural voice service.
- Conversation history is currently in page memory only; persistent conversations and long-term memory are not yet implemented.
- The procedural robot is an initial 3D prototype, not the final polished authored/licensed character.
- Safe provider-key deletion/rotation and Vault cleanup are not yet implemented.

## Supabase cleanup
The existing project contains reusable SULY AI routing, model synchronization, memory, conversation and agent infrastructure. Do not bulk-delete these resources. Review dependencies and remove only confirmed-unused resources through supported APIs after itemized owner approval.

## Project documents
- [Development plan](plan.md)
- [Execution checklist](TODO.md)
- [Supabase integration and security](NOVA_SUPABASE.md)
- Master vision: NOVA_MASTER_VISION.md
- V1 scope: NOVA_V1_SCOPE.md
- Execution rules: NOVA_EXECUTION_RULES.md
- Agent rules: AGENTS.md
