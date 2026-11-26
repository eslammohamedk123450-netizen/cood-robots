# NOVA — Your Personal Companion

NOVA is a personal, voice-first digital companion for Islam. The first release focuses on a warm character-led experience with Soly (blue) and Soleen (pink), rather than a command dashboard.

## Current interface
- A single meeting screen centered on the character.
- Voice is the primary interaction.
- Text entry is a secondary option for accessibility.
- Conversation transcript is optional and can be opened when needed.
- Settings contain persona selection, owner display name, and connection placeholders.
- Camera, face recognition, identity demos, guest management, quick command buttons, and device-control demos are out of the current V1 interface.
- The character area includes a dedicated character3dMount mount point. The current CSS character is only a temporary visual fallback, not a completed 3D model.

## Run locally
Serve the repository over localhost:
    python3 -m http.server 4173
Open http://localhost:4173. Microphone access requires HTTPS or localhost and browser permission.

## Current limitations
- Browser speech recognition support and Egyptian Arabic accuracy vary by browser/device.
- The current voice is a browser SpeechSynthesis fallback, not the final natural voice service.
- Continuous listening is only while the page is open and the session is active; browsers may stop recognition or restrict background use.
- The AI conversation endpoint is not connected yet. The interface explicitly identifies this rather than pretending a real AI reply occurred.
- The 3D mount is prepared, but a licensed GLB/GLTF character and a real 3D renderer have not yet been integrated.
- Provider API key saving is intentionally disabled until an authenticated server-side endpoint stores it securely (Supabase Vault). The browser must never save provider secrets to LocalStorage or GitHub.

## Supabase
The currently connected Supabase project must be inventoried before cleanup. Do not delete old tables, auth users, storage objects, edge functions, migrations, or secrets without explicit itemized owner confirmation. Follow AGENTS.md and NOVA_EXECUTION_RULES.md.

## Project documents
- Master vision: NOVA_MASTER_VISION.md
- V1 scope: NOVA_V1_SCOPE.md
- Execution rules: NOVA_EXECUTION_RULES.md
- Agent rules: AGENTS.md
