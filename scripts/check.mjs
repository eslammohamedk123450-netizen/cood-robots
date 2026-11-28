import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { classifyMemoryKind, extractMemoryNumberSignature, extractMemoryTokens, isCorrectionHistoryRecall, isExplicitMemoryRecall, normalizeMemoryText, parseExplicitMemoryCorrection, parseExplicitMemorySave } from "../supabase/functions/nova-ai/memory-utils.js";
import { buildMemoryGraph, parseMemoryModelJson, validateSemanticRecallIds } from "../supabase/functions/nova-ai/memory-graph.js";


const graphFixture = buildMemoryGraph("المشروع ألف ميزانيته 5000 جنيه وموعده الخميس، والمشروع باء ميزانيته 7000 جنيه.", {
  summary: "مشروعان لكل منهما ميزانية وموعد مختلف",
  topics: ["مشاريع", "ميزانيات"],
  entities: [{ id: "project-a", name: "المشروع ألف", kind: "project" }, { id: "project-b", name: "المشروع باء", kind: "project" }],
  facts: [
    { subject: "المشروع ألف", predicate: "الميزانية", value: "5000", value_type: "money", context: "جنيه", evidence: "ميزانيته 5000 جنيه", confidence: 0.99 },
    { subject: "المشروع ألف", predicate: "موعد التسليم", value: "الخميس", value_type: "date", evidence: "موعده الخميس", confidence: 0.95 },
    { subject: "المشروع باء", predicate: "الميزانية", value: "7000", value_type: "money", context: "جنيه", evidence: "ميزانيته 7000 جنيه", confidence: 0.99 },
  ],
  relations: [{ from: "المشروع ألف", relation: "له ميزانية", to: "5000 جنيه", evidence: "ميزانيته 5000 جنيه" }],
});
assert.equal(graphFixture.source_text, "المشروع ألف ميزانيته 5000 جنيه وموعده الخميس، والمشروع باء ميزانيته 7000 جنيه.", "Semantic indexing must preserve the complete original memory");
assert.equal(graphFixture.facts.length, 3, "Semantic indexing must preserve distinct facts from one sentence");
assert.equal(graphFixture.facts[0].subject, "المشروع ألف", "Each value must remain attached to its correct subject");
assert.equal(graphFixture.facts[2].subject, "المشروع باء", "Similar properties must not merge facts belonging to different subjects");
assert.equal(graphFixture.facts[2].value, "7000", "Exact values must survive semantic graph validation");
assert.equal(buildMemoryGraph("المشروع ألف ميزانيته 5000 جنيه.", { facts: [{ subject: "المشروع ألف", predicate: "الميزانية", value: "9000", evidence: "ميزانيته 9000 جنيه" }] }).facts.length, 0, "Model-invented facts without matching source evidence must be rejected");
assert.equal(buildMemoryGraph("المشروع ألف ميزانيته 5000 جنيه.", { facts: [{ subject: "المشروع ألف", predicate: "الميزانية", value: "9000", evidence: "ميزانيته 5000 جنيه" }] }).facts.length, 0, "A model must not attach a value that is absent from its quoted evidence");
assert.deepEqual(validateSemanticRecallIds({ selected_ids: ["note-b", "not-real", "note-a", "note-b"] }, ["note-a", "note-b"]), ["note-b", "note-a"], "Semantic retrieval must reject unknown IDs and deduplicate valid candidates");
assert.deepEqual(parseMemoryModelJson('prefix ```json\\n{"selected_ids":["n1"],"confidence":0.9}\\n``` suffix'), { selected_ids: ["n1"], confidence: 0.9 }, "Model JSON parsing must tolerate fenced JSON and surrounding prose");
assert.equal(buildMemoryGraph("نص أصلي", null).extraction_status, "pending", "Missing model output must never be marked as semantically processed");

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../index.html");
const app = read("../app.js");
const pin = read("../pin.js");
const edge = read("../supabase/functions/nova-ai/index.ts");
const memoryUtils = read("../supabase/functions/nova-ai/memory-utils.js");
const taskManager = read("../task-manager.js");
const personalItemsMigration = read("../supabase/migrations/20261127233636_nova_account_synced_personal_items.sql");
const css = read("../style.css") + read("../solina-voice.css");
const workflow = read("../.github/workflows/pages.yml");
const scheduler = read("../android/app/src/main/java/com/solina/assistant/AlarmScheduler.java");
const receiver = read("../android/app/src/main/java/com/solina/assistant/TaskReceiver.java");
const activity = read("../android/app/src/main/java/com/solina/assistant/AlarmActivity.java");
const service = read("../android/app/src/main/java/com/solina/assistant/AlarmPlaybackService.java");
const androidMain = read("../android/app/src/main/java/com/solina/assistant/MainActivity.java");
const taskStore = read("../android/app/src/main/java/com/solina/assistant/TaskStore.java");
const taskReceiver = read("../android/app/src/main/java/com/solina/assistant/TaskReceiver.java");
const alarmActivity = read("../android/app/src/main/java/com/solina/assistant/AlarmActivity.java");

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
assert.match(app, /Keep a short rolling draft across pauses/, "Speech without the wake word must be held briefly across pauses instead of dropped");
assert.match(app, /8000\)/, "Unaddressed speech drafts must expire after a short silence to avoid ambient capture");
assert.match(app, /Typed input follows the same wake-word rule/, "Typed drafts must wait for the wake word when voice session is not active");
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
assert.match(app, /utterance\.rate = 0\.98;[\s\S]{0,80}utterance\.pitch = 1\.08;/, "Browser TTS must configure the declared utterance object");
assert.doesNotMatch(app, /\butter\.(?:rate|pitch)\s*=/, "Browser TTS must not reference an undefined utter variable");
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

const prayerReminder = parseTaskCommand("اعملي تذكير بعد صلاة العصر", new Date("2026-11-28T10:00:00+02:00"));
assert.equal(prayerReminder?.action, "create_prayer_reminder", "Prayer reminder requests must not ask the owner for a clock time");
assert.equal(prayerReminder?.prayer, "asr", "Asr prayer intent must be identified deterministically");
assert.equal(prayerReminder?.offsetMinutes, 0, "A prayer reminder defaults to the prayer's actual time");
const beforePrayer = parseTaskCommand("فكريني قبل صلاة العصر بعشر دقايق", new Date("2026-11-28T10:00:00+02:00"));
assert.equal(beforePrayer?.action, "create_prayer_reminder", "Relative prayer reminders must be recognized");
assert.equal(beforePrayer?.offsetMinutes, -10, "Before-prayer offset must be calculated correctly");
const afterPrayer = parseTaskCommand("اعملي تذكير بعد صلاة المغرب بعشر دقائق", new Date("2026-11-28T10:00:00+02:00"));
assert.equal(afterPrayer?.offsetMinutes, 10, "After-prayer offset must be calculated correctly");


assert.ok(edge.includes("runMemoryInterpreter(admin, userId, MEMORY_GRAPH_INSTRUCTION"), "Explicit memory saves must use the configured model to extract general semantic facts");
assert.ok(edge.includes("memory_graph: memoryGraph"), "Structured semantic facts must be persisted alongside the original note");
assert.ok(edge.includes("MEMORY_RECALL_INSTRUCTION"), "Memory retrieval must use meaning and context rather than keyword-only matching");
assert.ok(edge.includes("MEMORY_DELETE_INSTRUCTION"), "Deletion targets must be resolved by meaning before confirmation");
assert.ok(edge.includes("MEMORY_CORRECTION_INSTRUCTION"), "Corrections must identify a fact and property semantically");
assert.ok(edge.includes("correction_evidence: newValueEvidence"), "Corrected values must retain the user's exact evidence");
assert.ok(edge.includes("semantic_graph: item.metadata?.memory_graph"), "Deletion must compare semantic context when available");
assert.ok(edge.includes("selectedCorrectionIds.length === 1"), "Fact correction must bind to one owner-scoped memory before updating");
assert.ok(edge.includes('pending_action: "delete_confirmation"'), "Semantic deletion must remain confirmation-gated");
assert.ok(edge.includes("newValueIsGrounded"), "Fact correction must verify the proposed value against the user's own wording");
assert.ok(edge.includes("correction_history: [...previousHistory, historyEntry]"), "Fact-level corrections must preserve old and new values in history");
assert.ok(edge.includes("const correctedMemories = notes.filter"), "Correction history retrieval must include non-numeric facts as well as references");
assert.ok(edge.includes("change.previous_value") && edge.includes("change.new_value"), "Old and current values must both be answerable after a correction");
assert.ok(edge.includes("if (!pendingWrite)"), "Deletion confirmation must not be offered for an item that ceased to be active");


assert.ok(edge.includes("validateSemanticRecallIds"), "Semantic retrieval must validate model-selected IDs against owner-scoped saved notes");
assert.ok(edge.includes("original_text: String(note.content"), "Semantic retrieval must compare the complete original note as evidence");
assert.ok(edge.includes("parseExplicitMemorySave(latestUserText)"), "Explicit remember phrases must be parsed by the shared Arabic memory helper");
assert.equal((edge.match(/const latestUserText =/g) || []).length, 1, "Chat memory context must define the latest user text only once");
assert.ok(edge.includes("extractMemoryTokens(latestUserText)"), "Arabic memory tokenization must use the shared tested helper");
assert.match(edge, /relativeDay !== null \|\| explicitDate/, "History recall must support relative and explicit dates");
assert.match(edge, /timeZone: "Africa\/Cairo"/, "History timestamps must be interpreted in Cairo local time");
assert.match(app, /const asksPastConversation =/, "Chat requests must detect references to previous conversations");
assert.match(app, /searchConversationMemory\(text, signal\)/, "Relevant prior transcript excerpts must be added to the model context");
assert.match(app, /وقفنا\\s\+\(\?:فين\|عند\)/, "Archive search must recognize explicit requests to recall where a topic stopped");
assert.doesNotMatch(app.match(/const asksPastConversation = (.*?);/)?.[1] || "", /النهارده|النهاردة|امبارح|مبارح|أمس/, "Ordinary date mentions must not trigger an unnecessary archive search");
assert.doesNotMatch(app.match(/const asksPastConversation = (.*?);/)?.[1] || "", /فاكر\(\?:ة\)\?\|/, "Vague saved-note recall must be handled by the memory lookup without an extra archive request");


console.log("NOVA repository checks passed.");



assert.match(app, /messagesByPersona: \{ soleen: \[\] \}/, "The app must keep only Solina persona state");
assert.match(app, /state\.messagesByPersona\[state\.persona\] = state\.messages\.slice\(\)/, "Current persona history must be saved independently");
assert.match(app, /state\.messages = \(state\.messagesByPersona\[persona\] \|\| \[\]\)\.slice\(\)/, "Switching persona must restore only that persona's history");
assert.match(app, /ابدأ محادثة جديدة مع /, "Persona switch must visually separate the conversation");

assert.match(app, /إفيهات مصرية ذكية ومواقف يومية/, "The AI persona must use natural Egyptian humor");
const solinaPromptStart = app.indexOf('      content: "أنتِ سولينا، بنت مصرية مستقلة الشخصية وصاحبة إسلام.');
const solinaPromptEnd = app.indexOf("\n    });", solinaPromptStart);
assert.ok(solinaPromptStart >= 0 && solinaPromptEnd > solinaPromptStart, "A compact Solina system prompt must be present");
assert.ok(solinaPromptEnd - solinaPromptStart < 3000, "The client-side system prompt must stay compact to reduce latency and token cost");
assert.match(app, /الرد على الموضوع الحالي أولًا/, "The current user request must take priority over unrelated memory");
assert.match(app, /إذا غيّر الموضوع، اتبعي الموضوع الجديد/, "Solina must not force continuity across unrelated topics");
assert.ok(!app.includes("state.profile ||"), "Owner profile must not be duplicated in the client prompt because the backend injects it");

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
assert.match(app, /سولينه\|سولينا\|سيلينه\|سيلينا\|سلينا\|سيليا/, "Speech recognition must normalize common Solina name substitutions");
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
assert.match(edge, /const \[\{ data: memoryRow, error: memoryReadError \}, \{ data: models, error \}, \{ data: aiPreference, error: preferenceError \}, oldRowsResult, notesResult\] = await Promise\.all\(/, "Independent memory, model, preference, history, and selective note reads must run concurrently");
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

assert.match(app, /function openSettings\(\) \{[\s\S]*?showSettingsHome\(\);[\s\S]*?\$\("settingsDialog"\)\.showModal\(\);[\s\S]*?Promise\.allSettled\(\[loadProviders\(\), loadOwnerMemory\(\), loadPersonalItems\(\), loadSpeechSettings\(\), refreshPermissionCards\(\)\]\);[\s\S]*?\}/, "Opening settings must show the category home and refresh providers, memory, personal items, speech, and device permissions");
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
assert.match(html, /id="noteTitle"/, "The account notebook must include a note title field");
assert.match(html, /id="noteContent"/, "The account notebook must include a note body field");
assert.match(html, /id="savedNotesList"/, "Saved account notes must be visible in the notebook");
assert.match(html, /id="tasksFeedback"/, "The tasks page must show cloud synchronization status");
assert.match(html, /كل المواعيد والمنبهات والمهام محفوظة في حسابك السحابي/, "The UI must explain that personal items are account-owned");
assert.match(personalItemsMigration, /create table if not exists public\.nova_personal_items/, "Account-owned reminders, alarms, tasks and notes need a dedicated table");
assert.match(personalItemsMigration, /enable row level security/, "Personal items must enable RLS");
assert.match(personalItemsMigration, /using \(false\) with check \(false\)/, "Direct public and authenticated table access must be denied");
assert.match(personalItemsMigration, /grant all on public\.nova_personal_items to service_role/, "Only the authenticated server function should access personal items");
assert.match(edge, /action === "personal_items_list"/, "The owner API must list account-synced personal items");
assert.match(edge, /action === "personal_item_save"/, "The owner API must save personal items");
assert.match(edge, /action === "personal_item_update"/, "The owner API must update completion and snooze state");
assert.match(edge, /action === "personal_item_delete"/, "The owner API must delete notes");
assert.match(app, /const asksClock =/, "Clock questions must be answered from the device clock without depending on an AI provider");
assert.match(app, /Prayer intent takes precedence over generic clock phrases/, "Prayer intent must be evaluated before generic clock intent");
assert.match(app, /const asksPrayer = \/\(\?:مواقيت/, "Prayer intent must recognize colloquial prayer-time questions");
assert.match(app, /const asksPrayer = \/\(\?:مواقيت[^\n]*\\s\*/ , "Prayer intent regex must use real whitespace matching");
assert.match(app, /const asksClock = !asksPrayer && \/[^\n]*\\s\*/ , "Clock intent regex must use real whitespace matching");
assert.match(app, /const asksClock = !asksPrayer/, "Prayer questions mentioning the word clock must never be mistaken for device clock questions");
assert.match(app, /const remainingMinutes = Math\.max\(0, Math\.ceil\(/, "Prayer countdowns must be calculated from the device clock rather than guessed by the model");
assert.match(app, /prayerRemaining = "الوقت المتبقي محسوب برمجيًا/, "The exact prayer countdown must be supplied to the response model");

assert.match(app, /الفجر\|فجر\|الظهر/, "Short speech-recognition transcripts that omit the definite article in Fajr must still be understood");

assert.match(app, /فاضل/ , "Remaining-time prayer questions must be recognized");
assert.match(app, /متبقي/ , "Alternative remaining-time prayer wording must be recognized");
assert.match(edge, /item.role === "system" \? 24000 : 12000/, "The system prompt must allow the complete assistant instructions without rejecting normal chats");
assert.match(edge, /total > 220000/, "The chat payload limit must leave room for the system prompt and live tool context");

assert.match(app, /hourCycle: "h12"/, "The live clock response must format the device's local time");
assert.ok(app.includes("الساعة\u0020") && app.includes("كام") && app.includes("asksClock"), "Common Egyptian Arabic clock phrases must be recognized");
assert.match(app, /const asksPrayer = \/\(\?:مواقيت\|مواعيد\|أوقات\|وقت\|ميعاد\|موعد\)/, "Prayer intent must include colloquial single-prayer time questions");
assert.match(app, /const asksWeb = \/ابحث\|ابحثي\|دور/, "Internet search intent must recognize feminine and colloquial requests");
assert.match(edge, /html\.duckduckgo\.com\/html\//, "Live web search must use the server-side search integration");
assert.match(edge, /api\.aladhan\.com\/v1\/timingsByCity/, "Prayer times must come from the live AlAdhan service");

assert.match(edge, /\.eq\("user_id", userId\)/, "Personal item queries must always be scoped to the validated owner");
assert.match(app, /invokeNova\("personal_items_list"\)/, "The app must load items from the account rather than device storage");
assert.match(app, /async function syncNativeTasks\(\)/, "Android alarms must be restored from account data on login");
assert.match(app, /migrated_from_device: true/, "Existing local-only reminders must be migrated into the owner account before reconciliation");
assert.match(app, /Keep overdue native reminders alive/, "Account reconciliation must not cancel due reminders before the owner completes them");
assert.match(app, /setInterval\(\(\) => \{\s*if \(state\.session && !document\.hidden\) void loadPersonalItems\(\);\s*\}, 45000\)/, "Open devices must periodically refresh account items");
assert.match(androidMain, /pendingTaskSyncEvents\(\)/, "Android must expose completion and snooze events to the account sync layer");
assert.match(androidMain, /acknowledgeTaskSyncEvent\(String id\)/, "Native sync events must be acknowledged only after cloud updates succeed");
assert.match(taskStore, /recordPendingSync\(Context context, String id, String status, long scheduledAt\)/, "Native task changes must be queued until account sync succeeds");
assert.match(taskReceiver, /recordPendingSync\(context, id, "completed", 0\)/, "Completing a reminder from its notification must sync to the account");
assert.match(taskReceiver, /recordPendingSync\(context, id, "active", next\)/, "Snoozing from a notification must sync the new time to the account");
assert.match(alarmActivity, /recordPendingSync\(this, taskId, "completed", 0\)/, "Stopping the full-screen alarm must sync completion to the account");

assert.match(app, /savePersonalItem\(\{ item_type: "note"/, "Notes must be saved to the account API");
assert.match(app, /await savePersonalItem\(\{ id, item_type: intent\.type/, "Voice reminders must be saved in the account before native scheduling");
assert.match(app, /التنبيه المحلي هيتفعّل عند فتح نسخة أندرويد/, "Web-created reminders must be honestly described as account-saved pending Android scheduling");
assert.doesNotMatch(app, /قائمة التذكيرات والمنبهات تظهر هنا داخل تطبيق APK/, "Reminder visibility must no longer be APK-only");



import { parseTaskCommand, normalizeTaskText } from "../task-manager.js";
const fixedNow = new Date("2026-11-27T08:00:00+02:00");
assert.equal(parseTaskCommand("سولينا سجلي ملاحظة أراجع فكرة التطبيق", fixedNow)?.action, "create_personal_item", "Voice note requests should route to account storage");
assert.equal(parseTaskCommand("سيلينا سجلي ملاحظة أراجع فكرة التطبيق", fixedNow)?.type, "note", "Alternative wake-name pronunciation should still save notes");
assert.equal(parseTaskCommand("ضيفي مهمة أراجع المحاضرة", fixedNow)?.type, "task", "Spoken task creation should create an account task");
assert.equal(parseTaskCommand("وريني الملاحظات", fixedNow)?.action, "list_notes", "Voice requests to list saved notes should be recognized");
assert.equal(parseTaskCommand("وريني المهام", fixedNow)?.action, "list", "Voice requests to list tasks should read the account list");
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
assert.equal(parseTaskCommand("صحيني الفجر", fixedNow)?.action, "create_prayer_reminder", "Fajr alarm must resolve the real prayer time automatically");
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
assert.match(app, /saved = await savePersonalItem\(\{ id, item_type: intent\.type/, "The account must confirm the reminder save before the app reports success");
assert.match(app, /personalItemDate\(saved\) !== at/, "The app must verify the server saved the exact requested reminder time");
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
const alarmService = read("../android/app/src/main/java/com/solina/assistant/AlarmPlaybackService.java");
assert.match(alarmService, /setLooping\(true\)/, "Alarm sound must loop until stopped");
assert.match(alarmActivity, /isStopPhrase/, "Alarm must accept spoken stop commands");
assert.match(alarmActivity, /انا قمت|قمت/, "Alarm must recognize the user confirming they woke up");
assert.match(alarmActivity, /صحيت|صاحي/, "Alarm must also stop when the user says «أنا صحيت» or «أنا صاحي»");
const alarmScheduler = read("../android/app/src/main/java/com/solina/assistant/AlarmScheduler.java");
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
assert.match(app, /let speechPlaybackId = 0/, "Audio output must have a single latest-playback generation guard");
assert.match(app, /window\.SolinaNative\?\.stopSpeaking\?\.\(\)/, "Every new speech turn must stop native TTS before starting");
assert.match(app, /playbackId !== speechPlaybackId/, "Late speech responses and stale cleanup must not restart or silence the newest turn");
assert.match(app, /speechPlaybackId \+= 1/, "Explicit stop/cancel must invalidate pending cloud TTS before it can play");
assert.match(edge, /AlAdhan coordinates backup/, "Prayer-time lookup must retry AlAdhan by coordinates if city endpoint fails");
assert.match(edge, /esalah\.com\/api\/v1\/times/, "Prayer-time lookup must have an independent provider backup");

assert.match(app, /waitForDeviceVoice\(1800\)/, "Web TTS fallback must wait for asynchronous Arabic voice inventory");
assert.match(app, /voiceschanged/, "Web TTS must handle browsers that load voices asynchronously");
assert.match(app, /تعذر تشغيل صوت سولينا:/, "Speech failure must be visible instead of silently dropping audio");

assert.equal(normalizeTaskText("سِيْلينا"), "سولينا", "Common Solina name pronunciations must normalize consistently");
assert.equal(parseTaskCommand("سيلينا افتحي فيسبوك لايت", fixedNow)?.appName, "فيسبوك لايت", "Lite app command with alternate wake name must preserve the exact app variant");
assert.equal(parseTaskCommand("سلينا افتحيلي فيسبوك", fixedNow)?.appName, "فيسبوك", "Colloquial open-me command and shortened wake name must be recognized");
assert.equal(parseTaskCommand("سولي نا شغلي واتساب", fixedNow)?.action, "open_app", "Split wake-name recognition must route app commands locally");
assert.match(androidMain, /facebooklite/, "Android app resolver must recognize Facebook Lite separately");
assert.match(androidMain, /Never mistake Facebook Lite for Facebook/, "Android app resolver must prevent Lite/standard cross-launch");
assert.match(app, /فيسبوك العادي وفيسبوك لايت تطبيقان مختلفان/, "AI system prompt must understand distinct app variants");
assert.match(app, /محرك أوامر الجهاز المحلي/, "AI system prompt must know app opening is a real local capability");

assert.match(edge, /parseExplicitMemorySave\(latestUserText\)/, "Explicit remember phrases must save a user note without relying on model interpretation");
assert.match(edge, /explicit_save: true/, "Explicitly saved memories must be tagged for traceability");
assert.match(edge, /asksRecall/, "Memory recall phrases must be detected");
assert.match(edge, /recalled_notes/, "Recall must report a deterministic note result");
assert.match(edge, /nova_personal_items/, "Saved memories must use the existing unified personal-items table, not another storage system");
assert.match(edge, /classifyMemoryKind\(saveNotePayload\)/, "Explicit memories must be categorized by the shared tested helper");
assert.match(memoryUtils, /return "project"/, "Project facts must have a stable memory category");
assert.match(edge, /"decision".*"task".*"reference"/s, "Decisions, open tasks and reference numbers must have stable memory categories");
assert.match(edge, /memoryGraphMetadata/, "Explicit memory metadata must persist source and semantic graph provenance");
assert.match(edge, /memory_graph: memoryGraph/, "Memory category and semantic graph must be persisted with the original note");
assert.match(edge, /if \(itemType === "note" && typeof metadata\.memory_kind !== "string"\)/, "Manually saved notebook entries must receive the same category organization");

assert.ok(edge.includes('timeZone: "Africa/Cairo"'), "Conversation recall must interpret relative dates in the owner's Egypt timezone");
assert.match(edge, /hourMatch/, "Conversation recall must narrow historical results by a requested hour");
assert.match(edge, /requestedNoteDate/, "Saved personal notes must be retrievable by relative Cairo date");
assert.match(edge, /requestedNoteHour/, "Saved personal notes must be retrievable by requested hour");
assert.equal(extractMemoryTokens("الساعة ٨ مساء").length, 0, "Clock-only requests must skip note retrieval and must not match personal numeric references");
assert.match(edge, /function requiresMultiAgentWork/, "Complex tasks must be routed through adaptive multi-agent orchestration");
assert.match(edge, /Promise\.allSettled\(\[/, "Independent agents must execute concurrently and tolerate one worker failure");
assert.match(edge, /function buildSynthesisMessages/, "A synthesis agent must reconcile parallel worker outputs into one answer");
assert.match(edge, /agent_mode: agentMode/, "Agent execution mode must be observable for diagnostics");
assert.match(edge, /usableModels\.length >= 2/, "Multi-agent mode must fall back safely when fewer than two enabled models exist");
assert.match(edge, /nova_ai_preferences/, "Agent routing must respect the owner's configured preferred model");
assert.match(edge, /orderedModels\.unshift/, "The preferred model must lead the agent roster deterministically");
assert.match(edge, /routing_mode !== "manual"/, "Manual routing preference must disable automatic multi-agent fan-out");

assert.match(edge, /order\("created_at", \{ ascending: true \}\)/, "Fallback agent order must be stable across requests");

assert.match(edge, /single-agent-fallback/, "One successful worker must still return a useful answer when its parallel peer fails");


assert.match(edge, /note\.metadata\?\.memory_kind/, "Relevant categorized notes must carry their category into model context");
assert.match(app, /memoryLabels = \{ project: "مشروع", decision: "قرار", task: "مهمة مفتوحة", reference: "رقم \/ معلومة مرجعية", note: "ملاحظة" \}/, "Personal notebook must display project, decision, open-task and reference categories");


console.log("SOLINA explicit memory save and recall checks passed.");

const correctionByTopic = parseExplicitMemoryCorrection("صححي الرقم الخاص بالحساب وخليه 987654");
assert.deepEqual(correctionByTopic, { target: "الحساب", value: "987654" }, "Correction commands must target the intended saved reference when the user identifies it");
assert.deepEqual(parseExplicitMemoryCorrection("الرقم القديم غلط، الصحيح 123456"), { target: "", value: "123456" }, "A clear correction must extract the new exact value");
assert.deepEqual(parseExplicitMemoryCorrection("صححي الرقم المحفوظ: 555666"), { target: "", value: "555666" }, "A direct saved-number correction must be recognized");
assert.deepEqual(parseExplicitMemoryCorrection("صححي الرقم المحفوظ وخليه 9 8 7 6 5"), { target: "", value: "9 8 7 6 5" }, "Generic descriptors such as saved number must not become literal search targets");
assert.equal(parseExplicitMemoryCorrection("الرقم ده غلط"), null, "Incomplete corrections must not modify saved memory");
const spokenNumberMemory = parseExplicitMemorySave("خليكي فاكرة عندك الرقم ده، واحد اثنين ثلاثة أربعة خمسة");
assert.equal(spokenNumberMemory, "الرقم ده، واحد اثنين ثلاثة أربعة خمسة", "Explicit remember phrases must preserve the complete spoken number payload exactly");
assert.equal(isExplicitMemoryRecall("خليكي فاكرة الرقم ده 1 2 3"), false, "A direct save command must not be treated as a recall question");
assert.equal(isExplicitMemoryRecall("سولينا فاكره الرقم اللي انا قلت لك خليكي حافظاه او خليكي فاكراه"), true, "Egyptian colloquial recall with embedded quoted save wording must be recognized");
assert.equal(parseExplicitMemorySave("سولينا فاكره الرقم اللي انا قلت لك خليكي حافظاه او خليكي فاكراه"), null, "A recall question that mentions a save phrase must never create another note");
assert.equal(parseExplicitMemorySave("سولينا خليكي فاكره الرقم ده 1 2 3"), "الرقم ده 1 2 3", "Egyptian colloquial save pronunciation must be recognized");
assert.equal(parseExplicitMemorySave("لينا خليكي فاكره الرقم ده 1 2 3 4 5 سولينا خليكي فاكره الرقم ده 1 2 3 4 5"), "الرقم ده 1 2 3 4 5", "Repeated voice save commands must keep only the final clean payload");
assert.equal(classifyMemoryKind(spokenNumberMemory), "reference", "Spoken number sequences must be categorized as reference memories");
assert.equal(parseExplicitMemorySave("افتكري الرقم اللي قولتهولك"), null, "A recall request must not be misclassified as a new memory save");
assert.equal(parseExplicitMemorySave("احفظي رقم الحساب 123456789"), "رقم الحساب 123456789", "Direct save commands must capture numeric reference values");
assert.equal(parseExplicitMemorySave("عدلي ميزانية مشروع النور خليها 6000 جنيه واحفظيه بالقيمة القديمة واحتفظي بالقيمة القديمة"), null, "A save-like verb embedded in a correction must not create a garbage memory");
assert.match(edge, /const saveReply = memoryKind === "project"/, "Successful saves must return a short human confirmation instead of exposing graph internals");
assert.match(edge, /correctionHistoryRecall \? correctedMemories : notes/, "Old/new-value recall must semantically rank only corrected memories when relevant");
assert.match(edge, /MEMORY_FACT_DELETE_INSTRUCTION/, "Partial deletion must resolve exact facts inside a combined memory");
assert.match(edge, /pending_fact_deletions/, "Partial deletion must persist the exact selected facts for confirmation");
assert.match(edge, /personal_fact_archived/, "Confirming a partial deletion must archive only the selected facts");
assert.match(edge, /correctedMemoriesForQuery/, "Correction-history recall must be scoped to the subject named by the user");
assert.match(edge, /explicitSaveAtStart/, "A correction that mentions preserving the old value must still enter correction handling");
assert.equal(parseExplicitMemorySave("احفظي ميزانية مشروع النور 5000 جنيه"), "ميزانية مشروع النور 5000 جنيه", "A normal direct save must remain supported after save-trigger boundary hardening");
assert.equal(classifyMemoryKind("رقم الحساب ١٢٣٤٥٦"), "reference", "Arabic-Indic numeric references must be categorized correctly");
assert.equal(classifyMemoryKind("الرقم ده 1 2 3 4 5"), "reference", "Digit-by-digit references must be categorized as reference memories");
assert.equal(extractMemoryNumberSignature("الرقم ده 1 2 3 4 5"), "12345", "Spaced digit-by-digit numbers must yield one stable memory key");
assert.equal(extractMemoryNumberSignature("ه الرقم ده 1 2 3 4 5 سولينا خليكي فاكره الرقم ده 1 2 3 4 5"), "12345", "Repeated ASR copies of the same number must share one stable key");
assert.deepEqual(parseExplicitMemoryCorrection("عايزك تصححي الرقم اللي انت حفظتيه خليه 9 8 7 6 5 سولينا"), { target: "", value: "9 8 7 6 5" }, "Colloquial correction requests with filler and wake words must be accepted");

assert.equal(isExplicitMemoryRecall("فاكرة الرقم؟"), true, "Natural vague recall must activate deterministic memory retrieval");
assert.equal(isExplicitMemoryRecall("سولينا فاكره الرقم"), true, "A wake word before a vague memory question must not block recall");
assert.equal(isCorrectionHistoryRecall("سولينا فاكره الرقم اللي انا قلت لك صححيه"), true, "Wake-word-prefixed correction-history recall must be recognized");

assert.equal(isCorrectionHistoryRecall("فاكر الرقم اللي انا قلت لك صححيه"), true, "Recall of a previously corrected number must target correction history");
assert.equal(isCorrectionHistoryRecall("فاكرة الميزانية القديمة؟"), true, "Old-value recall must work for any corrected property, not only numbers");
assert.equal(isExplicitMemoryRecall("فاكرة الميزانية القديمة؟"), true, "Generic old-value questions must enter correction-history retrieval");
assert.equal(isCorrectionHistoryRecall("فاكره الرقم اللي انا قلت لك صححيه"), true, "Feminine colloquial recall must target correction history");
assert.equal(isCorrectionHistoryRecall("فاكره الرقم اللي قلت لك صححيه"), true, "Shortened spoken correction recall must target correction history");
assert.equal(isExplicitMemoryRecall("هات الرقم اللي حفظته"), true, "Direct requests to retrieve a saved number must be recognized");
assert.equal(isExplicitMemoryRecall("هات كل المعلومات اللي عندك فيها كلمة بطيخ"), true, "General requests to list all saved information by context must enter semantic recall");
assert.equal(isExplicitMemoryRecall("تفتكري إيه رأيك في الفيلم؟"), false, "Ordinary conversational questions must not trigger memory recall");
assert.deepEqual(extractMemoryTokens("الساعة ٨ مساء"), [], "Clock-only questions must not trigger personal-note searches");
assert.deepEqual(extractMemoryTokens("فاكرة الرقم ١٢٣؟"), ["123"], "Arabic digits must normalize for exact reference matching");
assert.deepEqual(extractMemoryTokens("فاكرة الكلمة اللي قلت لك تحفظيها"), [], "Vague word recall must not treat save-command wording as a keyword");
assert.equal(classifyMemoryKind("ان كلمه السر التجريبيه هي بطيخ والرقم التجريبي 1 2 3 4 5"), "reference", "Mixed word-and-number notes must retain their exact-number index");
assert.deepEqual(extractMemoryTokens("سولينا فاكره الرقم اللي انا قلت لك خليكي حافظاه او خليكي فاكراه"), [], "Colloquial vague recall must not treat memory-command words as search keywords");
assert.equal(normalizeMemoryText("إسلام ١٢٣"), "اسلام 123", "Arabic spelling and digit normalization must be stable");
assert.match(edge, /duplicateReadError/, "Repeated explicit memory saves must be deduplicated");
assert.match(edge, /correction_history/, "Memory corrections must preserve a short history of replaced values");
assert.match(edge, /المعلومه\|ملاحظة/, "Delete intent must recognize Egyptian spoken spelling of المعلومة");
assert.match(edge, /uniqueReferenceNotes/, "Reference recall and correction must deduplicate repeated voice-recognition copies");
assert.ok(edge.includes('const signature = "text:" + normalizeMemoryText(content)'), "Memory deduplication must compare the complete note, not a shared numeric value");
assert.ok(edge.includes("const previousSignature = normalizeMemoryText(previousContent)"), "Correction cleanup must not supersede a different subject that happens to share the old number");

assert.match(edge, /extractMemoryNumberSignature/, "Digit-by-digit references must be detected consistently in recall and correction paths");
assert.match(edge, /superseded_by/, "Duplicate reference notes must be retained but excluded after a correction");

assert.match(edge, /correction_needs_clarification/, "Ambiguous reference corrections must ask before changing stored data");
assert.match(edge, /memory_found: false/, "A missing saved memory must return an explicit no-match result instead of asking a model to guess");
assert.match(app, /result\.saved_note[\s\S]*?loadPersonalItems\(\)/, "The notebook must refresh immediately after an explicit personal-note save");
assert.match(app, /else if \(result\.memory_saved\)[\s\S]*?loadOwnerMemory\(\)/, "Automatic profile-memory updates must refresh the profile memory panel, not masquerade as notebook notes");
assert.match(app, /result\.memory_corrected[\s\S]*?loadPersonalItems\(\)/, "The notebook must refresh immediately after a memory correction");
assert.match(edge, /notesPromise/, "Relevant note retrieval must run concurrently with independent chat context reads");
assert.match(edge, /noteTokens\.length >= 2/, "Ordinary greetings and short turns must skip personal-note database queries");
assert.match(edge, /targetMinute !== null && noteMinute !== targetMinute/, "Memory recall must distinguish exact minute timestamps when supplied");


assert.ok(memoryUtils.includes("خلي(?:كي|ك)") && memoryUtils.includes("\\s+"), "Explicit remember phrase matcher must include the Arabic trigger and whitespace token");
assert.match(edge, /ملاحظات المستخدم الشخصية المحفوظة/, "Saved notes must be injected into the model context when relevant");
assert.match(edge, /const asksRecall = isExplicitMemoryRecall\(latestUserText\);\s*const saveNotePayload = asksRecall \? null : parseExplicitMemorySave\(latestUserText\);/, "Recall classification must run before saving so embedded save wording cannot create a new note");
assert.match(edge, /if \(asksRecall\)/, "Personal note retrieval should be deterministic and recall-aware");
assert.match(edge, /correctionHistoryRecall[\s\S]{0,500}correction_history/, "Recall must search corrected-number history");
assert.match(edge, /seenRecallValues/, "Vague number recall must deduplicate repeated saved values");
assert.match(edge, /numberRecall[\s\S]{0,500}memory_kind === "reference"/, "Vague number recall must exclude unrelated notes");
assert.match(edge, /numberRecall \? \(correctedReferences\.length/, "Vague number recall must prefer corrected references over stale values");
console.log("SOLINA memory-context integration checks added.");
