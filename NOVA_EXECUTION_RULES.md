# NOVA Repository Agent Rules

These rules are mandatory for every human contributor, AI agent, automation, and tool working in this repository.

## Single-branch / single-copy policy (strict)
1. Work only in the existing repository: eslammohamedk123450-netizen/cood-robots.
2. Work only on the existing default branch: main.
3. Never create, checkout, push, or update another Git branch.
4. Never create a fork, clone, mirror, duplicate repository, worktree, or alternate project copy.
5. Never ask another agent or delegate to work in a separate branch or copy.
6. Do not create Supabase development branches for this project.
7. A new branch or copy is permitted only after the owner (Islam) gives explicit, prior permission for that specific action.
8. Commit changes directly to main. Do not use pull requests as a workaround for this rule.
9. Before writing, verify the target is main. If the tool cannot guarantee the target branch, stop and ask the owner rather than guessing.
10. Do not force-push, rewrite history, or reset the branch.

## Product scope
- Follow NOVA_MASTER_VISION.md for the long-term vision.
- Follow NOVA_V1_SCOPE.md for the currently approved first-version scope.
- The current product is a personal, voice-first companion for Islam, not a command dashboard.
- Do not add camera, face recognition, device control, desktop permissions, alarms, smart-home features, or physical robot control to V1.
- Keep text input as a secondary accessibility option. Voice is the primary interaction.
- Preserve the Soly (blue) and Soleen (pink) identities and the existing NOVA visual direction.
- Do not claim AI, 3D, memory, or voice features are fully functional until implemented and tested.

## Safe changes
- Inspect current code before editing. Prefer focused changes; do not replace unrelated work.
- Never put provider API keys, Supabase secret/service-role keys, passwords, or tokens in frontend code, LocalStorage, or Git.
- A provider API key entered in the UI must be sent over HTTPS to an authenticated server-side endpoint and stored server-side using an approved secure design (for example Supabase Vault). Never store it directly from browser JavaScript in a database table.
- Do not delete Supabase projects, users, tables, rows, buckets, objects, migrations, functions, secrets, or extensions without an explicit itemized confirmation from the owner after showing an inventory and explaining the impact.
- No destructive database cleanup based on assumptions about old applications.
- Ask before adding paid services or creating billable resources.

## Delivery
- Report the exact files changed and the commit on main.
- Distinguish implemented behavior from placeholders and browser-dependent features.
- Test what can be tested and disclose anything not tested.
