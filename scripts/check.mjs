import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../index.html");
const app = read("../app.js");
const pin = read("../pin.js");
const edge = read("../supabase/functions/nova-ai/index.ts");
const css = read("../style.css") + read("../solina-voice.css");
const workflow = read("../.github/workflows/pages.yml");
const scheduler = read("../android/app/src/main/java/com/solina/assistant/AlarmScheduler.java");
const receiver = read("../android/app/src/main/java/com/solina/assistant/TaskReceiver.java");
const activity = read("../android/app/src/main/java/com/solina/assistant/AlarmActivity.java");
const service = read("../android/app/src/main/java/com/solina/assistant/AlarmPlaybackService.java");
const androidMain = read("../android/app/src/main/java/com/solina/assistant/MainActivity.java");

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
assert.match(app, /هويتك أنثى دائمًا/, "Solina prompt must enforce a single feminine identity");
assert.doesNotMatch(app, /speechMaleVoice|tts_chatterbox|أنت سولي/, "Client must contain no legacy persona or male voice path");
assert.match(app, /getDeviceArabicVoice\(\)/, "Device TTS must select an available Arabic or device voice");
assert.match(app, /مزود الصوت لم يرجع صوتًا نسائيًا موثقًا/, "Cloud provider voices must be validated as female");
assert.match(app, /recognition\.maxAlternatives = 3/, "Speech recognition must collect alternatives for Egyptian Arabic disambiguation");
assert.match(app, /voiceAlternatives/, "Alternative speech transcripts must be passed as context to the AI");
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
assert.match(app, /const useGeminiTts = engine === "gemini"/, "Gemini TTS must be explicitly selectable; auto follows the selected provider");
assert.match(app, /const speechAction = useGeminiTts \? "tts_gemini" : "tts"/, "Cloud speech must route to the selected TTS backend");
assert.match(app, /await speakWithDevice\(spokenText, speechSegments\)/, "Cloud TTS failures must fall back to the phone voice");
assert.match(app, /female\(egyptian\) \|\| egyptian\[0\] \|\| female\(arabic\) \|\| arabic\[0\] \|\| voices\[0\]/, "Device fallback must accept any available voice when female metadata is unavailable");
assert.doesNotMatch(app, /showToast\("تعذر تشغيل صوت سولينا السحابي:/, "Speech provider failures must not interrupt the chat with an error toast");
assert.match(html, /لن تنتقل سولينا إلى خدمة سحابية أخرى/, "Speech settings must promise no alternate cloud provider fallback");
assert.match(html, /بدون صوت — رد مكتوب فقط/, "User must be able to disable speech output");
assert.match(app, /engine === "mute"/, "Mute mode must return text-only replies without invoking TTS");
assert.match(app, /allowedEngines = \["gemini", "server", "device", "mute"\]/, "Only explicitly selected speech engines may be restored");
assert.match(app, /savedEngine = allowedEngines\.includes\(storedEngine\) \? storedEngine : "server"/, "Default speech engine must be explicit cloud selection, never auto");

assert.match(app, /SpeechSynthesisUtterance/, "The optional on-device speech engine must remain available");
assert.match(app, /لا تبدأ بسؤاله عن مشاريعه أو شغله/, "NOVA must not steer casual conversation toward projects");
assert.match(app, /الملف الشخصي وسجل المشاريع معلومات خلفية فقط/, "Profile memories must not dominate unrelated conversations");
assert.match(edge, /هذه الذاكرة خلفية اختيارية وليست موضوعًا افتراضيًا/, "Retrieved memory must remain subordinate to the current request");
assert.match(app, /speechAudioCache/, "Gemini speech reuse cache must stay memory-only");
assert.match(app, /rememberSpeechAudio/, "Generated Gemini audio must be cached for exact repeats in the current session");
assert.match(app, /Gemini receives the complete reply in ONE request/, "Gemini TTS must not create a request for every sentence");
assert.match(app, /rememberSpeechAudio\(geminiCacheKey, result\)/, "Valid Gemini audio must be reused during the current session");
assert.match(html, /إذا فشلت الخدمة المختارة فقط، تستخدم صوت الهاتف المجاني كحل احتياطي/, "The UI must explain the selected-provider-only policy and phone fallback");
assert.match(html, /<option value="gemini">Google Gemini TTS فقط<\/option>/, "The UI must expose Gemini as an explicit speech engine");
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
assert.equal((html.match(/data-settings-page="/g) || []).length, 6, "Settings must expose six independent pages including device permissions");
assert.match(html, /data-settings-home/, "Settings must open on a clear category home");
assert.match(html, /id="settingsBackButton"/, "Settings pages must provide back navigation");
assert.match(html, /data-open-settings-page="memory"/, "The notebook must be reachable from the settings catalog");
assert.match(html, /class="owner-code-input"/, "Owner name must use the technical identity field style");
assert.match(app, /function openSettingsPage\(pageId\)/, "Settings categories must open as separate pages");
assert.match(app, /settingsBackButton.*showSettingsHome|showSettingsHome.*settingsBackButton/s, "Settings must return from a page to the category home");
assert.ok(css.includes("textarea#ownerMemory") && css.includes("repeating-linear-gradient"), "Owner memory must use the ruled notebook presentation");
assert.match(css, /settings-nav-card/, "Settings catalog cards must have dedicated branded styling");
assert.match(html, /id="solinaWaveCanvas"/, "The home screen must show Solina audio sphere");
assert.doesNotMatch(html, /faceScreen|novaFaceMount|novaFaceOnly|faceMouth/, "No robot face markup may remain");
assert.match(app, /window\.solinaWave\?\.setMood\(mood\)/, "The Solina audio orb must follow live conversation states");
assert.match(app, /trackAudioElementOrb\(audio, speechSegments\);\s*await audio\.play\(\)/, "The audio analyser must attach before playback");
assert.match(app, /animateOrbFromAudio/, "The orb must react continuously to actual speech waveform");
assert.match(app, /getByteFrequencyData/, "The orb must react to audio frequencies as well as amplitude");
assert.match(app, /window\.solinaWave\?\.setLevel\(amount, energy\)/, "Measured speech amplitude must drive the Solina orb");
assert.match(css, /solina-wave-canvas/, "Solina waveform canvas must have dedicated styling");
assert.match(css, /solina-wave-canvas/, "Solina orb has its own layered visual styling");
assert.match(css, /solina-breathe/, "Solina orb includes soft pulsing motion");
assert.match(css, /solina-breathe/, "Solina orb animates in listening state");
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


assert.match(app, /if \(!state\.voiceSessionActive && !local\.addressed\)/, "Ambient speech must not trigger AI until Solina is addressed");
assert.match(app, /const wakePattern = .*سولينا/, "Only Solina wake word should arm hands-free voice");
assert.ok(app.includes(String.raw`سو\s*إلينا`), "Speech recognition must normalize split Su Elina pronunciations");
assert.ok(app.includes("سولينه|سيلينه|سيلينا|سلينا|سيليا|سولينا"), "Speech recognition must normalize common Solina name substitutions");
assert.match(app, /Canonicalize common phonetic spellings/, "Wake-word aliases must be documented and normalized before matching");
assert.match(app, /text: original/, "Wake-word requests must preserve the complete utterance before and after Solina");
assert.match(app, /Wake-word detection is position-independent/, "Solina wake word must be detected anywhere in the utterance");
assert.match(app, /withoutWakeName/, "Stop commands must work even when Solina is spoken mid-sentence");
assert.match(app, /state\.voiceSessionActive = true/, "Solina wake word must keep the voice session armed");
assert.match(app, /const VOICE_TURN_PAUSE_MS = 480/, "Voice turn should use the faster 480ms natural pause");
assert.doesNotMatch(app, /const memoryMatches = await searchConversationMemory\(text, signal\)/, "Memory retrieval must not add a separate browser round trip before chat");
assert.match(app, /exclude_conversation_id: state\.conversationIds\[state\.persona\]/, "Chat request must exclude the active conversation from older-memory retrieval");
assert.match(edge, /سياق مسترجع من محادثات سولينا السابقة/, "Chat endpoint must retrieve only Solina history");
assert.match(edge, /const voiceName = "Kore"/, "Gemini must use the fixed female voice");
assert.match(edge, /ar-EG-SalmaNeural/, "Azure speech must use the female Egyptian voice");
assert.match(edge, /labels\?\.gender.*female/, "ElevenLabs voice lists must be filtered to female voices");
assert.match(edge, /voice\?\.gender.*female/, "Sonex voice lists must be filtered to female voices");
assert.match(edge, /isVerifiedFemale/, "Server must reject any selected voice not verified as female");
assert.doesNotMatch(edge, /\bsoly\b|Puck|ShakirNeural|tts_chatterbox|Chatterbox/, "Server must not retain old persona or unverified TTS service paths");
assert.match(edge, /oldRowsResult\.error/, "Parallel history retrieval errors must be handled explicitly");
assert.match(edge, /const \[\{ data: memoryRow, error: memoryReadError \}, \{ data: models, error \}, oldRowsResult\] = await Promise\.all\(/, "Independent memory, model, and history reads must run concurrently");
assert.match(edge, /const secretEntries = await Promise\.all\(/, "Provider secrets must be fetched concurrently instead of serially");
assert.match(html, /style\.css\?v=solina-voice-orb-v\d+/, "Solina stylesheet must use a versioned cache key");
assert.match(css, /solina-orb-stage/, "Responsive Solina voice-first layout must be present");

assert.match(app, /Keep the dedicated interrupt listener alive during playback/, "Voice interruption listener must remain active while NOVA speaks");
assert.doesNotMatch(app, /if \(state\.listening\) startInterruptRecognition\(\);\s*stopInterruptRecognition\(\)/, "Speech playback must not immediately disable the interrupt listener");
assert.match(html, /style\.css\?v=solina-voice-orb-v\d+/, "Solina stylesheet must use a versioned cache key");

assert.match(app, /راجع ردك مرة أخيرة بصمت من ناحية الإملاء واختيار الكلمات واتساق المعنى/, "NOVA must proofread Egyptian Arabic contextually before replying");
assert.match(app, /كلمة «بكير» تظل كما هي إذا كان معناها مقصودًا/, "Contextual proofreading must preserve valid words instead of blanket replacements");
assert.match(app, /اجعل النص الذي تعرضه هو نفسه النص الذي يُرسل للصوت/, "Displayed and spoken replies must use the same corrected text");

assert.match(app, /window\.solinaWave\?\.setExpression\(state\.replyEmotion\)/, "Speech emotion must reach the Solina waveform");
assert.match(app, /window\.solinaWave\?\.setLevel\(amount, energy\)/, "Wave motion must follow measured audio amplitude");
assert.match(css, /solina-wave-canvas/, "Solina audio orb canvas must be styled");
assert.match(css, /solina-wordmark/, "Solina must be the only visible product identity");

assert.match(html, /id="solinaWaveCanvas"/, "Solina voice orb must be mounted");
assert.match(html, /solina-voice\.css/, "Solina visual layer must be loaded");
assert.match(app, /window\.solinaWave\?\.setLevel\(amount, energy\)/, "Live speech amplitude drives the Solina orb");
assert.match(app, /window\.solinaWave\?\.setLevel\(amount, energy\)/, "Live speech amplitude drives the Solina orb");
assert.match(css, /solina-orb-stage/, "Large central audio visualizer must be present");
assert.match(css, /solina-breathe/, "Solina audio orb must pulse");
assert.match(app, /window\.solinaWave\?\.setLevel\(amount, energy\)/, "Audio orb must follow real playback amplitude");

assert.match(app, /wakePattern = .*سولينا/, "Only the Solina wake word should activate voice turns");
assert.ok(app.includes(String.raw`const wakePattern = /(?:^|\s)`), "Wake-word matching must use a real whitespace boundary");
assert.ok(app.includes(String.raw`normalized.replace(/(?:^|\s)`), "Stop-command matching must use a real whitespace boundary");
assert.doesNotMatch(app, /wakePattern = .*نوفا|wakePattern = .*سولي(?!نا)|wakePattern = .*سولين(?!ا)/, "Old wake-word aliases must not activate the assistant");

assert.doesNotMatch(app, /واجهة NOVA مفتوحة حاليًا في الوضع المحلي/, "Cloud AI must never silently fall back to a fake local reply");
assert.doesNotMatch(app, /async function restoreOwnerSession\(/, "Only pin.js may restore the owner session to prevent competing startup checks");
assert.doesNotMatch(app, /void restoreOwnerSession\(\)/, "The app must not call a removed duplicate session restoration function");
assert.match(app, /حصلت مشكلة ومنعتني من الرد/, "Chat failures must be visible to the owner instead of silently leaving the thinking state");
assert.match(pin, /check_session/, "The single owner-session bootstrap must validate saved sessions server-side");
assert.match(pin, /openApp\(saved\)/, "A valid saved owner session must open the app without another PIN prompt");
assert.doesNotMatch(app, /if \(!state\.session\) throw new Error\("جلسة سولينا غير متصلة/, "Chat requests must let invokeNova recover a stale owner session before failing");
assert.match(app, /await window\.novaEnsureOwnerSession\(\)/, "Chat requests must recover the owner session through the shared API bootstrap");

assert.match(app, /voiceSessionActive: false/, "Voice session must begin disarmed");
assert.match(app, /if \(!state\.voiceSessionActive && !local\.addressed\)/, "Only Solina wake word may arm a hands-free session");
assert.match(app, /state\.voiceSessionActive = true/, "Saying Solina must arm continuous conversational turns");
assert.match(app, /}, VOICE_TURN_PAUSE_MS\);/, "AI turn must use the shared natural-silence threshold");
assert.match(app, /ناديني: سولينا/, "The wake prompt must use Solina, never NOVA");
assert.doesNotMatch(app, /مستني تناديني: نوفا|مستني تناديني يا نوفا/, "No stale NOVA wake prompt may remain");
assert.match(app, /state\.voiceSessionActive = false;\s*cancelCurrentTurn/, "Stopping the microphone must close the armed voice session");

assert.match(app, /function openSettings\(\) \{[\s\S]*?showSettingsHome\(\);[\s\S]*?\$\("settingsDialog"\)\.showModal\(\);[\s\S]*?Promise\.allSettled\(\[loadProviders\(\), loadOwnerMemory\(\), loadSpeechSettings\(\), refreshPermissionCards\(\)\]\);[\s\S]*?\}/, "Opening settings must show the category home and refresh providers, memory, speech, and device permissions");
assert.match(app, /جاري تحميل مفاتيح API المحفوظة/, "Provider list must show a loading state instead of a false empty state");
assert.match(app, /تعذر تحميل المفاتيح من الخادم:/, "Provider list failures must be shown as errors, not as an empty key list");
assert.match(html, /id="reloadProvidersButton"/, "Settings must provide a manual API key list refresh control");

assert.match(app, /window\.solinaActivateOwnerSession = \(token\) => activateOwnerSession\(token\)/, "The app must expose a direct validated-session handoff callback");
assert.match(app, /const alreadyBootstrapped = activatedOwnerSession === token/, "Session activation must restore state.session even when the same token was previously activated");
assert.match(app, /if \(alreadyBootstrapped\) return/, "Duplicate session handoffs must skip only bootstrap work, not session restoration");
assert.match(app, /activatedOwnerSession = null/, "A rejected session must reset the activation guard before reauthentication");
assert.match(app, /window\.__solinaPendingOwnerToken/, "The app must replay a session token if the auth event arrived before module startup");
assert.match(pin, /window\.solinaActivateOwnerSession\?\.\(token\)/, "PIN bootstrap must call the app directly as well as dispatching the auth event");
assert.match(pin, /window\.novaEnsureOwnerSession = ensureOwnerSession/, "Protected app actions must be able to restore the owner session on demand");
assert.match(pin, /temporary network failure must never erase a still-valid owner token/, "Transient network failures must not destroy the saved owner session");
assert.match(app, /await window\.novaEnsureOwnerSession\(\)/, "Protected API calls must recover a missing owner session before failing");

assert.match(pin, /if \(result\.valid\) \{ openApp\(saved\); return saved; \}/, "Validated owner session restoration must return the token to callers");
assert.doesNotMatch(pin, /payload\.token \? \{ "Authorization": "Bearer "/, "Session validation must send the custom owner token in its JSON body, not as a Supabase JWT");
assert.match(app, /const restoredToken = await window\.novaEnsureOwnerSession\(\);\s*if \(typeof restoredToken === "string" && restoredToken\) state\.session = restoredToken/, "Protected calls must receive the validated owner token directly");

assert.match(app, /localStorage.getItem\("solina.owner.name"\)/, "Owner display name must persist across reloads on this device");
assert.match(app, /localStorage.setItem\("solina.owner.name", state.ownerName\)/, "Owner display name changes must be saved");
assert.match(app, /function updateMemoryMeta\(updatedAt = null\)/, "Memory settings must show last update and saved item count");
assert.match(app, /result.updated_at/, "Memory timestamps returned by the server must be displayed");
assert.match(html, /id="reloadOwnerMemory"/, "Owner must be able to refresh saved memory manually");
assert.match(html, /id="memoryUpdated"/, "Memory panel must display its saved status and timestamp");


import { parseTaskCommand, normalizeTaskText } from "../task-manager.js";
const fixedNow = new Date("2026-11-27T08:00:00+02:00");
const reminderIntent = parseTaskCommand("فكريني أراجع المحاضرة الساعة 5 مساء", fixedNow);
assert.equal(reminderIntent?.action, "create", "Arabic reminder command should be recognized");
assert.equal(reminderIntent?.type, "reminder", "Reminder command should create a reminder");
assert.match(reminderIntent?.title || "", /أراجع المحاضرة/, "Reminder title should retain the task description");
assert.equal(new Date(reminderIntent.scheduledAt).getHours(), 17, "An upcoming clock time should use the next occurrence");
const alarmIntent = parseTaskCommand("صحيني الساعة 9", fixedNow);
assert.equal(alarmIntent?.type, "alarm", "Wake-up phrase should create an alarm");
assert.equal(alarmIntent?.action, "needs_period", "Ambiguous alarm time must ask whether it is morning or evening");
const morningAlarm = parseTaskCommand("صحيني الساعة 9 الصبح", fixedNow);
assert.equal(morningAlarm?.action, "create", "Explicit morning alarm should be schedulable");
assert.equal(new Date(morningAlarm.scheduledAt).getHours(), 9, "Morning alarm should preserve the requested hour");
assert.equal(parseTaskCommand("صحيني الفجر", fixedNow)?.action, "needs_fajr_time", "Fajr alarm must request a real prayer time");
assert.equal(parseTaskCommand("صحيني بعد دقيقتين", fixedNow)?.action, "create", "Two-minute wake-up command should be recognized");
assert.match(parseTaskCommand("فكريني بعد ثلاث دقايق إن أنا أغسل سناني", fixedNow)?.title || "", /أغسل سناني/, "Relative reminder titles must remove filler words and preserve the actual task");
assert.doesNotMatch(parseTaskCommand("فكريني بعد ثلاث دقايق إن أنا أغسل سناني", fixedNow)?.title || "", /إن أنا|ثلاث|دقايق|فكريني/, "Reminder title must not contain command words or relative time");
assert.equal(new Date(parseTaskCommand("صحيني بعد دقيقتين", fixedNow).scheduledAt).getTime(), fixedNow.getTime() + 120000, "Two-minute alarm should preserve the relative delay");
assert.equal(parseTaskCommand("ظبطيلي منبه بعد دقيقتين", fixedNow)?.type, "alarm", "Colloquial alarm setup command should be recognized");
assert.equal(parseTaskCommand("صحييني بعد دقيقتين", fixedNow)?.action, "create", "Alternate Egyptian wake-up pronunciation should be recognized");
assert.equal(parseTaskCommand("فوقيني بعد خمس دقايق", fixedNow)?.type, "alarm", "Wake-up synonyms should route to the alarm engine");
assert.equal(parseTaskCommand("افتحي تطبيق واتساب", fixedNow)?.action, "open_app", "Opening an installed app must route to the native command engine");
assert.equal(parseTaskCommand("افتح الإعدادات", fixedNow)?.action, "open_settings", "Phone settings command must route natively");
assert.equal(parseTaskCommand("شغل الفلاش", fixedNow)?.action, "unsupported_device", "Unsupported phone controls must not fall through to AI");

assert.equal(parseTaskCommand("وريني المنبهات", fixedNow)?.action, "list", "Task list command should be recognized");
assert.equal(parseTaskCommand("إيه معنى المنبه؟", fixedNow), null, "Ordinary questions about alarms must go to the AI");
assert.equal(parseTaskCommand("منبه الساعة 10", fixedNow)?.type, "alarm", "Direct alarm scheduling phrase should be recognized");
assert.equal(parseTaskCommand("صحيني الساعة تسعة", fixedNow)?.action, "needs_period", "Spoken ambiguous hour must ask for morning or evening");
assert.equal(parseTaskCommand("اضبطيلي منبه بكرة الساعة اتنين", fixedNow)?.action, "needs_period", "Colloquial set-an-alarm request should ask only for the missing day period");
assert.equal(parseTaskCommand("ظبطيلي منبه بكرة الساعة اتنين الصبح", fixedNow)?.action, "create", "A complete colloquial alarm command should be ready for immediate execution");
assert.equal(new Date(parseTaskCommand("صحيني الساعة تسعة صباحا", fixedNow).scheduledAt).getHours(), 9, "Spoken Egyptian number words should be parsed as clock times");
const spokenMinuteAlarm = parseTaskCommand("صحيني الساعة تمانية وخمسة وأربعين دقيقة الصبح", fixedNow);
assert.equal(spokenMinuteAlarm?.action, "create", "Compound spoken Arabic alarm time should be recognized");
assert.equal(new Date(spokenMinuteAlarm.scheduledAt).getHours(), 8, "Spoken hour should be preserved");
assert.equal(new Date(spokenMinuteAlarm.scheduledAt).getMinutes(), 45, "Spoken minute phrase should parse to 45 minutes");

assert.equal(parseTaskCommand("فكريني بكرة أذاكر الساعة 9 مساء", fixedNow)?.action, "create", "Tomorrow reminders should be recognized");
assert.equal(parseTaskCommand("فكريني بمعاد بكرة", fixedNow)?.action, "needs_time", "Appointment request without a time should ask for the time");
assert.equal(parseTaskCommand("عندي بكرة معاد الساعة أربعة", fixedNow)?.action, "needs_period", "Appointment request with an ambiguous spoken hour should ask AM or PM");
assert.equal(parseTaskCommand("فكريني بمعاد بكرة الساعة عشرة صباحا", fixedNow)?.action, "needs_title", "Appointment without a name should ask what it is for");
const namedAppointment = parseTaskCommand("فكريني بمعاد بكرة الساعة عشرة صباحا كشف دكتور", fixedNow);
assert.equal(namedAppointment?.action, "create", "Named appointment should be ready for confirmation");
assert.match(namedAppointment?.title || "", /كشف دكتور/, "Appointment title should be retained");
assert.equal(parseTaskCommand("فكريني بعد نص ساعة أذاكر", fixedNow)?.action, "create", "Relative reminder durations should be recognized");
const fiveMinuteReminder = parseTaskCommand("فكريني بعد خمس ورايا حاجة مهمة", fixedNow);
assert.equal(fiveMinuteReminder?.action, "create", "A noisy colloquial five-minute reminder must be parsed");
assert.equal(new Date(fiveMinuteReminder.scheduledAt).getTime(), fixedNow.getTime() + 300000,
  "A five-minute reminder must be scheduled exactly five minutes from now");
assert.match(fiveMinuteReminder?.title || "", /حاجة مهمة/, "The reminder title must retain the task and omit the duration");

assert.equal(new Date(parseTaskCommand("فكريني بعد شوية أذاكر", fixedNow).scheduledAt).getTime(), fixedNow.getTime() + 300000, "After a little while should default to five minutes");
assert.equal(parseTaskCommand("الغى كل التذكيرات", fixedNow)?.all, true, "Bulk task cancellation should be recognized");
assert.equal(normalizeTaskText("الساعة ٩:٣٠"), "الساعة 9:30", "Arabic numerals and clock separators should normalize safely");
assert.match(app, /parseTaskCommand\(clean\)/, "Voice and text turns should route task commands locally");
assert.match(app, /function handleTaskDialogue\(clean\)/, "Task setup must support multi-turn conversational slot filling");
assert.match(app, /if \(parsed\?\.action === "create"\)[\s\S]*?return \{ handled: true, intent: parsed \}/, "A clarification answer must execute the completed task immediately");
assert.match(app, /return \{ handled: true, intent \};/, "A complete task command must route directly to native execution");
assert.doesNotMatch(app, /beginTaskConfirmation|stage: "confirm"/, "Task creation must not require a redundant confirmation turn");
assert.match(app, /clockQuestion/, "A current-time question must not be appended to a pending reminder");
assert.match(app, /const stored = readNativeTasks\(\)\.find/, "The app must verify the exact saved task before claiming success");
assert.match(app, /Number\(stored\.at\) !== task\.at/, "The app must verify the saved minute exactly");
assert.match(app, /pendingTaskPermissionIntent/, "A reminder must be retained while Android permissions are requested");
assert.match(app, /pendingTaskDraft/, "Pending task details must remain available between voice turns");
assert.match(app, /state\.pendingTaskDraft = null;\s*return \{ handled: false \}/, "Unrelated speech must leave a pending task dialogue and reach normal chat");
assert.match(app, /window\.SolinaNative/, "Task actions must use the native Android bridge");
assert.equal(parseTaskCommand("عايز أديك الصلاحية", fixedNow)?.action, "open_permissions", "Permission requests must open the native permission center, not fall through to AI");
assert.equal(parseTaskCommand("افتحي صلاحيات التطبيق", fixedNow)?.action, "open_permissions", "Spoken request to open permissions must be handled locally");
assert.match(html, /data-settings-page="permissions"/, "Settings must include a dedicated device permissions page");
assert.match(html, /data-permission-action="exactAlarms"/, "Exact alarm access must be controllable from the permission center");
assert.match(app, /function refreshPermissionCards\(/, "Permission statuses must be read from the Android bridge");
assert.match(css, /\.solina-transcript\{display:none!important\}/, "Idle voice text must not cover the visible conversation transcript");
assert.match(html, /class="conversation-log solina-conversation-feed" id="conversationLog"/, "Conversation transcript must remain visible below voice controls");
assert.match(html, /id="scheduledTasksList"/, "Settings should expose saved reminders and alarms");
console.log("Arabic task parser checks passed.");


assert.match(androidMain, /permissionInfo\(\)/, "Android bridge must report real device permission state");
assert.match(androidMain, /requestPermission\(String name\)/, "Android bridge must request or open each permission directly");
assert.match(app, /solina-native-speech-result/, "The app must consume Android native speech results");
assert.match(app, /state\.nativeSpeech/, "The app must keep native speech capture active across turns");
assert.match(androidMain, /SpeechRecognizer\.createSpeechRecognizer/, "The Android app must provide native speech recognition");
assert.match(androidMain, /EXTRA_LANGUAGE, "ar-EG"/, "Native speech recognition must prefer Egyptian Arabic");
const alarmActivity = read("../android/app/src/main/java/com/solina/assistant/AlarmActivity.java");
const alarmService = read("../android/app/src/main/java/com/solina/assistant/AlarmPlaybackService.java");
assert.match(alarmService, /setLooping\(true\)/, "Alarm sound must loop until stopped");
assert.match(alarmActivity, /isStopPhrase/, "Alarm must accept spoken stop commands");
assert.match(alarmActivity, /انا قمت|قمت/, "Alarm must recognize the user confirming they woke up");
assert.match(alarmActivity, /صحيت|صاحي/, "Alarm must also stop when the user says «أنا صحيت» or «أنا صاحي»");
const alarmScheduler = read("../android/app/src/main/java/com/solina/assistant/AlarmScheduler.java");
const taskReceiver = read("../android/app/src/main/java/com/solina/assistant/TaskReceiver.java");
const taskStore = read("../android/app/src/main/java/com/solina/assistant/TaskStore.java");
assert.match(alarmScheduler, /at - DAY/, "Reminders must schedule a one-day advance notification");
assert.match(alarmScheduler, /at - HOUR/, "Reminders must schedule a one-hour advance notification");
assert.match(alarmScheduler, /at - TEN_MINUTES/, "Reminders must schedule a ten-minute advance notification");
assert.match(alarmScheduler, /scheduleFollowUp/, "Reminder follow-ups must survive process restarts");
assert.match(taskReceiver, /FOLLOW_UP_INTERVAL = 60L \* 60L \* 1000L/, "Unfinished reminders must repeat hourly");
assert.match(taskReceiver, /ACTION_COMPLETE/, "Reminder notifications must offer a completion action");
assert.match(taskReceiver, /ACTION_SNOOZE/, "Reminder notifications must offer a snooze action");
assert.match(taskReceiver, /بعد 10 دقايق/, "Reminder notifications must expose a ten-minute snooze");
assert.match(taskStore, /setNextFollowUp/, "The next follow-up time must be persisted");
assert.doesNotMatch(androidMain, /notification_permission_required/, "A disabled notification permission must not block native alarm scheduling");
assert.match(scheduler, /manager\.setAlarmClock\(new AlarmManager\.AlarmClockInfo\(at, show\), pending\)/, "Reminder due times must be registered as Android alarm-clock alarms");
assert.match(receiver, /startReminderAlarm\(context, task, id\)/, "Due reminders must start audible native alarm playback even without notification permission");
assert.match(receiver, /setFullScreenIntent\(due \? openPending : null, due\)/, "Due reminders must request the full-screen alarm experience");
assert.match(receiver, /context\.stopService\(new Intent\(context, AlarmPlaybackService\.class\)\)/, "Completing or snoozing a reminder must stop its ringing audio");
assert.match(activity, /خلصت — إيقاف التذكير/, "Reminder alarm screen must provide a clear completion action");
assert.match(activity, /clean\.contains\("خلصت"\)/, "Saying «خلصت» must stop an audible reminder");
assert.match(service, /USAGE_ALARM/, "Reminder sound must use the device alarm audio stream");
assert.match(androidMain, /completeTask\(String id\)/, "Solina must be able to complete reminders from voice chat");
assert.match(androidMain, /snoozeTask\(String id, int minutes\)/, "Solina must be able to snooze reminders from voice chat");
assert.match(app, /Do not let unrelated conversation be trapped in the confirmation flow|state\.pendingTaskDraft = null;/, "A new question must not be trapped behind an old confirmation");
assert.match(app, /complete_task/, "The spoken «خلصت» command must complete the active reminder");
assert.match(app, /snooze_task/, "The spoken snooze command must defer the active reminder");
assert.match(app, /answerFits = pending\.stage === "needs_period"/, "Morning/evening answers must resolve the pending time-period question without another confirmation");
assert.doesNotMatch(app, /const ready = info\.notifications && info\.exactAlarms/, "Notification permission must not block native task persistence");
assert.doesNotMatch(app, /if \(!info\.notifications\)/, "Task creation must not wait for optional notification permission");
assert.equal(parseTaskCommand("ذكريني بعد ثلاث دقائق بالظبط عشان اغسل اسناني", new Date("2026-11-28T00:00:00")).title, "اغسل اسناني", "Three-minute reminder title must exclude timing/filler words");
assert.equal(parseTaskCommand("سيلينا ذكريني بعد خمس دقائق عشان اغسل سناني", new Date("2026-11-28T00:00:00")).title, "اغسل سناني", "Five-minute reminder title must exclude wake word and filler");

console.log("Native Android speech recognition and reminder follow-up checks passed.");

assert.match(app, /answerFits = pending\.stage === "needs_period"/, "Clarification answers must be interpreted against the pending question");
assert.equal(parseTaskCommand("فكريني بعد دقيقتين بالظبط عشان اقوم اغسل سناني", new Date("2026-11-28T00:00:00")).title, "اقوم اغسل سناني", "Two-minute reminder title must exclude dual-minute timing and filler words");

assert.match(androidMain, /TextToSpeech/, "Android APK must provide native text-to-speech output");
assert.match(androidMain, /setLanguage\(new Locale\("ar", "EG"\)\)/, "Native speech must prefer Egyptian Arabic");
assert.match(androidMain, /speakText\(String text\)/, "Web app must be able to request native Android speech");
assert.match(androidMain, /solina-native-tts/, "Native TTS playback status must be returned to the web app");
assert.match(app, /speakWithNativeDevice\(text, segments\)/, "Android app must use native TTS before browser speech synthesis");
assert.match(app, /تعذر تشغيل صوت سولينا:/, "Speech failure must be visible instead of silently dropping audio");

assert.equal(normalizeTaskText("سِيْلينا"), "سولينا", "Common Solina name pronunciations must normalize consistently");
assert.equal(parseTaskCommand("سيلينا افتحي فيسبوك لايت", fixedNow)?.appName, "فيسبوك لايت", "Lite app command with alternate wake name must preserve the exact app variant");
assert.equal(parseTaskCommand("سلينا افتحيلي فيسبوك", fixedNow)?.appName, "فيسبوك", "Colloquial open-me command and shortened wake name must be recognized");
assert.equal(parseTaskCommand("سولي نا شغلي واتساب", fixedNow)?.action, "open_app", "Split wake-name recognition must route app commands locally");
assert.match(java, /facebooklite/, "Android app resolver must recognize Facebook Lite separately");
assert.match(java, /Never mistake Facebook Lite for Facebook/, "Android app resolver must prevent Lite/standard cross-launch");
assert.match(app, /فيسبوك العادي وفيسبوك لايت تطبيقان مختلفان/, "AI system prompt must understand distinct app variants");
assert.match(app, /محرك أوامر الجهاز المحلي/, "AI system prompt must know app opening is a real local capability");
