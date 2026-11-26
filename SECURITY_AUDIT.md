# NOVA Security and Quality Audit

**Audit date:** 2026-11-26  
**Repository:** `eslammohamedk123450-netizen/cood-robots`  
**Branch:** `main` only  
**Supabase project:** `razvryvazmqvvqkzetuo`  
**Active NOVA Edge Function:** `nova-ai` version 11

## Executive result

The repository's automated JavaScript syntax/smoke checks, GitHub Pages build and deployment completed successfully on the latest verified run before the rate-limit change. The Edge Function deployed successfully as version 11. Supabase RLS, grants, function privileges and advisor results were inspected.

This is **not** a guarantee of zero bugs or a formal penetration test. Live browser/device tests and real AI-provider integration tests remain outstanding.

## Changes made during this audit

- Fixed a JavaScript syntax error in owner-session validation; the CI syntax check caught the duplicate `async` keyword and the fix was committed.
- Added a persistent owner login gate and backend owner-ID verification.
- Removed the Supabase client from the global debug object.
- Added a Content Security Policy.
- Restricted CORS to the production GitHub Pages origin.
- Added a streamed 400 KB request-body limit and strict chat-message validation.
- Restricted built-in Gemini/OpenAI/OpenRouter/Anthropic presets to their official API hostnames.
- Added server-side per-action rate limits: 20 chat, 5 provider-add, 10 model-sync, 30 model-toggle and 60 list operations per minute.
- Optimized owner-only RLS policies with `(select auth.uid())` and added indexes for NOVA foreign-key/query paths.
- Removed the incorrectly timestamped duplicate migration and aligned the owner-only migration filename with the applied Supabase migration history.
- Added Node syntax checks and static repository smoke checks; Pages deployment now depends on the check job.

## Verification performed

### GitHub repository and CI
- Confirmed the repository default branch is `main` and the branch listing contains only `main`.
- `node --check app.js` and `node --check nova-3d.js` run in CI.
- `scripts/check.mjs` checks duplicate/missing HTML IDs, login/backend security invariants, CSP, provider host restrictions, workflow gating and common committed-secret patterns.
- Latest verified run before the rate-limit commit: check, build and deploy jobs all succeeded. The rate-limit commit has deployed to Supabase; its GitHub Actions run must complete to confirm the new commit's CI/deployment.

### Supabase
- No public-schema table was found with RLS disabled.
- NOVA provider keys, models, preferences and memories have owner-only RLS policies.
- The rate-limit table has RLS enabled, no client grants and no client policy; it is accessed through a service-role-only function.
- Vault read/write functions have EXECUTE only for `service_role` and `postgres`; they use an empty search_path.
- Public SECURITY DEFINER functions inspected had an empty search_path and no EXECUTE grant to `anon` or `authenticated`.
- The existing Storage bucket `suly-media` is private.
- A transaction test of the rate-limit function returned an allowed first request and rejected the next request at a limit of one.

### Secrets and repository contents
- No provider API key, service-role secret, private key or JWT pattern was found in the scanned frontend files or the three legacy text snapshots.
- The Supabase publishable key is public by design; it is not a service-role key.
- The repository itself is public, so its source is visible. Backend authorization—not hiding the frontend—is what protects NOVA data and AI operations.

## Remaining findings and limitations

1. **Supabase sign-ups are not yet disabled in the dashboard.** The NOVA Edge Function still rejects every non-owner identity, but disable public sign-ups to stop unnecessary Auth account creation.
2. **Leaked-password protection is disabled.** Supabase Security Advisor continues to warn about it. Enable it if the current project plan provides the setting.
3. **Three pre-existing shared SULY tables**—`engine_runtime_catalog`, `hermes_delegation_outbox` and `project_file_revisions`—have RLS enabled but no policies. This is fail-closed for client roles; they were not changed because their intended server-only use belongs to shared legacy infrastructure.
4. The new rate-limit table also has no client policy by design; client grants are revoked and only the service-role function uses it.
5. **Custom API endpoints remain a trust decision.** The function enforces HTTPS and rejects obvious local/private address forms, but arbitrary custom domains cannot be treated as equivalent to the official provider hosts. Do not send a provider key to a domain you do not trust; DNS rebinding is not fully eliminated by hostname checks alone.
6. **No live provider test has been run.** The NOVA provider-key and model tables are currently empty. Add a real key through the app, never in chat, then verify discovery and chat.
7. **No browser E2E/device test has been run.** Android Chrome microphone permission, SpeechRecognition, CSP compatibility and WebGL/Three.js rendering still need hands-on verification.
8. `nova_memories` exists with owner-only schema protection, but memory read/write is not yet connected to chat. Conversation history is still in page memory only.
9. The audit covers the NOVA frontend, `nova-ai` Edge Function and NOVA database resources. It does not certify the other pre-existing SULY Edge Functions or legacy systems in the shared Supabase project.
10. GitHub commit metadata may use the account's configured author email. Review GitHub's email privacy setting and use its noreply address for future commits if you do not want the author email shown publicly.

## Manual actions for the owner

- [ ] Supabase Dashboard → Authentication → Sign-up settings: disable new user sign-ups and anonymous sign-ins.
- [ ] Supabase Dashboard → Authentication → Password Security: enable leaked-password protection if available.
- [ ] Enroll a TOTP MFA factor for the owner account; consider enforcing AAL2 for sensitive actions after confirming the login UX.
- [ ] Sign in to the deployed app and test with the existing owner account.
- [ ] Add a real provider key inside NOVA and test model discovery/chat; never paste the key into GitHub or this conversation.
- [ ] Test on Android Chrome and desktop, including microphone, speech output, WebGL and browser console.

## Scope and confidence

This was a source/configuration/database security review plus CI/static checks. It was not a third-party penetration test, browser automation suite, load test, DNS/egress test, or formal assurance that no future bug can occur.
