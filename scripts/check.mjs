import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../index.html");
const app = read("../app.js");
const pin = read("../pin.js");
const edge = read("../supabase/functions/nova-ai/index.ts");
const css = read("../style.css");
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
assert.match(pin, /login_pin/, "Returning owner must authenticate through the server");
assert.match(pin, /check_session/, "Saved owner sessions must be validated server-side on return");
assert.doesNotMatch(pin, /setup_pin|pinSetupForm|check_setup/, "Owner PIN creation flow must not be exposed in the browser");
assert.match(pin, /nova.owner.session.v2/, "Successful PIN login must store the server session token");
assert.doesNotMatch(pin, /PBKDF2|localStorage\.setItem\(["']nova\.owner\.pin\.hash/, "PIN hash must not be stored or derived in the browser");
assert.match(edge, /deriveServerPinHash/, "PIN must be hashed on the server with PBKDF2");
assert.match(edge, /PIN_ITERATIONS = 310000/, "Server-side PIN hashing must use a high iteration count");
assert.match(edge, /nova_record_pin_failure/, "Failed PIN attempts must be counted atomically on the server");
assert.match(edge, /10 دقائق/, "Six failed PIN attempts must trigger a ten-minute lockout");
assert.match(edge, /nova_owner_sessions/, "PIN login must issue a server-validated session");
assert.match(edge, /action === "tts"/, "Server must expose authenticated neural TTS");
assert.match(edge, /requestSonexSpeech/, "Speech must use Sonex Labs through the Supabase Edge Function");
assert.match(edge, /api\.sonexlabs\.com\/v1\/speech/, "Sonex speech must be requested server-side");
assert.match(edge, /api\.sonexlabs\.com\/v1\/voices/, "Sonex voice list must be loaded server-side");
assert.match(edge, /action === "tts_gemini"/, "Server must expose Gemini AI Studio TTS");
assert.match(edge, /requestGeminiTTS/, "Gemini speech must be generated through the server-side TTS helper");
assert.match(edge, /gemini-2\.5-flash-preview-tts/, "Gemini TTS must use a supported audio generation model");
assert.match(edge, /action === "speech_get"/, "Speech settings must be readable through the owner session");
assert.match(edge, /action === "speech_save"/, "Speech API keys must be saved through the secure server");
assert.match(edge, /nova_speech_settings/, "Fixed voice configuration must be stored server-side");
assert.match(app, /loadSpeechSettings/, "Client must load fixed voice settings");
assert.match(app, /saveSpeechSettings/, "Client must save fixed voice settings");
assert.match(app, /state\.processing/, "Voice turns must be serialized to prevent overlapping conversations");
assert.match(app, /trackAudioElementFace/, "Cloud audio must drive live facial movement");
assert.match(app, /updateFaceSpeechProgress/, "Facial emotion must follow speech segment timing");
assert.match(app, /onboundary/, "Device speech must synchronize facial expression with spoken words");
assert.match(app, /const rawReply = String\(result\.reply/, "AI reply must be read before emotion parsing");
assert.match(app, /setFaceEmotion\("neutral"\)/, "Face must return to neutral after speech ends");
assert.match(app, /connectSpeechAnalyser/, "Audio waveform must be analyzed for mouth movement");
assert.match(app, /\[NOVA_EMOTION:/, "AI must provide emotion markers for speech segments");
assert.match(app, /قسّم ردك إلى أجزاء طبيعية حسب تغيّر المعنى/, "AI prompt must request context-based emotion changes");
assert.match(app, /أنتِ سولينا، بنت مصرية مستقلة الشخصية/, "Solina must have a distinct, consistently feminine identity");
assert.match(app, /ممنوع تمامًا أن تقولي عن نفسك أنا ولد/, "Solina prompt must explicitly forbid masculine self-reference");
assert.match(app, /تفاصيل النماذج:/, "Provider failures must expose safe model diagnostics to the owner");
assert.match(html, /سولينا/, "The female persona must be named Solina in the UI");
assert.doesNotMatch(html, /سولين(?!ا)/, "The old female persona name must not remain in the UI");
assert.doesNotMatch(app, /Math\.random\(\).*setSpeechMouthLevel/, "Speech mouth movement must not be random");
assert.match(app, /decodeAudioData/, "Android audio-context playback fallback must remain available");
assert.match(html, /id="speechApiKey"/, "The UI must provide a secure speech key entry");
assert.match(html, /id="speechMaleVoice"/, "The UI must provide a male voice selector");
assert.match(html, /id="speechFemaleVoice"/, "The UI must provide a female voice selector");
assert.match(html, /ElevenLabs/, "The UI must expose ElevenLabs as a speech provider");
assert.match(html, /id="speechProvider"/, "The UI must allow selecting the speech provider");
assert.match(edge, /api\.elevenlabs\.io\/v1\/text-to-speech/, "ElevenLabs TTS must be called server-side");
assert.match(edge, /api\.elevenlabs\.io\/v1\/models/, "ElevenLabs API keys must be verified before saving");
assert.match(edge, /xi-api-key/, "ElevenLabs credentials must only be sent from the server");
assert.match(app, /invokeNova\(speechAction/, "Client must dispatch TTS to the selected cloud provider");
assert.match(app, /engine === "gemini" \? "tts_gemini" : "tts"/, "Gemini TTS selection must route to its dedicated server action");
assert.match(app, /SpeechSynthesisUtterance/, "The optional on-device speech engine must remain available");
assert.match(app, /audio\/mpeg/, "The client must accept Sonex MP3 audio");
assert.match(app, /nova:authenticated/, "The app must receive the authenticated server session");
assert.doesNotMatch(html, /id="pinSetupForm"|إنشاء كود المالك/, "PIN creation screen must be removed after initial setup");
assert.match(html, /id="pinLoginForm"/, "Returning owner PIN form must exist");
assert.doesNotMatch(html, /id="ownerLoginForm"|id="recoveryCode"/, "Legacy email login and recovery UI must be removed");
assert.doesNotMatch(app, /signInAnonymously|signUp\(/, "Public anonymous or sign-up flow must not return");
assert.doesNotMatch(app, /window\.nova\s*=|supabase\s*\};/, "Supabase client must not be exposed on a global debug object");
assert.match(edge, /sha256Hex\(token\)/, "Edge Function must hash and validate custom session tokens server-side");
assert.match(edge, /action === "check_session"/, "Saved browser sessions must be renewed and validated server-side");
assert.match(edge, /action === "profile_get"|action === "profile_save"/, "Owner profile memory must be stored and loaded server-side");
assert.match(edge, /OWNER_USER_ID/, "Edge Function must enforce the owner allowlist");
assert.match(edge, /readJsonBody\(req\)/, "Edge Function must enforce a bounded request body");
assert.match(edge, /normalizeMessages\(body\?\.messages\)/, "Chat messages must be validated and normalized");
assert.match(edge, /expectedHost && h !== expectedHost/, "Official provider types must be pinned to their official host");
assert.match(edge, /nova_consume_rate_limit/, "Server-side rate limiting must be enforced");
assert.match(edge, /actionLimits/, "Each API action must have an explicit request limit");
assert.doesNotMatch(edge, /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/, "Service-role secrets must not be hard-coded");
assert.match(workflow, /needs: check/, "Pages deployment must depend on the quality check job");
assert.match(workflow, /npm test/, "CI must run repository tests");
assert.doesNotMatch(html + app + css + workflow, /nova-3d\.js|initNOVACharacter3D|character3D|robot-body|robot-head|robot-torso|robot-shadow|antenna|has-3d/, "Legacy mannequin renderer and styles must stay removed");
assert.match(html, /id="faceScreen"/, "OLED face must remain the only avatar");
assert.match(html, /id="novaFaceMount"/, "Dedicated OLED face mount must exist");

const secretPatterns = [
  /sk-[A-Za-z0-9]{20,}/,
  /sb_secret_[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /eyJ[A-Za-z0-9_-]{30,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/
];
for (const [name, source] of [["index.html", html], ["app.js", app], ["style.css", css], ["pin.js", pin], ["nova-ai", edge]]) {
  for (const pattern of secretPatterns) assert.doesNotMatch(source, pattern, name + " may contain a committed secret");
}
console.log("NOVA repository checks passed.");

assert.match(app, /animateFaceFromAudio/, "The face must react continuously to the actual decoded speech waveform");
assert.match(app, /getByteFrequencyData/, "Audio-reactive facial effects must use frequency analysis as well as amplitude");
assert.match(css, /body\[data-mood="speaking"\].*face-mouth[\s\S]*?animation:none!important/, "CSS must not override waveform-driven mouth movement with fake looping talk");
assert.match(css, /nova-face-laugh/, "A playful laugh must animate the face");
assert.match(css, /face-cheek/, "The face must include expressive cheek details");
assert.match(css, /face-screen\.pink/, "Solina must have a dedicated feminine pink OLED appearance");

assert.match(app, /animateFaceFromAudio/, "The face must react continuously to the actual decoded speech waveform");
assert.match(app, /getByteFrequencyData/, "Audio-reactive facial effects must use frequency analysis as well as amplitude");
assert.match(css, /body\[data-mood="speaking"\] #novaFaceMount #novaFaceAvatar \.face-mouth\{\s*animation:none!important/, "CSS must not override waveform-driven mouth movement with fake looping talk");
assert.match(css, /nova-face-laugh/, "A playful laugh must animate the face");
assert.match(css, /face-cheek/, "The face must include expressive cheek details");
assert.match(css, /face-screen\.pink/, "Solina must have a dedicated pink OLED appearance");
