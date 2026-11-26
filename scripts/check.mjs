import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../index.html");
const app = read("../app.js");
const pin = read("../pin.js");
const three = read("../nova-3d.js");
const edge = read("../supabase/functions/nova-ai/index.ts");
const workflow = read("../.github/workflows/pages.yml");

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
assert.deepEqual(duplicates, [], "HTML contains duplicate IDs");

const refs = [...app.matchAll(/\$\(["']([^"']+)["']\)/g)].map((m) => m[1]);
const missing = [...new Set(refs.filter((id) => !ids.includes(id)))];
assert.deepEqual(missing, [], "app.js references missing HTML IDs");

assert.match(html, /Content-Security-Policy/, "CSP meta policy must be present");
assert.equal(html.includes("\\n"), false, "HTML must not contain literal escaped newline artifacts");
assert.equal(app.includes("\\n"), false, "app.js must not contain literal escaped newline artifacts");
assert.match(pin, /setup_pin/, "First-use PIN must be created through the server");
assert.match(pin, /login_pin/, "Returning owner must authenticate through the server");
assert.match(pin, /check_setup/, "PIN setup status must be global across devices");
assert.match(pin, /nova.owner.session.v2/, "Successful PIN login must store the server session token");
assert.doesNotMatch(pin, /PBKDF2|localStorage\.setItem\(["']nova\.owner\.pin\.hash/, "PIN hash must not be stored or derived in the browser");
assert.match(edge, /deriveServerPinHash/, "PIN must be hashed on the server with PBKDF2");
assert.match(edge, /PIN_ITERATIONS = 310000/, "Server-side PIN hashing must use a high iteration count");
assert.match(edge, /nova_record_pin_failure/, "Failed PIN attempts must be counted atomically on the server");
assert.match(edge, /10 دقائق/, "Six failed PIN attempts must trigger a ten-minute lockout");
assert.match(edge, /nova_owner_sessions/, "PIN login must issue a server-validated session");
assert.match(app, /nova:authenticated/, "The app must receive the authenticated server session");
assert.match(html, /id="pinSetupForm"/, "First-use PIN setup form must exist");
assert.match(html, /id="pinLoginForm"/, "Returning owner PIN form must exist");
assert.doesNotMatch(html, /id="ownerLoginForm"|id="recoveryCode"/, "Legacy email login and recovery UI must be removed");
assert.doesNotMatch(app, /signInAnonymously|signUp\(/, "Public anonymous or sign-up flow must not return");
assert.doesNotMatch(app, /window\.nova\s*=|supabase\s*\};/, "Supabase client must not be exposed on a global debug object");
assert.match(edge, /sha256Hex\(token\)/, "Edge Function must hash and validate custom session tokens server-side");
assert.match(edge, /OWNER_USER_ID/, "Edge Function must enforce the owner allowlist");
assert.match(edge, /readJsonBody\(req\)/, "Edge Function must enforce a bounded request body");
assert.match(edge, /normalizeMessages\(body\?\.messages\)/, "Chat messages must be validated and normalized");
assert.match(edge, /expectedHost && h !== expectedHost/, "Official provider types must be pinned to their official host");
assert.match(edge, /nova_consume_rate_limit/, "Server-side rate limiting must be enforced");
assert.match(edge, /actionLimits/, "Each API action must have an explicit request limit");
assert.doesNotMatch(edge, /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/, "Service-role secrets must not be hard-coded");
assert.match(workflow, /needs: check/, "Pages deployment must depend on the quality check job");
assert.match(workflow, /npm test/, "CI must run repository tests");
assert.match(three, /requestAnimationFrame\(animate\)/, "3D render loop must be present");

const secretPatterns = [
  /sk-[A-Za-z0-9]{20,}/,
  /sb_secret_[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /eyJ[A-Za-z0-9_-]{30,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/
];
for (const [name, source] of [["index.html", html], ["app.js", app], ["pin.js", pin], ["nova-3d.js", three], ["nova-ai", edge]]) {
  for (const pattern of secretPatterns) assert.doesNotMatch(source, pattern, name + " may contain a committed secret");
}
console.log("NOVA repository checks passed.");
