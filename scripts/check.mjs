import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../index.html");
const app = read("../app.js");
const three = read("../nova-3d.js");
const edge = read("../supabase/functions/nova-ai/index.ts");
const workflow = read("../.github/workflows/pages.yml");

const ids = [...html.matchAll(/\\bid=["']([^"']+)["']/g)].map((m) => m[1]);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
assert.deepEqual(duplicates, [], "HTML contains duplicate IDs");

const refs = [...app.matchAll(/\\$\\(["']([^"']+)["']\\)/g)].map((m) => m[1]);
const missing = [...new Set(refs.filter((id) => !ids.includes(id)))];
assert.deepEqual(missing, [], "app.js references missing HTML IDs");

assert.match(html, /Content-Security-Policy/, "CSP meta policy must be present");
assert.doesNotMatch(html, /\\\\n/, "HTML must not contain literal escaped newline artifacts");
assert.match(app, /signInWithPassword/, "Owner login must use password authentication");
assert.doesNotMatch(app, /signInAnonymously|signUp\\(/, "Public anonymous or sign-up flow must not return");
assert.doesNotMatch(app, /window\\.nova\\s*=|supabase\\s*\\};/, "Supabase client must not be exposed on a global debug object");
assert.match(edge, /auth\\.getUser\\(token\\)/, "Edge Function must verify the bearer token server-side");
assert.match(edge, /OWNER_USER_ID/, "Edge Function must enforce the owner allowlist");
assert.match(edge, /readJsonBody\\(req\\)/, "Edge Function must enforce a bounded request body");
assert.match(edge, /normalizeMessages\\(body\\?\\.messages\\)/, "Chat messages must be validated and normalized");
assert.match(edge, /expectedHost && h !== expectedHost/, "Official provider types must be pinned to their official host");
assert.doesNotMatch(edge, /SUPABASE_SERVICE_ROLE_KEY\\s*=\\s*["'][^"']+["']/, "Service-role secrets must not be hard-coded");
assert.match(workflow, /needs: check/, "Pages deployment must depend on the quality check job");
assert.match(workflow, /npm test/, "CI must run repository tests");
assert.match(three, /requestAnimationFrame\\(animate\\)/, "3D render loop must be present");

const secretPatterns = [
  /sk-[A-Za-z0-9]{20,}/,
  /sb_secret_[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /eyJ[A-Za-z0-9_-]{30,}\\.eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}/
];
for (const [name, source] of [["index.html", html], ["app.js", app], ["nova-3d.js", three], ["nova-ai", edge]]) {
  for (const pattern of secretPatterns) assert.doesNotMatch(source, pattern, name + " may contain a committed secret");
}
console.log("NOVA repository checks passed.");
