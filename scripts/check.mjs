import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../index.html");
const app = read("../app.js");
const pin = read("../pin.js");
const edge = read("../supabase/functions/nova-ai/index.ts");
const css = read("../style.css") + read("../solina-voice.css");
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
assert.match(app, /const rawReply = sanitizeInternalReply\(result\.reply/, "AI reply must be sanitized before emotion parsing");
assert.match(app, /connectSpeechAnalyser/, "Audio waveform must be analyzed for the orb");
assert.match(app, /\[NOVA_EMOTION:/, "AI must provide emotion markers for speech segments");
assert.match(app, /قسّم ردك إلى أجزاء طبيعية حسب تغيّر المعنى/, "AI prompt must request context-based emotion changes");
assert.match(app, /أنتِ سولينا، بنت مصرية مستقلة الشخصية/, "Solina must have a distinct, consistently feminine identity");
assert.match(app, /ممنوع تمامًا أن تقولي عن نفسك أنا ولد/, "Solina prompt must explicitly forbid masculine self-reference");
assert.match(app, /تفاصيل النماذج:/, "Provider failures must expose safe model diagnostics to the owner");
assert.match(html, /سولينا/, "The female persona must be named Solina in the UI");
assert.doesNotMatch(html, /سولين(?!ا)/, "The old female persona name must not remain in the UI");
assert.doesNotMatch(app, /Math\.random\(\).*setSpeechMouthLevel/, "Orb audio response must not be random");
assert.match(app, /decodeAudioData/, "Android audio-context playback fallback must remain available");
assert.match(html, /id="speechApiKey"/, "The UI must provide a secure speech key entry");
assert.doesNotMatch(html, /label class="field-label">صوت سولي \(رجالي\)/, "Only Solina voice settings may be visible");
assert.match(html, /id="speechFemaleVoice"/, "The UI must provide a female voice selector");
assert.match(html, /ElevenLabs/, "The UI must expose ElevenLabs as a speech provider");
assert.match(html, /id="speechProvider"/, "The UI must allow selecting the speech provider");
assert.match(edge, /api\.elevenlabs\.io\/v1\/text-to-speech/, "ElevenLabs TTS must be called server-side");
assert.match(edge, /api\.elevenlabs\.io\/v1\/models/, "ElevenLabs API keys must be verified before saving");
assert.match(edge, /xi-api-key/, "ElevenLabs credentials must only be sent from the server");
assert.match(app, /invokeNova\(speechAction/, "Client must dispatch TTS to the selected cloud provider");
assert.match(app, /engine === "gemini" \? "tts_gemini" : "tts"/, "Gemini TTS selection must route to its dedicated server action");
assert.match(app, /SpeechSynthesisUtterance/, "The optional on-device speech engine must remain available");
assert.match(app, /لا تبدأ بسؤاله عن مشاريعه أو شغله/, "NOVA must not steer casual conversation toward projects");
assert.match(app, /الملف الشخصي وسجل المشاريع معلومات خلفية فقط/, "Profile memories must not dominate unrelated conversations");
assert.match(edge, /هذه الذاكرة خلفية اختيارية وليست موضوعًا افتراضيًا/, "Retrieved memory must remain subordinate to the current request");
assert.match(app, /speechAudioCache/, "Gemini speech reuse cache must stay memory-only");
assert.match(app, /rememberSpeechAudio/, "Generated Gemini audio must be cached for exact repeats in the current session");
assert.match(app, /Gemini receives the complete reply in ONE request/, "Gemini TTS must not create a request for every sentence");
assert.match(app, /rememberSpeechAudio\(geminiCacheKey, result\)/, "Valid Gemini audio must be reused during the current session");
assert.match(html, /لا يستهلك طلبات Gemini TTS/, "The UI must explain that device TTS does not use Gemini quota");
assert.match(html, /طلبًا لكل جملة/, "The UI must explain that Gemini TTS synthesizes a whole reply in one request");
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
assert.doesNotMatch(html + app + css + workflow, /nova-3d\\.js|initNOVACharacter3D|character3D|legacy-mannequin|old-robot-renderer|has-3d/, "Legacy mannequin renderer must stay removed");
assert.doesNotMatch(html, /novaRobot/, "Legacy full avatar must be removed");
assert.doesNotMatch(html, /robot-neck|robot-torso|robot-arm|robot-leg/, "No robot body parts remain");
assert.match(html, /id="solinaWaveCanvas"/, "The home screen must show Solina audio sphere");
assert.doesNotMatch(html, /faceScreen|novaFaceMount|novaFaceOnly|faceMouth/, "No robot face markup may remain");
assert.match(app, /orb\.dataset\.mood = mood/, "The audio orb must follow live conversation states");
assert.match(app, /trackAudioElementOrb\(audio, speechSegments\);\s*await audio\.play\(\)/, "The audio analyser must attach before playback");
assert.match(app, /animateOrbFromAudio/, "The orb must react continuously to actual speech waveform");
assert.match(app, /getByteFrequencyData/, "The orb must react to audio frequencies as well as amplitude");
assert.match(app, /--audio-level/, "Live speech amplitude must drive the orb visualization");
assert.match(css, /\.nova-audio-orb/, "The audio orb must have dedicated styling");
assert.match(css, /orb-ring/, "The audio orb must include expanding light pulses");
assert.match(css, /orb-particle/, "The audio orb must include subtle moving particles");
assert.match(css, /body\[data-mood="listening"\].*nova-audio-orb/, "The orb must visually react while listening");
assert.match(app, /setSpeechSegmentTone\("neutral"\)/, "Speech segment tone must reset when playback ends");
assert.match(app, /function isStopVoiceCommand\(/, "Stop phrases must be detected locally");
assert.match(app, /history_append/, "Every user and assistant message must be persisted independently");
assert.match(app, /historyQueues: \{ soleen: Promise\.resolve\(\) \}/, "Only Solina conversation history may be active");
assert.match(app, /database round trip before NOVA starts thinking/, "Chat processing must not wait for the user-history write");
assert.match(app, /Start speech immediately\. History writes are serialized in the background\./, "Speech playback must begin without waiting for history persistence");
assert.match(app, /history_search/, "Both personas must be able to search persistent conversation history");
assert.match(app, /nova.stopAudio.cache.v1/, "Stop acknowledgement audio must be cached locally");
assert.doesNotMatch(app, /بيتـ?حول لصوت الجهاز|بيتحول لصوت الجهاز/, "Cloud speech failures must not silently switch voice identity");
assert.match(edge, /action === "history_append"/, "Server must append each conversation message");
assert.match(edge, /action === "history_search"/, "Server must search both personas' history under owner scope");



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



assert.match(app, /messagesByPersona: \{ soleen: \[\] \}/, "The app must keep only Solina persona state");
assert.match(app, /state\.messagesByPersona\[state\.persona\] = state\.messages\.slice\(\)/, "Current persona history must be saved independently");
assert.match(app, /state\.messages = \(state\.messagesByPersona\[persona\] \|\| \[\]\)\.slice\(\)/, "Switching persona must restore only that persona's history");
assert.match(app, /ابدأ محادثة جديدة مع /, "Persona switch must visually separate the conversation");

assert.match(app, /إفيهات مصرية ذكية ومواقف يومية/, "The AI persona must use natural Egyptian humor");
assert.match(app, /الصدق أساسي/, "The AI persona must explicitly prioritize honesty and uncertainty");

assert.match(app, /function sanitizeInternalReply\(/, "Client must sanitize internal memory tags before display and TTS");
assert.match(app, /sanitizeInternalReply/, "Client reply sanitizer must be used");
assert.match(edge, /function sanitizeInternalReplyText\(/, "Server must sanitize internal memory metadata");
assert.match(edge, /sanitizeInternalReplyText/, "Server reply sanitizer must be used");
assert.match(edge, /ordinary words/, "Server sanitizer must remove plain-text NOVA MEMORY leaks");
assert.match(edge, /NOVA_PROVIDER_TIMING/, "Provider latency must be logged per model without logging prompts or credentials");


assert.match(app, /Wake-word gate: ambient speech is transcribed locally but never sent to AI/, "Ambient voice must not trigger AI without wake word");
assert.match(app, /if \(!local\.addressed && !local\.handled\)/, "Unaddressed speech must be ignored before AI dispatch");
assert.ok(app.includes("const wakePattern = /(?:^|\\s)"), "Wake word detection must support NOVA and accepted aliases mid-phrase");
assert.match(app, /return \{ handled: false, addressed, text: command \}/, "Voice AI requests must receive only the phrase after the wake word");
assert.match(app, /}, 950\);/, "Voice turn should use a shorter but non-zero end-of-speech pause");
assert.doesNotMatch(app, /const memoryMatches = await searchConversationMemory\(text, signal\)/, "Memory retrieval must not add a separate browser round trip before chat");
assert.match(app, /exclude_conversation_id: state\.conversationIds\[state\.persona\]/, "Chat request must exclude the active conversation from older-memory retrieval");
assert.match(edge, /سياق مسترجع من محادثات سابقة للشخصيتين/, "Chat endpoint must retrieve cross-persona history in the same request");
assert.match(edge, /oldRowsResult\.error/, "Parallel history retrieval errors must be handled explicitly");
assert.match(edge, /const \[\{ data: memoryRow, error: memoryReadError \}, \{ data: models, error \}, oldRowsResult\] = await Promise\.all\(/, "Independent memory, model, and history reads must run concurrently");
assert.match(edge, /const secretEntries = await Promise\.all\(/, "Provider secrets must be fetched concurrently instead of serially");
assert.match(html, /solina-voice-orb-v2/, "Solina client bundle must use a fresh cache version");
assert.match(css, /solina-orb-stage/, "Responsive Solina voice-first layout must be present");

assert.match(app, /Keep the dedicated interrupt listener alive during playback/, "Voice interruption listener must remain active while NOVA speaks");
assert.doesNotMatch(app, /if \(state\.listening\) startInterruptRecognition\(\);\s*stopInterruptRecognition\(\)/, "Speech playback must not immediately disable the interrupt listener");
assert.match(html, /solina-voice-orb-v2/, "Solina client bundle must use a fresh cache version");

assert.match(app, /راجع ردك مرة أخيرة بصمت من ناحية الإملاء واختيار الكلمات واتساق المعنى/, "NOVA must proofread Egyptian Arabic contextually before replying");
assert.match(app, /كلمة «بكير» تظل كما هي إذا كان معناها مقصودًا/, "Contextual proofreading must preserve valid words instead of blanket replacements");
assert.match(app, /اجعل النص الذي تعرضه هو نفسه النص الذي يُرسل للصوت/, "Displayed and spoken replies must use the same corrected text");

assert.match(app, /orb\.dataset\.expression = state\.replyEmotion/, "Speech emotion must drive the hologram face expression");
assert.match(app, /window\.solinaWave\?\.setLevel\(amount, energy\)/, "Wave motion must follow measured audio amplitude");
assert.match(css, /solina-wave-canvas/, "Solina audio orb canvas must be styled");
assert.match(css, /solina-wordmark/, "Solina must be the only visible product identity");

assert.match(html, /id="solinaWaveCanvas"/, "Solina voice orb must be mounted");
assert.match(html, /solina-voice\.css/, "Solina visual layer must be loaded");
assert.match(app, /novaAvatar\?\.setSpeechLevel\(amount, energy\)/, "The supplied avatar mouth must follow the live speech analyser");
assert.match(app, /novaAvatar\?\.setExpression\(state\.replyEmotion\)/, "The supplied avatar must follow live emotional segments");
assert.match(css, /solina-orb-stage/, "Large central audio visualizer must be present");
assert.match(css, /solina-breathe/, "Solina audio orb must pulse");
assert.match(app, /window\.solinaWave\?\.setLevel\(amount, energy\)/, "Audio orb must follow real playback amplitude");

assert.match(app, /سولينا\(\?=\$\|\\s\)/, "Only the Solina wake word should activate voice turns");
