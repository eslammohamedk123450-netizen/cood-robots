# NOVA Supabase Integration

## Project
- Supabase project: `SULY AI AGNIT`
- Project ref: `razvryvazmqvvqkzetuo`
- Region: `eu-west-1`
- Project URL: `https://razvryvazmqvvqkzetuo.supabase.co`
- Client credential: Supabase publishable key only. It is public by design and is not an admin secret.
- Never put the service-role key or any AI-provider key in the frontend, repository, browser storage, or logs.

## Authentication
The web app signs in using the existing owner Auth account via email/password. The deployed `nova-ai` Edge Function currently has platform JWT verification disabled because it performs its own explicit `auth.getUser(token)` validation before any operation. Every provider/model operation is scoped to the verified `auth.uid()`.

## NOVA tables
- `public.nova_api_keys`: provider label, base URL, active state and Vault secret reference. The raw API key is never stored in this table.
- `public.nova_api_models`: discovered model IDs, display names and per-model enabled state, scoped to the owner and provider key.
- `public.nova_ai_preferences`: future automatic/manual routing preference and optional selected model.
All three tables have RLS enabled. Provider/model metadata is owner-readable; privileged writes are performed by the authenticated Edge Function using its server-side service role.

## Secret handling
- `public.nova_store_api_secret(text,text)` writes provider credentials using `vault.create_secret`.
- `public.nova_read_api_secret(uuid)` retrieves a secret from `vault.decrypted_secrets`.
- Both functions are SECURITY DEFINER with an empty search_path and EXECUTE revoked from PUBLIC, anon and authenticated. EXECUTE is granted only to service_role.
- The Edge Function never returns a provider key to the browser.
- The frontend sends a newly entered key over HTTPS to the Edge Function and clears the input after a successful save.
- Do not add a service-role key to GitHub or the browser.

## Edge Function: `nova-ai`
Deployed in the existing project (active deployment version 3; source committed at `supabase/functions/nova-ai/index.ts`). Applied SQL migrations are committed under `supabase/migrations/`. It validates the caller's bearer token with Supabase Auth and supports:
- `list`: list only the signed-in owner's provider metadata and models.
- `add_provider`: validate an HTTPS OpenAI-compatible base URL, store the key in Vault, and save its metadata.
- `sync_models`: call the provider's `/models` endpoint and upsert model IDs while preserving existing enable/disable choices.
- `toggle_model`: enable or disable one model owned by the caller.
- `chat`: try enabled models in sequence against `/chat/completions`, returning the first valid response.

Current provider compatibility assumes an OpenAI-compatible API with `GET /models` and `POST /chat/completions`. Some providers may require provider-specific headers, model response normalization or endpoint adapters; these need testing before being marked supported.

## Frontend
- Supabase URL and publishable key are in `app.js`.
- Supabase Auth session persistence is handled by the official client SDK.
- Provider API keys are not stored in LocalStorage/sessionStorage.
- The UI supports multiple provider records, refreshing discovered models, and per-model enable/disable controls.
- Chat requests require an owner session and at least one enabled model.

## 3D character
`nova-3d.js` renders an original full-body procedural robot using Three.js primitives. It loads Three.js from jsDelivr, so an internet connection is required for the 3D renderer. The CSS fallback remains if WebGL/CDN initialization fails. This is a first 3D prototype, not a finished custom sculpted GLB model.

## Not yet verified
- Owner sign-in in the deployed GitHub Pages site.
- Saving a real provider key into Vault and confirming no key is returned to the browser.
- Provider model discovery and model toggles with a real provider.
- End-to-end chat and automatic fallback with real provider responses.
- Android Chrome WebGL performance and speech-recognition behavior.
- Persistent conversation and long-term memory.
- Provider-key deletion/rotation and associated Vault secret cleanup.

## Existing SULY resources and cleanup
The existing Supabase project already contains SULY-era AI routing, model synchronization, memory, conversations and task/agent infrastructure. Do not delete those resources in bulk. The current inventory also found one old `suly-media` Storage bucket with one 146-byte object. Cleanup remains pending until the object and function dependencies are reviewed and any deletion is performed through the supported Storage API. Keep the existing Auth account and migration history.
