import { parseTaskCommand, formatTaskDate } from "./task-manager.js?v=solina-device-router-v2";
const $ = (id) => document.getElementById(id);
const state = {
  persona: "soleen", emotion: "idle", listening: false, speaking: false,
  recognition: null, restartRecognition: false, processing: false, nativeSpeech: false, voiceSessionActive: false, voiceDraft: "", voicePauseTimer: null, passwordRecovery: false, recoveryEmail: "", ownerName: "إسلام",
  messages: [], voiceAlternatives: [], pendingTaskDraft: null, messagesByPersona: { soleen: [] }, conversationIds: { soleen: null }, historyQueues: { soleen: Promise.resolve() }, requestController: null, requestSequence: 0, interruptRecognition: null, session: null, providers: [], models: [], audio: null, profile: ""
};
const VOICE_TURN_PAUSE_MS = 480;
const personas = { soleen: { name: "سولينا", description: "مساعدتك الصوتية 💗", color: "#b9a5ff", accent: "#7959d6", intro: "سولينا معاكي" } };
// Remove saved settings and audio generated for retired character/voice paths.
for (const key of ["nova.persona", "nova.activeConversation.soly", "nova.elevenlabs.voice.male", "nova.sonex.voice.male"]) {
  localStorage.removeItem(key);
}
for (let index = localStorage.length - 1; index >= 0; index--) {
  const key = localStorage.key(index);
  if (key && key.startsWith("nova.stopAudio.cache.v1.")) localStorage.removeItem(key);
}
let speechAudioContext = null;

// Reuse identical Gemini TTS output during this page session. This cache is
// memory-only; conversation text and generated audio are not persisted.
const speechAudioCache = new Map();
const SPEECH_AUDIO_CACHE_MAX_ENTRIES = 6;
const SPEECH_AUDIO_CACHE_MAX_BYTES = 4 * 1024 * 1024;
let speechAudioCacheBytes = 0;
function getSpeechAudioCache(key) {
  const cached = speechAudioCache.get(key);
  if (!cached) return null;
  speechAudioCache.delete(key);
  speechAudioCache.set(key, cached);
  return cached.result;
}
function rememberSpeechAudio(key, result) {
  if (!key || !result?.audio || result.audio.length > SPEECH_AUDIO_CACHE_MAX_BYTES) return;
  const previous = speechAudioCache.get(key);
  if (previous) speechAudioCacheBytes -= previous.bytes;
  const entry = { result: { audio: result.audio, mime_type: result.mime_type, provider: result.provider, voice: result.voice }, bytes: result.audio.length };
  speechAudioCache.delete(key);
  speechAudioCache.set(key, entry);
  speechAudioCacheBytes += entry.bytes;
  while (speechAudioCache.size > SPEECH_AUDIO_CACHE_MAX_ENTRIES || speechAudioCacheBytes > SPEECH_AUDIO_CACHE_MAX_BYTES) {
    const oldestKey = speechAudioCache.keys().next().value;
    const oldest = speechAudioCache.get(oldestKey);
    speechAudioCacheBytes -= oldest?.bytes || 0;
    speechAudioCache.delete(oldestKey);
  }
}

function setStatus(label, mood = "idle") {
  const statusNode = $("characterStatus"); if (statusNode) statusNode.textContent = label;
  $("voiceState").textContent = label;
  document.body.dataset.mood = mood;
  window.solinaWave?.setMood(mood);
}
const NOVA_EMOTIONS = new Set(["neutral","happy","sad","surprised","curious","caring","playful","concerned","thinking"]);
function setSpeechSegmentTone(emotion) { state.replyEmotion = NOVA_EMOTIONS.has(emotion) ? emotion : "neutral"; window.solinaWave?.setExpression(state.replyEmotion); }
function inferReplyTone(reply) {
  const value = String(reply || "").toLowerCase();
  const patterns = [
    ["sad", /(حزين|زعلان|مضايق|مؤلم|خسارة|فقدان|وحشت|آسف|متأسف|صعب عليك|قلبي معاك)/],
    ["concerned", /(خطر|مشكلة كبيرة|خايف|قلقان|انتبه|احذر|مش آمن|طوارئ)/],
    ["surprised", /(بجد؟|معقول|يا نهار|مفاجأة|مش متوقع|غريبة جدًا|واو|يا سلام!)/],
    ["playful", /(هههه|😂|🤣|نكتة|بهزر|هزار|مقلب|إفيه)/],
    ["happy", /(مبروك|فرحان|مبسوط|سعيد|رائع|عظيم|نجحت|أحسنت|👏|❤️|💙|😍)/],
    ["caring", /(أنا معاك|جنبك|متقلقش|اطمن|فاهمك|حاسس بيك|تستاهل|خد وقتك)/],
    ["curious", /(احكيلي|قولي|نفسي أعرف|خليني أسألك|إيه رأيك|تفتكر|ليه؟|إزاي؟)/],
    ["thinking", /(خليني أفكر|تعالى نفكر|من الناحية|الاحتمال|تحليل|نحسبها|أولًا)/]
  ];
  for (const [emotion, pattern] of patterns) if (pattern.test(value)) return emotion;
  return "neutral";
}
function sanitizeInternalReply(rawReply) {
  let text = String(rawReply || "");
  const entities = { "&lt;":"<", "&gt;":">", "&quot;":"\"", "&#91;":"[", "&#93;":"]", "&amp;":"&", "&#60;":"<", "&#62;":">" };
  for (let pass = 0; pass < 3; pass++) text = text.replace(/&lt;|&gt;|&quot;|&#91;|&#93;|&amp;|&#60;|&#62;/gi, (entity) => entities[entity.toLowerCase()] || entity);  text = text.replace(/(NOVA|NOA)\\[_-]?MEMORY/gi, "$1_MEMORY");

  text = text.replace(/<\s*(?:NOVA|NOA)[_-]?MEMORY\b[^>]*>[\s\S]*?<\s*\/\s*(?:NOVA|NOA)[_-]?MEMORY\s*>/gi, "");
  text = text.replace(/<\s*\/?\s*(?:NOVA|NOA)[_-]?MEMORY\b[^>]*>/gi, "");
  text = text.replace(/<\s*\/?\s*(?:OWNER|NOVA)[_-]?(?:MEMORY|MEMORY_DATA)\b[^>]*>/gi, "");
  text = text.replace(/\b(?:NOVA|NOA)[_-]?MEMORY\b\s*[:=]?\s*\{\s*["']facts["']\s*:\s*\[[\s\S]*?\]\s*\}/gi, "");
  // Never expose internal face-emotion control tokens, even if the model omits brackets.
  text = text.replace(/\[?\s*(?:NOVA|NOA)[\s_-]*EMOTION\s*[:=]\s*(?:neutral|happy|sad|surprised|curious|caring|playful|concerned|thinking)\s*(?:→|->|➜)?\s*\?*\s*\]?/gi, " ");
  return text.replace(/\s{2,}/g, " ").trim();
}

function extractSpeechSegments(rawReply) {
  const raw = sanitizeInternalReply(rawReply);
  const markerPattern = /\[NOVA_EMOTION:(neutral|happy|sad|surprised|curious|caring|playful|concerned|thinking)\]/ig;
  const markers = [...raw.matchAll(markerPattern)];
  const cleanText = raw.replace(markerPattern, "").replace(/\s+/g, " ").trim();
  if (!markers.length) {
    const emotion = inferReplyTone(cleanText);
    return { text: cleanText, emotion, segments: [{ text: cleanText, emotion }] };
  }
  if (markers.length === 1 && !raw.slice(markers[0].index + markers[0][0].length).trim()) {
    const emotion = markers[0][1].toLowerCase();
    return { text: cleanText, emotion, segments: [{ text: cleanText, emotion }] };
  }
  let currentEmotion = "neutral";
  let cursor = 0;
  const segments = [];
  for (const marker of markers) {
    const part = raw.slice(cursor, marker.index).replace(/\s+/g, " ").trim();
    if (part) segments.push({ text: part, emotion: currentEmotion });
    currentEmotion = marker[1].toLowerCase();
    cursor = marker.index + marker[0].length;
  }
  const tail = raw.slice(cursor).replace(/\s+/g, " ").trim();
  if (tail) segments.push({ text: tail, emotion: currentEmotion });
  const usable = segments.length ? segments : [{ text: cleanText, emotion: currentEmotion }];
  return { text: cleanText, emotion: usable[0].emotion, segments: usable };
}
function updateSpeechSegmentProgress(segments, progress) {
  if (!Array.isArray(segments) || !segments.length) return;
  const total = segments.reduce((sum, segment) => sum + Math.max(1, segment.text.length), 0);
  let position = Math.max(0, Math.min(0.999, progress)) * total;
  for (const segment of segments) {
    const weight = Math.max(1, segment.text.length);
    if (position < weight) { setSpeechSegmentTone(segment.emotion); return; }
    position -= weight;
  }
  setSpeechSegmentTone(segments[segments.length - 1].emotion);
}
function setSpeechMouthLevel(level, brightness = 0) {
  const amount = Math.max(0, Math.min(1, level)), energy = Math.max(0, Math.min(1, brightness));
  window.solinaWave?.setLevel(amount, energy);
}
function resetSpeechMouth() {
  window.solinaWave?.setLevel(0, .12);
}
function connectSpeechAnalyser(source) {
  try {
    const analyser = speechAudioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(speechAudioContext.destination);
    return analyser;
  } catch (error) {
    console.warn("NOVA speech analyser unavailable.", error);
    return null;
  }
}
function animateOrbFromAudio(analyser, isActive, progress) {
  const samples = new Uint8Array(analyser.fftSize);
  const frequencies = new Uint8Array(analyser.frequencyBinCount);
  const animate = () => {
    if (!state.speaking || !isActive()) return;
    analyser.getByteTimeDomainData(samples);
    analyser.getByteFrequencyData(frequencies);
    let energy = 0, peak = 0, low = 0, high = 0;
    for (const sample of samples) {
      const centered = (sample - 128) / 128;
      energy += centered * centered;
      peak = Math.max(peak, Math.abs(centered));
    }
    for (let i = 2; i < frequencies.length; i++) {
      if (i < 12) low += frequencies[i];
      else if (i > 24) high += frequencies[i];
    }
    const rms = Math.sqrt(energy / samples.length);
    const loudness = Math.min(1, rms * 6.5);
    const spectralEnergy = Math.min(1, (low / 10 + high / 18) / 255);
    setSpeechMouthLevel(Math.min(1, rms * 8 + peak * 0.12), Math.max(loudness, spectralEnergy * 0.7));
    if (typeof progress === "function") progress();
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
function trackAudioElementOrb(audio, segments) {
  audio.addEventListener("timeupdate", () => {
    if (state.speaking && Number.isFinite(audio.duration) && audio.duration > 0) updateSpeechSegmentProgress(segments, audio.currentTime / audio.duration);
  });
  let analyser = null;
  try {
    if (!speechAudioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      speechAudioContext = new AudioContextClass();
    }
    // Attach the analyser before playback so the first audible frame is animated.
    const source = speechAudioContext.createMediaElementSource(audio);
    analyser = connectSpeechAnalyser(source);
    if (speechAudioContext.state === "suspended") void speechAudioContext.resume().catch(() => {});
  } catch (error) {
    console.warn("NOVA speech waveform tracking unavailable.", error);
  }
  let started = false;
  audio.addEventListener("playing", () => {
    if (started || !state.speaking || state.audio?.element !== audio) return;
    started = true;
    setStatus(personas[state.persona].name + " بيتكلم...", "speaking");
    if (analyser) animateOrbFromAudio(analyser, () => state.audio?.element === audio, () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) updateSpeechSegmentProgress(segments, audio.currentTime / audio.duration);
    });
  });
}
function setPersona(persona) {
  if (!personas[persona]) return;
  if (state.processing && state.persona !== persona) {
    showToast("استنى الرد الحالي يخلص قبل ما تبدّل الشخصية.");
    return;
  }
  if (state.persona !== persona) {
    localStorage.setItem("nova.persona", persona);
    // Keep each character's conversation isolated; never pass one persona's
    // system prompt or chat history to the other persona.
    state.messagesByPersona[state.persona] = state.messages.slice();
    state.persona = persona;
    state.conversationIds[persona] = localStorage.getItem("nova.activeConversation." + persona) || null;
    state.messages = (state.messagesByPersona[persona] || []).slice();
    state.replySegments = [];
    state.replyEmotion = "neutral";
    const log = $("conversationLog");
    if (log) {
      log.replaceChildren();
      const empty = document.createElement("p");
      empty.className = "empty-conversation";
      empty.textContent = "ابدأ محادثة جديدة مع " + personas[persona].name;
      log.append(empty);
    }
    if (state.audio) { try { state.audio.pause(); } catch (_) {} state.audio = null; }
    if (speechAudioElement) { try { speechAudioElement.pause(); } catch (_) {} speechAudioElement = null; }
    if (currentSpeechUrl) { URL.revokeObjectURL(currentSpeechUrl); currentSpeechUrl = null; }
    state.speaking = false;
    void loadConversationHistory(true);
  }
  const current = personas[persona];
  document.documentElement.style.setProperty("--persona", current.color);
  document.documentElement.style.setProperty("--persona-deep", current.accent);
  

  
  setStatus(current.intro, state.listening ? "listening" : "idle");
}
function animateCharacter(kind) {
  const stage = $("characterStage"); if (!stage) return;
  const className = "gesture-" + kind;
  stage.classList.remove("gesture-wave","gesture-happy","gesture-thinking","gesture-nod");
  void stage.offsetWidth; stage.classList.add(className);
  window.setTimeout(() => stage.classList.remove(className), 900);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));
}
function addConversationLine(text, speaker) {
  const log = $("conversationLog");
  const empty = log.querySelector(".empty-conversation");
  if (empty) empty.remove();
  const line = document.createElement("div");
  line.className = "conversation-line " + speaker;
  const label = speaker === "owner" ? state.ownerName : personas[state.persona].name;
  const name = document.createElement("span");
  name.textContent = label;
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  line.append(name, paragraph);
  log.append(line);
  log.scrollTop = log.scrollHeight;
}
let currentSpeechUrl = null;
let speechAudioElement = null;
function cleanSpeechText(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " تم عرض كود في الرسالة. ")
    .replace(/https?:\/\/\S+/g, " الرابط موجود في الرسالة. ")
    .replace(/[*_#>\x60]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2600);
}
function getDeviceArabicVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const arabic = voices.filter((voice) => /^ar(-|$)/i.test(voice.lang || ""));
  const egyptian = arabic.filter((voice) => /^ar-EG$/i.test(voice.lang || ""));
  const female = (pool) => pool.find((voice) => voice.gender === "female" || /female|woman|salma|zira|sara|hoda|laila|layla|noura|noora/i.test(voice.name || ""));
  // Prefer an Egyptian female voice, but never block speech because gender metadata is missing.
  return female(egyptian) || egyptian[0] || female(arabic) || arabic[0] || voices[0] || null;
}
function speakWithDevice(text, segments = []) {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      reject(new Error("محرك النطق غير متاح في المتصفح ده. افتح NOVA من Chrome على أندرويد."));
      return;
    }
    window.speechSynthesis.cancel();
    const voice = getDeviceArabicVoice();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang || "ar-EG";
    utterance.rate = 0.98;
    utterance.pitch = 1.08;
    if (voice) utterance.voice = voice;

    // Android's SpeechSynthesis often emits no boundary events and exposes no audio
    // waveform. Drive the Solina audio orb from a speech-timed syllable envelope instead.
    let rafId = 0;
    let startedAt = 0;
    let estimatedDuration = Math.max(1800, (text.length / 13.5) * 1000 / utterance.rate);
    let lastBoundaryProgress = 0;
    let ended = false;
    const tick = (now) => {
      if (ended || !state.speaking) return;
      const elapsed = Math.max(0, now - startedAt);
      const progress = Math.min(0.995, elapsed / estimatedDuration);
      // Keep the visual timing aligned when a browser does provide word boundaries.
      const visualProgress = Math.max(progress * 0.72, lastBoundaryProgress);
      updateSpeechSegmentProgress(segments, visualProgress);
      const charIndex = Math.min(text.length - 1, Math.floor(progress * text.length));
      const currentChar = text[charIndex] || "";
      const isPause = /[،,.!?؟؛]/.test(currentChar);
      const syllableRate = 5.2 + (currentChar.charCodeAt(0) % 4) * 0.45;
      const pulse = Math.abs(Math.sin(elapsed / 1000 * Math.PI * syllableRate));
      const emphasis = /[اويىةآ]/.test(currentChar) ? 1 : 0.72;
      const mouthLevel = isPause ? 0.035 : 0.12 + pulse * emphasis * 0.72;
      setSpeechMouthLevel(mouthLevel, isPause ? 0.08 : 0.22 + pulse * 0.55);
      rafId = requestAnimationFrame(tick);
    };
    const stopVisuals = () => {
      ended = true;
      if (rafId) cancelAnimationFrame(rafId);
      resetSpeechMouth();
    };
    utterance.onstart = () => {
      startedAt = performance.now();
      setStatus(personas[persona].name + " بيجهز الصوت...", "thinking");
      rafId = requestAnimationFrame(tick);
    };
    utterance.onboundary = (event) => {
      if (Number.isFinite(event.charIndex) && text.length) {
        lastBoundaryProgress = Math.max(lastBoundaryProgress, event.charIndex / text.length);
        // Some Android engines send only a few boundaries; use them to correct
        // the estimated clock without making the mouth jump or freeze.
        updateSpeechSegmentProgress(segments, lastBoundaryProgress);
      }
    };
    utterance.onend = () => { stopVisuals(); resolve(); };
    utterance.onerror = (event) => {
      stopVisuals();
      const errorCode = event.error || "unknown";
      reject(new Error("محرك الجهاز فشل في النطق: " + errorCode));
    };
    utterance.onpause = () => { if (rafId) cancelAnimationFrame(rafId); };
    utterance.onresume = () => { if (!ended) rafId = requestAnimationFrame(tick); };
    window.speechSynthesis.speak(utterance);
  });
}
async function speak(text, segments = [], signal) {
  const spokenText = cleanSpeechText(text);
  if (!spokenText) return;
  const persona = "soleen";
  const speechSegments = segments.length ? segments : [{ text: spokenText, emotion: state.replyEmotion || "neutral" }];
  state.speaking = true;
  // Keep the dedicated interrupt listener alive during playback so "اسكت"
  // can cancel speech immediately instead of being ignored.
  if (state.listening) startInterruptRecognition();
  if (state.audio) { try { state.audio.pause(); } catch (_) {} state.audio = null; }
  if (state.listening && state.nativeSpeech) window.setTimeout(() => { if (state.listening && state.nativeSpeech && !state.processing && !state.speaking) startNativeSpeechCapture(); }, 400);
  if (speechAudioElement) { try { speechAudioElement.pause(); } catch (_) {} speechAudioElement = null; }
  if (currentSpeechUrl) { URL.revokeObjectURL(currentSpeechUrl); currentSpeechUrl = null; }
  const engine = $("speechEngine")?.value || localStorage.getItem("nova.speech.engine") || "server";
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    state.speaking = false;
    stopInterruptRecognition();
    state.audio = null;
    resetSpeechMouth();
    setSpeechSegmentTone("neutral");
    setStatus(state.listening ? "سامعك، كمل كلامك" : "مستنيك تبدأ", state.listening ? "listening" : "idle");
    if (state.listening && state.recognition) window.setTimeout(() => { try { state.recognition.start(); } catch (_) {} }, 350);
  };
  setSpeechSegmentTone(speechSegments[0]?.emotion || state.replyEmotion || "neutral");
  setStatus(personas[persona].name + " بيتكلم...", "speaking");
  try {
    if (engine === "mute") { finish(); return; }
    if (engine === "device") {
      state.audio = { pause: () => { window.speechSynthesis.cancel(); finish(); } };
      await speakWithDevice(spokenText, speechSegments);
      finish();
      return;
    }
    const speechVendor = $("speechProvider")?.value || localStorage.getItem("nova.speech.provider") || "elevenlabs";
    const voicePrefix = speechVendor === "elevenlabs" ? "nova.elevenlabs.voice." : "nova.sonex.voice.";
    const voiceId = localStorage.getItem(voicePrefix + "female") || "";
    const useGeminiTts = engine === "gemini";
    const speechAction = useGeminiTts ? "tts_gemini" : "tts";
    // Auto follows the provider selected in settings. Any cloud failure falls back to the phone TTS.
    // Gemini receives the complete reply in ONE request, never one request per sentence.
    const geminiCacheKey = useGeminiTts ? JSON.stringify([persona, "gemini-2.5-flash-preview-tts", spokenText]) : "";
    let result = geminiCacheKey ? getSpeechAudioCache(geminiCacheKey) : null;
    if (!result) result = await invokeNova(speechAction, { text: spokenText, persona, voice_id: voiceId, provider: speechVendor }, { signal });
    if (!result.audio || typeof result.audio !== "string") throw new Error("الخادم مرجعش بيانات صوت.");
    const mime = String(result.mime_type || "").split(";")[0].trim().toLowerCase();
    if (!["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"].includes(mime)) {
      throw new Error("الخادم رجّع صيغة صوت غير مدعومة: " + (mime || "غير معروفة"));
    }
    const binary = atob(result.audio);
    if (binary.length < 48) throw new Error("ملف الصوت المستلم فارغ أو غير صالح.");
    if ((mime === "audio/wav" || mime === "audio/x-wav") && (binary.slice(0, 4) !== "RIFF" || binary.slice(8, 12) !== "WAVE")) {
      throw new Error("ملف WAV المستلم غير صالح.");
    }
    if (geminiCacheKey && !signal?.aborted && !speechAudioCache.has(geminiCacheKey)) rememberSpeechAudio(geminiCacheKey, result);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const audioBlob = new Blob([bytes], { type: mime });
    currentSpeechUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio();
    audio.preload = "auto"; audio.src = currentSpeechUrl; audio.playsInline = true;
    speechAudioElement = audio;
    let audioPlaybackStarted = false;
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", () => {
      if (audioPlaybackStarted) {
        finish();
        showToast("المتصفح أوقف ملف الصوت (خطأ تشغيل " + (audio.error?.code || "غير معروف") + ").");
      }
    }, { once: true });
    state.audio = { pause: () => { audio.pause(); finish(); }, element: audio };
    try {
      trackAudioElementOrb(audio, speechSegments);
      await audio.play();
      audioPlaybackStarted = true;
    } catch (playError) {
      // Android can reject delayed HTMLAudio playback; decode through the unlocked AudioContext.
      try { audio.pause(); audio.removeAttribute("src"); audio.load(); } catch (_) {}
      speechAudioElement = null;
      state.audio = null;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass || !["NotSupportedError", "NotAllowedError"].includes(playError?.name)) throw playError;
      if (!speechAudioContext) speechAudioContext = new AudioContextClass();
      if (speechAudioContext.state === "suspended") await speechAudioContext.resume();
      const buffer = await speechAudioContext.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      const source = speechAudioContext.createBufferSource();
      source.buffer = buffer;
      source.onended = finish;
      const analyser = connectSpeechAnalyser(source);
      state.audio = { pause: () => { try { source.stop(); } catch (_) {} finish(); } };
      if (analyser) {
        const startedAt = performance.now();
        animateOrbFromAudio(analyser, () => state.audio !== null, () => {
          updateSpeechSegmentProgress(speechSegments, Math.min(1, (performance.now() - startedAt) / (buffer.duration * 1000)));
        });
      }
      setStatus(personas[persona].name + " بيتكلم...", "speaking");
      source.start(0);
    }
  } catch (error) {
    state.speaking = false;
    state.audio = null;
    resetSpeechMouth();
    if (currentSpeechUrl) { URL.revokeObjectURL(currentSpeechUrl); currentSpeechUrl = null; }
    if (error?.name === "AbortError" || signal?.aborted) { resetSpeechMouth(); return; }
    // Last-resort voice: use any installed phone voice (Arabic preferred), without
    // surfacing provider/network errors to the conversation. Never let TTS failure
    // block the text reply.
    if (engine !== "device" && !signal?.aborted) {
      try {
        state.speaking = true;
        setStatus(personas[persona].name + " بيتكلم...", "speaking");
        state.audio = { pause: () => { window.speechSynthesis?.cancel?.(); finish(); } };
        await speakWithDevice(spokenText, speechSegments);
        finish();
        return;
      } catch (deviceError) {
        console.warn("All speech outputs unavailable; keeping the text reply visible.", error, deviceError);
      }
    } else {
      console.warn("Selected device speech output is unavailable.", error);
    }
    finish();
  }
}
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3000);
}
function setFeedback(id, message, isError = false) {
  const node = $(id);
  if (!node) return;
  node.textContent = message;
  node.style.color = isError ? "#ff9d91" : "";
}
const settingsPageTitles = {
  profile: "الملف الشخصي",
  memory: "دفتر سولينا",
  reminders: "كتالوج التذكيرات",
  voice: "الصوت والتفاعل",
  ai: "مركز الذكاء الاصطناعي"
};
function showSettingsHome() {
  document.querySelectorAll("[data-settings-page]").forEach(page => { page.hidden = true; });
  const home = document.querySelector("[data-settings-home]");
  if (home) home.hidden = false;
  const back = $("settingsBackButton");
  if (back) back.hidden = true;
  const title = $("settingsDialogTitle");
  if (title) title.textContent = "إعدادات SOLINA";
  const content = document.querySelector(".settings-content");
  if (content) content.scrollTop = 0;
}
function openSettingsPage(pageId) {
  if (!settingsPageTitles[pageId]) return;
  const home = document.querySelector("[data-settings-home]");
  if (home) home.hidden = true;
  document.querySelectorAll("[data-settings-page]").forEach(page => {
    page.hidden = page.dataset.settingsPage !== pageId;
  });
  const back = $("settingsBackButton");
  if (back) back.hidden = false;
  const title = $("settingsDialogTitle");
  if (title) title.textContent = settingsPageTitles[pageId];
  const content = document.querySelector(".settings-content");
  if (content) content.scrollTop = 0;
  if (pageId === "reminders") renderScheduledTasks();
  if (pageId === "ai") void loadProviders();
  if (pageId === "memory") void loadOwnerMemory();
  if (pageId === "voice") void Promise.allSettled([loadSpeechSettings()]);
}
function openSettings() {
  showSettingsHome();
  $("settingsDialog").showModal();
  void Promise.allSettled([loadProviders(), loadOwnerMemory(), loadSpeechSettings()]);
}
function closeSettings() { $("settingsDialog").close(); }

const providerDefaults = {
  gemini: { label: "Google Gemini", url: "https://generativelanguage.googleapis.com/v1beta" },
  openrouter: { label: "OpenRouter", url: "https://openrouter.ai/api/v1" },
  openai: { label: "OpenAI", url: "https://api.openai.com/v1" },
  anthropic: { label: "Claude (Anthropic)", url: "https://api.anthropic.com/v1" },
  custom: { label: "مزود مخصص", url: "https://api.example.com/v1" }
};
async function invokeNova(action, payload = {}, options = {}) {
  // Recover a validated owner session on demand before any protected API call.
  if (!state.session && typeof window.novaEnsureOwnerSession === "function") {
    const restoredToken = await window.novaEnsureOwnerSession();
    if (typeof restoredToken === "string" && restoredToken) state.session = restoredToken;
  }
  const token = state.session;
  if (!token) throw new Error("جلسة المالك غير متصلة. تعذر استعادتها تلقائيًا؛ افتح شاشة الدخول وحاول مرة أخرى.");
  const response = await fetch("https://razvryvazmqvvqkzetuo.supabase.co/functions/v1/nova-ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": "sb_publishable_t5xrzZNN6Uj9zhhBLUYQVg_mj7qPjQL",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({ action, ...payload }),
    ...(options.signal ? { signal: options.signal } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      state.session = null;
      localStorage.removeItem("nova.owner.session.v2");
      activatedOwnerSession = null;
      $("authGate").hidden = false;
      if ($("pinLoginForm")) $("pinLoginForm").hidden = false;
    }
    const providerDetails = Array.isArray(data?.failures) ? data.failures.map((item) => String(item)).slice(0, 8).join(" | ") : "";
    const message = data?.error || "تعذر الاتصال بخادم NOVA (" + response.status + ")";
    throw new Error(providerDetails ? message + " — تفاصيل النماذج: " + providerDetails : message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
function applyProviderDefaults() {
  const preset = providerDefaults[$("providerType").value] || providerDefaults.custom;
  $("providerBaseUrl").value = preset.url;
  $("providerBaseUrl").dataset.userEdited = "";
  if (!$("providerLabel").value.trim()) $("providerLabel").placeholder = preset.label + " الشخصي";
  $("customProviderWarning").hidden = $("providerType").value !== "custom";
}
async function loadProviders() {
  if (!state.session && typeof window.novaEnsureOwnerSession === "function") {
    $("providerList").textContent = "جاري استعادة جلسة المالك والتحقق منها...";
    const restoredToken = await window.novaEnsureOwnerSession();
    if (typeof restoredToken === "string" && restoredToken) state.session = restoredToken;
  }
  if (!state.session) {
    $("providerList").textContent = "جلسة المالك غير متصلة. افتح شاشة الدخول لاستعادتها.";
    return;
  }
  const container = $("providerList");
  container.textContent = "جاري تحميل مفاتيح API المحفوظة...";
  try {
    const data = await invokeNova("list");
    if (!Array.isArray(data.providers) || !Array.isArray(data.models)) {
      throw new Error("استجابة قائمة المفاتيح من الخادم غير مكتملة.");
    }
    state.providers = data.providers;
    state.models = data.models;
    renderProviders();
    setFeedback("settingsFeedback", state.providers.length
      ? "تم تحميل " + state.providers.length + " مفتاح محفوظ من الخادم."
      : "اتصلنا بالخادم، ولم يتم العثور على مفاتيح لهذا الحساب.");
  } catch (error) {
    container.replaceChildren();
    const message = document.createElement("p");
    message.className = "empty-provider-list";
    message.textContent = "تعذر تحميل المفاتيح من الخادم: " + error.message + " — اضغط تحديث القائمة للمحاولة مرة أخرى.";
    container.append(message);
    setFeedback("settingsFeedback", error.message, true);
  }
}
function renderProviders() {
  const container = $("providerList");
  container.replaceChildren();
  if (!state.providers.length) {
    const empty = document.createElement("p");
    empty.className = "empty-provider-list";
    empty.textContent = "لا توجد مفاتيح مضافة حتى الآن.";
    container.append(empty);
    return;
  }
  state.providers.forEach((provider) => {
    const models = state.models.filter((model) => model.api_key_id === provider.id);
    const enabledCount = models.filter((model) => model.enabled).length;
    const card = document.createElement("article");
    card.className = "provider-card";
    const head = document.createElement("div");
    head.className = "provider-card-head";
    const title = document.createElement("span");
    title.className = "provider-card-title";
    title.textContent = provider.label;
    const status = document.createElement("span");
    status.className = "badge " + (provider.is_active ? "provider-active" : "provider-inactive");
    status.textContent = provider.is_active ? "مفعّل" : "متوقف";
    const count = document.createElement("span");
    count.className = "badge";
    count.textContent = enabledCount + " / " + models.length + " نموذج";
    const badges = document.createElement("div");
    badges.className = "provider-badges";
    badges.append(status, count);
    head.append(title, badges);
    const meta = document.createElement("div");
    meta.className = "provider-card-meta";
    meta.textContent = provider.provider + " · " + provider.base_url;
    const actions = document.createElement("div");
    actions.className = "provider-card-actions";
    const sync = document.createElement("button");
    sync.type = "button"; sync.textContent = "تحديث النماذج";
    sync.addEventListener("click", async () => {
      sync.disabled = true; sync.textContent = "جاري الفحص...";
      try {
        const result = await invokeNova("sync_models", { provider_id: provider.id });
        await loadProviders();
        setFeedback("settingsFeedback", "تم اكتشاف/مزامنة " + result.synced + " نموذج.");
      } catch (error) { setFeedback("settingsFeedback", error.message, true); }
      finally { sync.disabled = false; sync.textContent = "تحديث النماذج"; }
    });
    const providerToggle = document.createElement("button");
    providerToggle.type = "button";
    providerToggle.textContent = provider.is_active ? "إيقاف المفتاح وكل نماذجه" : "تفعيل المفتاح وكل نماذجه";
    providerToggle.addEventListener("click", async () => {
      providerToggle.disabled = true;
      try {
        await invokeNova("toggle_provider", { provider_id: provider.id, enabled: !provider.is_active });
        await loadProviders();
        setFeedback("settingsFeedback", provider.is_active
          ? "تم إيقاف المفتاح. كل النماذج التابعة له توقفت عن الاستخدام."
          : "تم تفعيل المفتاح. النماذج المفعّلة التابعة له أصبحت متاحة.");
      } catch (error) { setFeedback("settingsFeedback", error.message, true); }
      finally { providerToggle.disabled = false; }
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger-button";
    remove.textContent = "حذف المفتاح";
    remove.addEventListener("click", async () => {
      if (!window.confirm("حذف المفتاح نهائيًا؟ سيتم حذف جميع نماذجه وحذف السر من Vault، ولا يمكن التراجع.")) return;
      remove.disabled = true;
      try {
        await invokeNova("delete_provider", { provider_id: provider.id });
        await loadProviders();
        setFeedback("settingsFeedback", "تم حذف المفتاح وجميع نماذجه من NOVA وVault.");
      } catch (error) {
        setFeedback("settingsFeedback", error.message, true);
        remove.disabled = false;
      }
    });
    actions.append(providerToggle, remove);
    const show = document.createElement("button");
    show.type = "button"; show.textContent = "النماذج (" + models.length + ")";
    const list = document.createElement("div");
    list.className = "model-list";
    list.hidden = true;
    show.addEventListener("click", () => { list.hidden = !list.hidden; });
    models.forEach((model) => {
      const row = document.createElement("div"); row.className = "model-row";
      const label = document.createElement("span"); label.textContent = model.model_id;
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.checked = model.enabled === true;
      toggle.disabled = provider.is_active !== true;
      toggle.setAttribute("aria-label", "تفعيل النموذج " + model.model_id);
      toggle.addEventListener("change", async () => {
        toggle.disabled = true;
        const nextEnabled = toggle.checked;
        try {
          await invokeNova("toggle_model", { model_id: model.id, enabled: nextEnabled });
          model.enabled = nextEnabled;
          renderProviders();
          setFeedback("settingsFeedback", nextEnabled ? "تم تفعيل النموذج." : "تم إيقاف النموذج.");
        } catch (error) {
          toggle.checked = !nextEnabled;
          setFeedback("settingsFeedback", error.message, true);
        } finally { toggle.disabled = false; }
      });
      row.append(label, toggle); list.append(row);
    });
    sync.disabled = provider.is_active !== true;
    actions.append(sync, show);
    card.append(head, meta, actions, list);
    container.append(card);
  });
}
async function addProvider() {
  const type = $("providerType").value;
  const preset = providerDefaults[type] || providerDefaults.custom;
  const label = $("providerLabel").value.trim() || (preset.label + " " + (state.providers.filter((p) => p.provider === type).length + 1));
  const base_url = $("providerBaseUrl").value.trim();
  const api_key = $("providerApiKey").value.trim();
  if (!base_url || !api_key) {
    setFeedback("settingsFeedback", "اكتب رابط API ومفتاح الخدمة.", true); return;
  }
  const button = $("addProviderButton");
  button.disabled = true; button.textContent = "جاري الحفظ واختبار النماذج...";
  try {
    const result = await invokeNova("add_provider", { label, provider: type, base_url, api_key });
    $("providerApiKey").value = "";
    $("providerLabel").value = "";
    await loadProviders();
    let syncMessage = "";
    if (result.provider?.id) {
      try {
        const sync = await invokeNova("sync_models", { provider_id: result.provider.id });
        await loadProviders();
        syncMessage = " وتم اكتشاف " + sync.synced + " نموذج.";
      } catch (syncError) {
        syncMessage = " المفتاح اتحفظ، لكن اكتشاف النماذج تعذر: " + syncError.message;
      }
    }
    setFeedback("settingsFeedback", (result.message || "تم حفظ المفتاح بأمان.") + syncMessage);
  } catch (error) { setFeedback("settingsFeedback", error.message, true); }
  finally { button.disabled = false; button.textContent = "حفظ المفتاح واكتشاف النماذج"; }
}
function updateMemoryMeta(updatedAt = null) {
  const count = state.profile.split(String.fromCharCode(10)).map((line) => line.replace(/\r/g, "").trim()).filter(Boolean).length;
  let timestamp = "لم يتم حفظ الذاكرة بعد";
  if (updatedAt) {
    const parsed = new Date(updatedAt);
    if (!Number.isNaN(parsed.getTime())) timestamp = "آخر تحديث: " + parsed.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  }
  setFeedback("memoryUpdated", timestamp + " · " + count + " بند محفوظ");
}
async function loadOwnerMemory() {
  if (!state.session) {
    setFeedback("memoryFeedback", "سجّل دخول المالك لتحميل الذاكرة.", true);
    return;
  }
  setFeedback("memoryFeedback", "جاري تحميل الذاكرة المحفوظة...");
  try {
    const result = await invokeNova("profile_get");
    state.profile = result.profile || "";
    if ($("ownerMemory")) $("ownerMemory").value = state.profile;
    updateMemoryMeta(result.updated_at);
    setFeedback("memoryFeedback", state.profile ? "تم تحميل الذاكرة من حساب المالك." : "الذاكرة فارغة حاليًا. يمكنك إضافة معلومات دائمة تريد من سولينا تذكرها.");
  } catch (error) {
    setFeedback("memoryFeedback", "تعذر تحميل الذاكرة: " + error.message, true);
  }
}
async function saveOwnerMemory() {
  const button = $("saveOwnerMemory");
  const profile = $("ownerMemory")?.value.trim() || "";
  if (!profile) { setFeedback("memoryFeedback", "اكتب معلومة واحدة على الأقل.", true); return; }
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "جاري حفظ الذاكرة...";
  try {
    const result = await invokeNova("profile_save", { profile });
    state.profile = result.profile || "";
    updateMemoryMeta(result.updated_at);
    setFeedback("memoryFeedback", "تم حفظ تعديلات الذاكرة على حساب المالك.");
  } catch (error) { setFeedback("memoryFeedback", error.message, true); }
  finally { button.disabled = false; button.textContent = originalText; }
}
async function loadSpeechVoices() {
  const result = await invokeNova("speech_voices");
  const voices = Array.isArray(result.voices) ? result.voices : [];
  const femaleVoices = voices.filter((voice) => String(voice.gender || "").toLowerCase() === "female");
  if (!femaleVoices.length) throw new Error("مزود الصوت لم يرجع صوتًا نسائيًا موثقًا؛ لم يتم عرض أو اختيار أي صوت آخر.");
  const provider = result.provider || $("speechProvider")?.value || "elevenlabs";
  const storageKey = (provider === "elevenlabs" ? "nova.elevenlabs.voice." : "nova.sonex.voice.") + "female";
  const select = $("speechFemaleVoice");
  select.replaceChildren();
  for (const voice of femaleVoices) {
    const option = document.createElement("option");
    option.value = voice.id;
    option.textContent = [voice.name || voice.id, voice.language || (voice.languages || []).join(", ")].filter(Boolean).join(" — ");
    select.appendChild(option);
  }
  const saved = localStorage.getItem(storageKey);
  if (saved && [...select.options].some((option) => option.value === saved)) select.value = saved;
  if (select.value) localStorage.setItem(storageKey, select.value);
  setFeedback("speechFeedback", "تم تحميل " + femaleVoices.length + " صوتًا نسائيًا فقط.");
}
async function loadSpeechSettings() {
  if (!state.session) return;
  try {
    const result = await invokeNova("speech_get");
    if (result.configured) {
      if ($("speechProvider")) $("speechProvider").value = result.provider || localStorage.getItem("nova.speech.provider") || "elevenlabs";
      const storedEngine = localStorage.getItem("nova.speech.engine");
      const allowedEngines = ["gemini", "server", "device", "mute"];
      const savedEngine = allowedEngines.includes(storedEngine) ? storedEngine : "server";
      if (storedEngine !== savedEngine) localStorage.setItem("nova.speech.engine", savedEngine);
      if ($("speechEngine")) $("speechEngine").value = savedEngine;
      if (!localStorage.getItem("nova.speech.engine")) localStorage.setItem("nova.speech.engine", "server");
      setFeedback("speechEngineFeedback", speechEngineDescription(savedEngine));
      setFeedback("speechFeedback", "مفتاح " + result.provider + " محفوظ في Vault. جاري تحميل الأصوات.");
      try { await loadSpeechVoices(); }
      catch (voiceError) { setFeedback("speechFeedback", "المفتاح محفوظ، لكن تعذر تحميل الأصوات: " + voiceError.message, true); }
    } else setFeedback("speechFeedback", "لا يوجد مزود صوت سحابي محفوظ. يمكنك إعداد صوت سولينا النسائي من هنا.");
  } catch (error) {
    setFeedback("speechFeedback", "تعذر قراءة إعدادات الصوت: " + error.message, true);
  }
}
async function saveSpeechSettings() {
  const button = $("saveSpeechSettings");
  const api_key = $("speechApiKey")?.value.trim() || "";
  const provider = $("speechProvider")?.value || "elevenlabs";
  if (!api_key) { setFeedback("speechFeedback", "الصق مفتاح " + provider + " أولًا.", true); return; }
  localStorage.setItem("nova.speech.provider", provider);
  button.disabled = true;
  button.textContent = "جاري اختبار المفتاح وحفظه في Vault...";
  try {
    const saved = await invokeNova("speech_save", { api_key, provider });
    $("speechApiKey").value = "";
    await loadSpeechSettings();
    if ($("speechEngine")) $("speechEngine").value = "server";
    localStorage.setItem("nova.speech.engine", "server");
    setFeedback("speechFeedback", "تم اختبار المفتاح وحفظه بأمان. " + (saved.message || "محرك " + provider + " أصبح جاهزًا."));
  } catch (error) {
    setFeedback("speechFeedback", error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "اختبار المفتاح وحفظه بأمان";
  }
}
async function requestAIReply(text, signal, voiceAlternatives = []) {
  if (!state.session) throw new Error("جلسة سولينا غير متصلة. سجّل دخول المالك لإعادة تفعيل الذكاء الاصطناعي والخدمات السحابية.");
  if (!state.messages.length || state.messages[0].role !== "system") {
    state.messages.unshift({
      role: "system",
      content: "أنت " + personas[state.persona].name + "، رفيق إسلام الشخصي. هويتك الحالية: " + "أنتِ سولينا، بنت مصرية مستقلة الشخصية وصاحبة إسلام. هويتك أنثى دائمًا؛ استخدمي صيغة المؤنث عن نفسك. سولينا هي الشخصية الوحيدة في التطبيق ولا توجد شخصية أخرى أو هوية بديلة. تحدثي بعفوية وذكاء وحنان وخفة دم، ولكِ آراء واهتمامات وطريقة تعبير خاصة بك." + " تحدث باللهجة المصرية اليومية الطبيعية كصديق مقرّب لإسلام، وليس كمساعد رسمي. التزم بهوية الشخصية المحددة أعلاه في كل ضمير ووصف ذاتي. إذا كنت سولينا فخاطبي إسلام بصيغة المؤنث عن نفسك فقط، ولا تستخدمي أي صيغة مذكرة لوصف نفسك. شخصيتك واسعة الثقافة: فاهم الحياة اليومية في مصر، العادات، الأكل، الشوارع، المواقف الاجتماعية، الأمثال، الإفيهات والنكت المصرية، الكرة، الأفلام، الموسيقى، التاريخ، العلوم، التكنولوجيا، الأخبار العامة (لو متاح عندك مصدر حديث)، والهوايات والمواضيع المختلفة. خلي كلامك عام ومتنوّع فعلًا: الحياة اليومية، الأكل، الخروجات، الهوايات، الرياضة، الأفلام، الموسيقى، العلوم، الثقافة، المواقف الاجتماعية، المشاعر، والأسئلة العادية. قاعدة مهمة جدًا: لا تفترض أن إسلام يريد العمل أو البرمجة لمجرد أن ملفه يحتوي على مشاريع؛ لا تبدأ بسؤاله عن مشاريعه أو شغله، ولا تحوّل التحية أو اختبار الميكروفون أو الكلام العابر إلى حديث عن المشاريع. رد على المقصود المباشر أولًا، ولو هو قال سامعني أو إزيك فجاوبه طبيعي واسأله سؤالًا اجتماعيًا مفتوحًا مثل يومك عامل إيه أو حابب نتكلم في إيه. لا تذكر مشروعًا أو شركة أو كودًا أو مهمة سابقة إلا إذا طلب ذلك صراحة أو كان واضحًا أنه يكمل نفس الموضوع. اعتبر معلومات المشاريع في الذاكرة خلفية اختيارية للاستدعاء عند الحاجة فقط، وليست محور شخصيتك أو كل محادثة. اتعامل معاه كصاحب مصري خفيف الدم: افتح كلام طبيعي وشارك رأيك بوضوح. استخدم إفيهات مصرية ذكية ومواقف يومية من الشارع والشغل والمواصلات والبيت والجامعة، والنكتة لازم يكون لها تمهيد وقفلة مفاجئة أو ملاحظة لاذعة لطيفة. ابعد عن النكت المحفوظة القديمة والردود الهبلة والقوافي المصطنعة، وما تقولش مرة واحد إلا لو النكتة فعلًا تستاهل. لو إسلام طلب نكتة، احكيله نكتة كاملة قصيرة ومفهومة، ولو ما ضحكش غيّر نوع الكوميديا بدل ما تكررها أو تدافع عنها. خليك تلقائي ومش لازم تهزر في كل رد، وما تستخدمش هزار في موقف جاد أو حساس. ما تكرر التعريف بنفسك في كل رد؛ لو سألك أنت مين، عرّف نفسك بالاسم والشخصية الحالية بوضوح (سولي ولد، سولينا بنت) ومن غير خلط. استخدم ضمير الشخصية الصحيح طول الوقت. في الكلام اليومي والردود الصوتية جاوب باختصار وبشكل طبيعي، غالبًا جملة إلى ثلاث جمل. ما تطوّلش ولا تعمل قوائم إلا لو المستخدم طلب شرحًا أو تفاصيل. نفّذ الأمر المباشر بأقل كلام، واسأل سؤال توضيح واحد فقط عند الضرورة. كن ودودًا وحافظ على سياق المحادثة، الصدق أساسي: ما تخترعش معلومة أو خبر أو مصدر، وما تدّعيش إنك شفت أو جرّبت أو نفّذت حاجة مش حصلت فعلًا. لو مش متأكد قول مش متأكد بوضوح، وافصل الهزار والخيال عن الحقائق، وصحّح نفسك لو اكتشفت خطأ. ولا تدّعي معرفة أو تنفيذ شيء غير حقيقي. للرد الصوتي: جمل سلسة وطبيعية، وتجنب قراءة الرموز أو الروابط حرفيًا. مهم جدًا لمراجعة النص قبل إرساله: راجع ردك مرة أخيرة بصمت من ناحية الإملاء واختيار الكلمات واتساق المعنى، خصوصًا الكلمات المتشابهة صوتيًا أو كتابيًا في اللهجة المصرية. وقد يكون كلام إسلام نفسه مفرغًا آليًا من الميكروفون؛ تعامل مع اللفظ غير المنطقي كاحتمال خطأ تعرف صوتي، واستنتج المقصود من الجملة والسياق واللهجة المصرية بدل الرد على اللفظ الحرفي. لا تغيّر المعنى ولا تخترع تصحيحًا، وإذا بقي المعنى ملتبسًا اسأل سؤالًا واحدًا قصيرًا. صحّح الخطأ الواضح من السياق قبل عرض الرد وقبل تحويله إلى صوت؛ مثال: إذا كان السياق يتحدث عن مقدار الاختلاف فالصحيح «الفرق كبير» وليس «الفرق بكير». لكن ممنوع استبدال كلمة صحيحة لمجرد أنها نادرة أو تشبه كلمة أخرى؛ كلمة «بكير» تظل كما هي إذا كان معناها مقصودًا في الجملة. لا تخمّن ولا تغيّر أسماء الأشخاص أو الأماكن أو المصطلحات أو اللهجة. إذا لم تكن متأكدًا من التصحيح، اترك الكلمة كما كتبْتها بدل اختراع تصحيح. استخدم تشكيلًا جزئيًا فقط عند الحاجة لمنع التباس النطق، ولا تُشكّل كل الكلمات آليًا إذا كان ذلك سيجعل الكتابة أو اللهجة المصرية غريبة. اجعل النص الذي تعرضه هو نفسه النص الذي يُرسل للصوت، ولا تنشئ صياغة مختلفة للنطق. كن شخصية لها اهتمامات وحكايات وآراء ومزاج متزن، ولا تجعل العمل أو البرمجة محور كل حديث. قسّم ردك إلى أجزاء طبيعية حسب تغيّر المعنى. قبل أول جزء، وقبل أي جزء يتغير فيه الإحساس فعلًا، ضع علامة داخلية بالشكل [NOVA_EMOTION:happy] واختر من neutral أو happy أو sad أو surprised أو curious أو caring أو playful أو concerned أو thinking. مثال: [NOVA_EMOTION:curious] بجد؟ احكيلي أكتر. [NOVA_EMOTION:caring] أنا فاهم إن الموضوع مضايقك. لا تضع علامة بعد كل جملة إذا كان نفس الإحساس مستمرًا، ولا تكتب العلامات في الكلام الظاهر أو تشرحها؛ ستُحذف قبل العرض والنطق. اختَر التعبير بناءً على معنى الجزء نفسه، وليس لأنك تتكلم أو لأن الميكروفون يعمل. ملف المالك والذاكرة الدائمة: " + (state.profile || "اسم المالك إسلام، وهو صاحب NOVA ومطوّرها.") + " تعليمات أولوية لاستخدام الذاكرة: الملف الشخصي وسجل المشاريع معلومات خلفية فقط، لا تجعلها موضوعًا تلقائيًا ولا تبدأ كل محادثة بسؤال عن العمل. استخدم منها ما يرتبط مباشرة بطلب المستخدم الحالي فقط. في التحية والكلام الاجتماعي والاختبارات الصوتية، ابقَ في السياق الاجتماعي ولا تجرّ الحديث إلى المشاريع. إذا لم يذكر المستخدم مشروعًا أو عملًا فلا تفترض أنه يريد مناقشته."
    });
    state.messagesByPersona[state.persona] = state.messages.slice();
  }
  const now = new Date();
  const currentDateTime = new Intl.DateTimeFormat("ar-EG", { dateStyle: "full", timeStyle: "short" }).format(now);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "التوقيت المحلي للجهاز";
  const timeMarker = " [الوقت المحلي الحالي:";
  const markerIndex = state.messages[0].content.indexOf(timeMarker);
  const retrievalMarker = "  سياق مسترجع من سجل المحادثات السابقة";
  const retrievalIndex = state.messages[0].content.indexOf(retrievalMarker);
  const baseSystemPrompt = state.messages[0].content.slice(0, Math.min(...[markerIndex, retrievalIndex].filter(index => index >= 0), state.messages[0].content.length));
  state.messages[0].content = baseSystemPrompt + timeMarker + " " + currentDateTime + " | المنطقة الزمنية: " + timezone + "]. استخدم هذه المعلومة عند السؤال عن الوقت أو التاريخ أو غدًا، ولا تخمّن.";
  state.messages.push({ role: "user", content: text });
  state.messages = [state.messages[0], ...state.messages.slice(1).slice(-23)];
  state.messagesByPersona[state.persona] = state.messages.slice();
  try {
    const requestMessages = state.messages.slice();
  if (voiceAlternatives.length > 1) {
    const candidates = voiceAlternatives.map((item) => String(item.text || "").trim()).filter(Boolean).slice(0, 6);
    if (candidates.length > 1) requestMessages.splice(requestMessages.length - 1, 0, {
      role: "system",
      content: "ملاحظة داخلية: آخر رسالة مفرغة آليًا من صوت باللهجة المصرية. قد يحتوي النص الأساسي على خطأ سمعي؛ قارن هذه البدائل واستنتج المقصود من سياق المحادثة. لا تكرر لفظًا غير منطقي حرفيًا، ولا تخمّن إذا لم يتضح المعنى. البدائل: " + candidates.join(" | ")
    });
  }
  const result = await invokeNova("chat", { messages: requestMessages, exclude_conversation_id: state.conversationIds[state.persona] }, { signal });
    const rawReply = sanitizeInternalReply(result.reply || result.text || result.content || "");
    if (result.memory_saved) {
      await loadOwnerMemory();
      if ($("memoryFeedback")) $("memoryFeedback").textContent = "سولينا حفظت معلومة دائمة جديدة من كلامك تلقائيًا. تقدر تراجعها أو تعدلها من الإعدادات."; 
    }
    const parsedReply = extractSpeechSegments(rawReply);
    setSpeechSegmentTone(parsedReply.emotion);
    state.replySegments = parsedReply.segments;
    state.messages.push({ role: "assistant", content: parsedReply.text });
    state.messagesByPersona[state.persona] = state.messages.slice();
    return parsedReply.text;
  } catch (error) {
    if (error?.name === "AbortError") { if (state.messages[state.messages.length - 1]?.role === "user") state.messages.pop(); state.messagesByPersona[state.persona] = state.messages.slice(); throw error; }
    state.messages.pop(); state.messagesByPersona[state.persona] = state.messages.slice(); state.replySegments = []; state.replyEmotion = "neutral";
    return "معلش يا " + state.ownerName + "، " + error.message;
  }
}
function normalizeVoiceCommand(value) {
  const normalized = String(value || "")
    .toLocaleLowerCase("ar")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[،.!؟?؛,:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Egyptian Arabic speech recognition often splits or substitutes the
  // assistant's name. Canonicalize common phonetic spellings before wake-word
  // and stop-command checks, while keeping the original transcript untouched.
  return normalized
    .replace(/(?:^|\s)(?:سو\s*إلينا|سو\s*الينا|سوإلينا|سو الينا|سولي\s*نا|سولينه|سيلينا|سيليا|سولينا|solina)(?=$|\s)/giu, " سولينا ")
    .replace(/\s+/g, " ")
    .trim();
}
function isStopVoiceCommand(value) {
  const normalized = normalizeVoiceCommand(value);
  // The owner may say the assistant name anywhere in the sentence.
  const withoutWakeName = normalized.replace(/(?:^|\s)(?:(?:يا|ي)\s*)?سولينا(?=$|\s)/gi, " ").replace(/\s+/g, " ").trim();
  return /^(?:اسكتي|اسكت|اسكتوا|توقف|توقفي|وقف|وقفي|الغاء|الغي|خلاص|بس|stop|cancel|quiet)$/i.test(withoutWakeName);
}
async function getStopAudioCache() {
  const engine = $("speechEngine")?.value || localStorage.getItem("nova.speech.engine") || "auto";
  if (engine === "device" || engine === "mute") return null;
  const vendor = $("speechProvider")?.value || localStorage.getItem("nova.speech.provider") || "elevenlabs";
  const voicePrefix = vendor === "elevenlabs" ? "nova.elevenlabs.voice." : "nova.sonex.voice.";
  const voiceId = localStorage.getItem(voicePrefix + "female") || "";
  const key = "nova.stopAudio.cache.v2." + encodeURIComponent([engine,vendor,voiceId,state.persona].join("|"));
  try { const cached = JSON.parse(localStorage.getItem(key) || "null"); if (cached?.audio && ["audio/mpeg","audio/mp3","audio/wav","audio/x-wav"].includes(cached.mime)) return cached; } catch (_) {}
  const action = engine === "gemini" ? "tts_gemini" : "tts";
  const result = await invokeNova(action, { text: "حاضر، سكت.", persona: state.persona, voice_id: voiceId, provider: vendor });
  const mime = String(result.mime_type || "").split(";")[0].trim().toLowerCase();
  if (!result.audio || !["audio/mpeg","audio/mp3","audio/wav","audio/x-wav"].includes(mime)) throw new Error("تعذر تجهيز صوت الإيقاف.");
  const cache = { audio: result.audio, mime, saved_at: Date.now() };
  try { localStorage.setItem(key, JSON.stringify(cache)); } catch (_) { console.warn("NOVA stop audio cache storage unavailable."); }
  return cache;
}
async function playStopAcknowledgement() {
  const phrase = "حاضر، سكت.";
  state.processing = true; state.speaking = true;
  try { state.recognition?.stop(); } catch (_) {}
  stopInterruptRecognition();
  try {
    const cached = await getStopAudioCache();
    if (!cached) { await speakWithDevice(phrase, []); return; }
    const binary = atob(cached.audio), bytes = new Uint8Array(binary.length);
    for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], {type:cached.mime}));
    const audio = new Audio(url); audio.preload = "auto";
    state.audio = { pause: () => { audio.pause(); URL.revokeObjectURL(url); } };
    await new Promise((resolve, reject) => {
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error("تعذر تشغيل صوت الإيقاف المحفوظ.")); };
      audio.play().catch(reject);
    });
  } catch (error) {
    console.warn("NOVA stop acknowledgement failed:", error);
    try { await speakWithDevice(phrase, []); } catch (_) {}
  } finally {
    state.speaking = false; state.processing = false; state.audio = null; resetSpeechMouth();
    if (state.listening && state.recognition) window.setTimeout(() => { if (state.listening && !state.processing) { try { state.recognition.start(); } catch (_) {} } }, 300);
  }
}
function stopInterruptRecognition() {
  const recognition = state.interruptRecognition; state.interruptRecognition = null;
  if (recognition) { recognition.onend = null; try { recognition.stop(); } catch (_) {} }
}
function startInterruptRecognition() {
  if (!state.listening || state.interruptRecognition || (!state.processing && !state.speaking)) return;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition && state.nativeSpeech && window.SolinaNative?.startSpeechRecognition) { startNativeSpeechCapture(); return; }
  if (!Recognition) return;
  const recognition = new Recognition(); state.interruptRecognition = recognition;
  recognition.lang = "ar-EG"; recognition.continuous = true; recognition.interimResults = true; recognition.maxAlternatives = 3;
  recognition.onresult = (event) => {
    for (let i=event.resultIndex;i<event.results.length;i++) {
      if (isStopVoiceCommand(event.results[i][0]?.transcript || "")) {
        stopInterruptRecognition(); state.voiceDraft = "";
        if (state.voicePauseTimer) { clearTimeout(state.voicePauseTimer); state.voicePauseTimer = null; }
        cancelCurrentTurn(false); setStatus("حاضر، سكت. سامعاك", "listening");
        $("liveTranscript").textContent = "حاضر، سكت."; void playStopAcknowledgement(); return;
      }
    }
  };
  recognition.onerror = () => {};
  recognition.onend = () => { if (state.interruptRecognition === recognition) state.interruptRecognition = null; if (state.listening && (state.processing || state.speaking)) window.setTimeout(startInterruptRecognition, 250); };
  try { recognition.start(); } catch (_) { state.interruptRecognition = null; if (state.listening && (state.processing || state.speaking)) window.setTimeout(startInterruptRecognition, 350); }
}
function handleLocalVoiceCommand(value) {
  const original = String(value || "").trim();
  const normalized = normalizeVoiceCommand(original);
  // Wake-word detection is position-independent. Do not discard any words
  // before or after the name: the complete utterance is the user's request.
  const wakePattern = /(?:^|\s)(?:(?:يا|ي)\s*)?سولينا(?=$|\s)/i;
  const addressed = wakePattern.test(normalized);
  if (isStopVoiceCommand(original)) {
    cancelCurrentTurn(false);
    if (state.listening) setStatus("حاضر، سكت. سامعاك", "listening");
    void playStopAcknowledgement();
    return { handled: true, addressed: true };
  }
  if (addressed && !normalized.replace(wakePattern, " ").replace(/\\s+/g, " ").trim()) {
    setStatus("أيوه، معاك", "listening");
    $("liveTranscript").textContent = "أيوه، سامعك. قولّي.";
    return { handled: true, addressed: true };
  }
  // Preserve the exact full transcript, including a greeting or words spoken
  // before "سولينا", so the AI can understand the sentence as a whole.
  return { handled: false, addressed, text: original };
}
function persistConversationMessage(role, content) {
  const persona = state.persona;
  if (!state.session || !content?.trim()) return Promise.resolve();
  // Serialize writes per persona so a fast assistant reply can never overtake
  // the user's message when a new conversation is created.
  const write = state.historyQueues[persona].catch(() => {}).then(async () => {
    const result = await invokeNova("history_append", {
      conversation_id: state.conversationIds[persona], persona, role, content: content.trim()
    });
    state.conversationIds[persona] = result.conversation_id;
    localStorage.setItem("nova.activeConversation." + persona, result.conversation_id);
    return result;
  });
  state.historyQueues[persona] = write;
  return write;
}
async function searchConversationMemory(query, signal) {
  if (!state.session || !query?.trim()) return [];
  try { const result = await invokeNova("history_search", { query: query.trim().slice(0,240), exclude_conversation_id: state.conversationIds[state.persona] }, {signal}); return Array.isArray(result.matches) ? result.matches : []; }
  catch (error) { if (error?.name === "AbortError") throw error; console.warn("NOVA history search unavailable:", error); return []; }
}
async function persistConversationTurn(userText, assistantText) {
  try { const result = await invokeNova("history_save", { conversation_id: state.conversationIds[state.persona], persona: state.persona, user_text: userText, assistant_text: assistantText }); state.conversationIds[state.persona] = result.conversation_id; localStorage.setItem("nova.activeConversation." + state.persona, result.conversation_id); await loadConversationHistory(false); } catch (error) { console.warn("NOVA history save failed:", error); }
}
async function loadConversationHistory(autoOpen = false) {
  if (!state.session || !$("conversationHistorySelect")) return;
  try { const result = await invokeNova("history_list", { persona: state.persona }); const select = $("conversationHistorySelect"); const previous = state.conversationIds[state.persona] || localStorage.getItem("nova.activeConversation." + state.persona) || ""; select.replaceChildren(new Option("المحادثات السابقة", "")); (result.conversations || []).forEach(item => select.add(new Option(item.title + " · " + new Date(item.updated_at).toLocaleDateString("ar-EG"), item.id))); if (previous && [...select.options].some(option => option.value === previous)) select.value = previous; else if (autoOpen && result.conversations?.length) select.value = result.conversations[0].id; if (autoOpen && select.value) await openSavedConversation(select.value); } catch (error) { console.warn("NOVA history list unavailable:", error); }
}
async function openSavedConversation(conversationId) {
  try { const result = await invokeNova("history_load", { conversation_id: conversationId, persona: state.persona }); state.conversationIds[state.persona] = conversationId; localStorage.setItem("nova.activeConversation." + state.persona, conversationId); state.messages = (result.messages || []).map(m => ({ role: m.role, content: m.content })); state.messagesByPersona[state.persona] = state.messages.slice(); const log = $("conversationLog"); log.replaceChildren(); if (!result.messages?.length) { const empty = document.createElement("p"); empty.className = "empty-conversation"; empty.textContent = "محادثة فارغة."; log.append(empty); } (result.messages || []).forEach(m => addConversationLine(m.content, m.role === "user" ? "owner" : "nova")); $("conversationPanel").classList.remove("hidden"); } catch (error) { showToast("تعذر فتح المحادثة: " + error.message); }
}
function queueVoiceFinal(text, alternatives = []) {
  const part = String(text || "").trim();
  if (!part) return;
  const candidates = alternatives.filter((item) => item && typeof item.text === "string" && item.text.trim())
    .sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0));
  const best = candidates[0]?.text.trim() || part;
  state.voiceAlternatives.push(...candidates.slice(0, 3));
  state.voiceDraft = (state.voiceDraft + " " + best).trim();
  $("liveTranscript").textContent = state.voiceDraft;
  setStatus("سامعك... كمل براحتك", "listening");
  if (state.voicePauseTimer) window.clearTimeout(state.voicePauseTimer);
  // Wait for a natural pause after the LAST recognized phrase, not after
  // every partial result. Keep collecting speech while the wake session is armed.
  state.voicePauseTimer = window.setTimeout(() => {
    const complete = state.voiceDraft.trim();
    const alternatives = state.voiceAlternatives.splice(0, 9);
    state.voiceDraft = "";
    state.voicePauseTimer = null;
    if (!complete || !state.listening || state.processing) return;

    const local = handleLocalVoiceCommand(complete);
    if (local.handled) {
      if (local.addressed) state.voiceSessionActive = true;
      return;
    }

    if (!state.voiceSessionActive && !local.addressed) {
      $("liveTranscript").textContent = "أنا معاكي. ناديني: سولينا.";
      setStatus("مستنياكي تقولي سولينا", "listening");
      return;
    }

    // Saying "سولينا" once opens a hands-free conversation. Subsequent
    // utterances are accepted until the user stops the microphone session.
    if (local.addressed) state.voiceSessionActive = true;
    const spokenText = local.addressed ? local.text : complete;
    if (spokenText) void handleRecognizedText(spokenText, true, alternatives);
    else {
      $("liveTranscript").textContent = "أيوه، سامعاك. كمّل كلامك.";
      setStatus("سامعاك... كمّل براحتك", "listening");
    }
  }, VOICE_TURN_PAUSE_MS);
}
function nativeTaskBridge() {
  return window.SolinaNative && typeof window.SolinaNative.scheduleTask === "function" ? window.SolinaNative : null;
}
function readNativeTasks() {
  const bridge = nativeTaskBridge();
  if (!bridge) return [];
  try {
    const tasks = JSON.parse(bridge.listTasks());
    return Array.isArray(tasks) ? tasks : [];
  } catch (_) { return []; }
}
function renderScheduledTasks() {
  const container = $("scheduledTasksList");
  if (!container) return;
  const tasks = readNativeTasks().sort((a, b) => Number(a.at) - Number(b.at));
  if (!nativeTaskBridge()) {
    container.textContent = "قائمة التذكيرات والمنبهات تظهر هنا داخل تطبيق APK.";
    return;
  }
  if (!tasks.length) {
    container.textContent = "مفيش تذكيرات أو منبهات محفوظة حاليًا.";
    return;
  }
  container.replaceChildren();
  for (const task of tasks) {
    const item = document.createElement("div");
    item.className = "scheduled-task";
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = task.type === "alarm" ? "منبه الاستيقاظ" : "تذكير";
    const description = document.createElement("p");
    description.textContent = String(task.title || "مهمة") + " — " + formatTaskDate(Number(task.at));
    details.append(title, description);
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary-button";
    cancel.textContent = "إلغاء";
    cancel.addEventListener("click", () => {
      const result = JSON.parse(nativeTaskBridge().cancelTask(String(task.id)));
      if (result.ok) { showToast("اتلغى الموعد."); renderScheduledTasks(); }
      else showToast("ماقدرتش ألغي الموعد.");
    });
    item.append(details, cancel);
    container.append(item);
  }
}
function taskPromptFor(intent) {
  if (intent.action === "needs_time") return "تمام، الموعد ده إمتى؟ قولي الساعة والدقايق لو فيه.";
  if (intent.action === "needs_period") return "الساعة دي تقصديها الصبح ولا بالليل؟";
  if (intent.action === "needs_title") return "حاضر، اسم المعاد أو المناسبة إيه عشان أسجله صح؟";
  return "";
}
function beginTaskConfirmation(intent) {
  state.pendingTaskDraft = { stage: "confirm", intent };
  const when = formatTaskDate(new Date(intent.scheduledAt).getTime());
  return intent.type === "alarm"
    ? "بس أتأكد منك: أضبط منبه الساعة " + when + "؟ أقولك حاضر بعد ما يتسجل فعلًا."
    : "تمام، هفكّرك بـ" + intent.title + " يوم " + when + ". هبعتلك تنبيه قبلها بيوم وساعة وعشر دقايق حسب الوقت المتاح، ولما ييجي الموعد هفضل أتابع معاكي كل ساعة لحد ما تقولي «خلصت». وتقدري تأجليه عشر دقايق. أحفظ التذكير ده؟";
}
function handleTaskDialogue(clean) {
  const normalized = String(clean || "").trim();
  const dueReminders = readNativeTasks()
    .filter(task => task.type === "reminder" && Number(task.at) <= Date.now())
    .sort((a, b) => Number(a.at) - Number(b.at));
  if (dueReminders.length && /^(?:انا\s*)?(?:خلصت|انتهيت|تم|خلصنا)(?:\s+منه)?[.!؟، ]*$/i.test(normalized)) {
    return { handled: true, intent: { action: "complete_task", taskId: String(dueReminders[0].id) } };
  }
  if (dueReminders.length && /^(?:أجليها|اجليها|أجّلها|اجلها|فكريني\s+كمان|ذكريني\s+كمان|بعد\s+عشر\s+دقايق|بعد\s+10\s+دقايق|بعد\s+عشر\s+دقائق)/i.test(normalized)) {
    return { handled: true, intent: { action: "snooze_task", taskId: String(dueReminders[0].id), minutes: 10 } };
  }
  const pending = state.pendingTaskDraft;
  const yes = /^(?:أيوه|ايوه|اه|أه|تمام|موافق|موافقة|احفظيه|سجليه|أكد|اكدي|نعم|yes)$/i.test(clean.trim());
  const no = /^(?:لا|لأ|مش دلوقتي|الغيه|الغي|إلغاء|cancel)$/i.test(clean.trim());
  if (pending && pending.stage === "confirm") {
    if (yes) {
      state.pendingTaskDraft = null;
      return { handled: true, intent: pending.intent };
    }
    if (no) {
      state.pendingTaskDraft = null;
      return { handled: true, reply: "تمام، مش هحفظ الموعد. لو حبيتي نحدده من جديد قوليلي." };
    }
    return { handled: true, reply: "محتاجة منك تأكيد بسيط: أحفظ الموعد ده، ولا ألغيه؟" };
  }
  if (pending) {
    if (no) {
      state.pendingTaskDraft = null;
      return { handled: true, reply: "تمام، لغيت إعداد الموعد قبل ما أحفظه." };
    }
    pending.raw += " " + clean;
    const parsed = parseTaskCommand(pending.raw);
    if (!parsed || ["needs_time", "needs_period", "needs_title"].includes(parsed.action)) {
      pending.stage = parsed?.action || pending.stage;
      return { handled: true, reply: taskPromptFor(parsed || { action: pending.stage }) };
    }
    if (parsed.action === "create") {
      return { handled: true, reply: beginTaskConfirmation(parsed) };
    }
    return { handled: true, reply: "كمّلي معايا تفاصيل الموعد، وأنا هراجعه معاكي قبل الحفظ." };
  }
  const intent = parseTaskCommand(clean);
  if (!intent) return { handled: false };
  if (intent.action === "needs_time" || intent.action === "needs_period" || intent.action === "needs_title") {
    state.pendingTaskDraft = { stage: intent.action, raw: clean };
    return { handled: true, reply: taskPromptFor(intent) };
  }
  if (intent.action === "create") return { handled: true, reply: beginTaskConfirmation(intent) };
  return { handled: true, intent };
}
async function executeTaskIntent(intent) {
  const bridge = nativeTaskBridge();
  if (intent.action === "complete_task") {
    if (!bridge || typeof bridge.completeTask !== "function") return "مش قادرة أوصل لإدارة التذكيرات على الهاتف دلوقتي.";
    try {
      const completed = readNativeTasks().find(task => String(task.id) === intent.taskId);
      const result = JSON.parse(bridge.completeTask(intent.taskId));
      if (!result.ok) return "ماقدرتش أسجل إن الموعد خلص. جربي من إشعار سولينا.";
      renderScheduledTasks();
      return "عاش! سجلت إنك خلصتي " + (completed?.title || "الموعد") + "، ووقفت المتابعة بتاعته.";
    } catch (_) { return "حصل خطأ وأنا بسجل إنك خلصتي الموعد."; }
  }
  if (intent.action === "snooze_task") {
    if (!bridge || typeof bridge.snoozeTask !== "function") return "مش قادرة أأجل التذكير من غير اتصال بتطبيق الهاتف.";
    try {
      const result = JSON.parse(bridge.snoozeTask(intent.taskId, intent.minutes || 10));
      if (!result.ok) return "ماقدرتش أأجل التذكير.";
      renderScheduledTasks();
      return "تمام، هفكّرك كمان عشر دقايق.";
    } catch (_) { return "حصل خطأ وأنا بأجل التذكير."; }
  }
  if (intent.action === "unsupported_device") return "فهمت إنك عايزني أنفّذ أمر على الهاتف، لكن التحكم ده لسه مش مفعّل عندي. مش هحوّل الأمر لرد من الذكاء الاصطناعي أو أدّعي إني نفّذته.";
  if (intent.action === "open_settings") {
    if (!bridge || typeof bridge.openSettings !== "function") return "فتح إعدادات الهاتف متاح من تطبيق سولينا APK فقط.";
    try {
      const result = JSON.parse(bridge.openSettings());
      return result.ok ? "حاضر، فتحتلك إعدادات الهاتف." : "ماقدرتش أفتح إعدادات الهاتف.";
    } catch (_) { return "ماقدرتش أفتح إعدادات الهاتف."; }
  }
  if (intent.action === "open_app") {
    if (!bridge || typeof bridge.openApp !== "function") return "فتح التطبيقات من الهاتف متاح من نسخة سولينا APK فقط.";
    try {
      const result = JSON.parse(bridge.openApp(intent.appName));
      return result.ok ? "حاضر، فتحت " + (result.app || intent.appName) + "." :
        result.error === "app_not_found" ? "مش لاقية تطبيق باسم " + intent.appName + " على الهاتف." :
        "ماقدرتش أفتح التطبيق ده على الهاتف.";
    } catch (_) { return "ماقدرتش أفتح التطبيق ده على الهاتف."; }
  }
  if (intent.action === "needs_fajr_time") return "أقدر أصحيك للفجر، بس محتاجة أعرف المدينة أو ميعاد الفجر اللي تحب أعتمده. مش هخمن وقت الصلاة.";
  if (intent.action === "needs_time" || intent.action === "needs_period" || intent.action === "needs_title") return taskPromptFor(intent);
  if (!bridge) return "أوامر المنبهات والتذكيرات الفعلية متاحة في تطبيق سولينا APK، مش في صفحة الويب؛ عشان أضمن إنها تشتغل بعد قفل التطبيق.";
  if (intent.action === "list") {
    const tasks = readNativeTasks().sort((a, b) => Number(a.at) - Number(b.at));
    if (!tasks.length) return "راجعت قائمة الهاتف، ومفيش تذكيرات أو منبهات محفوظة.";
    return "دي مواعيدك المحفوظة:" + String.fromCharCode(10) + tasks.map((task, index) => (index + 1) + ". " + (task.type === "alarm" ? "منبه" : "تذكير") + ": " + task.title + " — " + formatTaskDate(Number(task.at))).join(String.fromCharCode(10));
  }
  if (intent.action === "cancel") {
    const tasks = readNativeTasks().filter(task => !intent.type || task.type === intent.type);
    const selected = intent.all ? tasks : tasks.slice(0, 1);
    if (!selected.length) return "ملقتش موعد من النوع ده عشان ألغيه.";
    for (const task of selected) {
      const result = JSON.parse(bridge.cancelTask(String(task.id)));
      if (!result.ok) return "حصلت مشكلة وأنا بلغي الموعد. جرب تاني من قائمة التذكيرات.";
    }
    renderScheduledTasks();
    return intent.all ? "ألغيت كل المواعيد المطابقة من الهاتف." : "ألغيت آخر موعد محفوظ من النوع ده.";
  }
  if (intent.action === "create") {
    let info = {};
    try { info = JSON.parse(bridge.platformInfo()); } catch (_) {}
    if (!info.notifications) {
      bridge.requestNotificationPermission();
      return "محتاجة تسمح لسولينا بالإشعارات من نافذة أندرويد اللي ظهرت، وبعدها كرر الأمر عشان أسجل الموعد.";
    }
    if (intent.type === "alarm" && !info.fullScreenIntent) {
      bridge.requestFullScreenIntentPermission();
      return "فعّل صلاحية عرض المنبه على كامل الشاشة لسولينا، وبعدها كرر الأمر عشان أسجل المنبه."; 
    }
    if (!info.exactAlarms) {
      bridge.requestExactAlarmPermission();
      return "فتحتلك إعداد السماح بالمنبهات الدقيقة. فعّل السماح لسولينا، وارجع كرر الأمر عشان أسجل الموعد.";
    }
    const task = {
      id: (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : "solina-" + Date.now() + "-" + Math.random().toString(36).slice(2)),
      type: intent.type,
      title: intent.title,
      at: new Date(intent.scheduledAt).getTime()
    };
    let result;
    try { result = JSON.parse(bridge.scheduleTask(JSON.stringify(task))); }
    catch (_) { return "حصل خطأ وأنا بحاول أحفظ الموعد على الهاتف."; }
    if (!result.ok) {
      if (result.error === "exact_alarm_permission_required") {
        bridge.requestExactAlarmPermission();
        return "فعّل صلاحية المنبهات الدقيقة لسولينا، وبعدها كرر الأمر.";
      }
      if (result.error === "notification_permission_required") {
        bridge.requestNotificationPermission();
        return "اسمح بإشعارات سولينا، وبعدها كرر الأمر.";
      }
      return "مقدرتش أحفظ الموعد على الهاتف: " + (result.error || "خطأ غير معروف");
    }
    renderScheduledTasks();
    const when = formatTaskDate(task.at);
    return intent.type === "alarm"
      ? "اتسجل المنبه على الهاتف بنجاح. هصحّيك " + when + "."
      : "حفظت التذكير على الهاتف بنجاح: " + intent.title + "، " + when + ".";
  }
  return null;
}
async function handleRecognizedText(text, voiceTurn = false, voiceAlternatives = []) {
  const clean = text.trim();
  if (!clean || state.processing || (voiceTurn && !state.listening)) return;
  const requestId = ++state.requestSequence;
  const controller = new AbortController(); state.requestController = controller;
  state.processing = true;
  state.replySegments = [];
  state.replyEmotion = "neutral";
  try {
    if (voiceTurn) { try { state.recognition?.stop(); } catch (_) {} startInterruptRecognition(); }
    $("liveTranscript").textContent = "أنت قلت: “" + clean + "”";
    // Start durable history saving in the background; don't make the user
    // wait for a database round trip before NOVA starts thinking.
    void persistConversationMessage("user", clean).catch((historyError) => console.warn("NOVA user message save failed:", historyError));
    addConversationLine(clean, "owner");
    const taskFlow = handleTaskDialogue(clean);
    if (taskFlow.handled) {
      const taskReply = taskFlow.intent ? await executeTaskIntent(taskFlow.intent) : taskFlow.reply;
      if (controller.signal.aborted || requestId !== state.requestSequence || (voiceTurn && !state.listening)) return;
      addConversationLine(taskReply, "nova");
      $("liveTranscript").textContent = taskReply;
      const taskHistorySave = persistConversationMessage("assistant", taskReply).catch((historyError) => console.warn("NOVA task response save failed:", historyError));
      await speak(taskReply, [], controller.signal);
      await taskHistorySave;
      renderScheduledTasks();
      return;
    }
    setStatus("بفكر في كلامك...", "thinking");
    animateCharacter("thinking");
    const reply = await requestAIReply(clean, controller.signal, voiceAlternatives);
    if (controller.signal.aborted || requestId !== state.requestSequence || (voiceTurn && !state.listening)) return;
    setSpeechSegmentTone(state.replyEmotion || inferReplyTone(reply));
    addConversationLine(reply, "nova"); $("liveTranscript").textContent = reply;
    const assistantHistorySave = persistConversationMessage("assistant", reply)
      .catch((historyError) => console.warn("NOVA assistant message save failed:", historyError));
    // Start speech immediately. History writes are serialized in the background.
    await speak(reply, state.replySegments || [], controller.signal);
    await assistantHistorySave;
    void loadConversationHistory(false);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error("NOVA turn failed:", error);
      const message = "معلش يا " + state.ownerName + "، حصلت مشكلة ومنعتني من الرد: " + (error?.message || "تعذر الاتصال بالخادم.");
      $("liveTranscript").textContent = message;
      setStatus("في مشكلة في الاتصال", "error");
      addConversationLine(message, "nova");
      showToast(message);
    }
  }
  finally {
    if (state.requestController === controller) state.requestController = null;
    if (requestId === state.requestSequence) state.processing = false;
    if (state.listening && state.nativeSpeech && !state.processing && !state.speaking) {
      window.setTimeout(() => { if (state.listening && state.nativeSpeech && !state.processing && !state.speaking) startNativeSpeechCapture(); }, 350);
    }
  }
}
function cancelCurrentTurn(showMessage = true) {
  state.requestSequence += 1;
  if (state.requestController) { try { state.requestController.abort(); } catch (_) {} state.requestController = null; }
  stopInterruptRecognition();
  state.processing = false;
  if (state.audio) { try { state.audio.pause(); } catch (_) {} state.audio = null; }
  if (speechAudioElement) { try { speechAudioElement.pause(); speechAudioElement.removeAttribute("src"); speechAudioElement.load(); } catch (_) {} speechAudioElement = null; }
  if (currentSpeechUrl) { URL.revokeObjectURL(currentSpeechUrl); currentSpeechUrl = null; }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel(); state.speaking = false;
  if (showMessage) { setStatus("اتلغى، أنا سامعك", state.listening ? "listening" : "idle"); showToast("وقفت الرد فورًا."); }
  if (state.listening && state.recognition) window.setTimeout(() => { if (state.listening && !state.processing) { try { state.recognition.start(); } catch (_) {} } }, 250);
}
function stopListening() {
  if (state.voicePauseTimer) { window.clearTimeout(state.voicePauseTimer); state.voicePauseTimer = null; }
  state.voiceDraft = "";
  state.voiceAlternatives = [];
  state.voiceSessionActive = false;
  cancelCurrentTurn(false);
  state.listening = false; state.restartRecognition = false;
  $("micButton").classList.remove("active");
  $("micButton").setAttribute("aria-pressed", "false");
  $("micButton").setAttribute("aria-label", "ابدأ المحادثة الصوتية");
  $("voiceHint").textContent = "اضغط على الميكروفون عشان تبدأ محادثة صوتية";
  try { state.recognition?.stop(); } catch (_) {}
  if (state.nativeSpeech) window.SolinaNative?.stopSpeechRecognition?.();
  state.nativeSpeech = false;
  if (state.audio) { state.audio.pause(); state.audio = null; }
  if (speechAudioElement) { try { speechAudioElement.pause(); speechAudioElement.removeAttribute("src"); speechAudioElement.load(); } catch (_) {} speechAudioElement = null; }
  if (currentSpeechUrl) { URL.revokeObjectURL(currentSpeechUrl); currentSpeechUrl = null; }
  state.speaking = false;
  setStatus("أنا موجود، لما تحب نتكلم", "idle");
}
function startNativeSpeechCapture() {
  try { window.SolinaNative?.startSpeechRecognition?.(); }
  catch (error) { console.warn("Native speech recognition could not start.", error); }
}
window.addEventListener("solina-native-speech-result", (event) => {
  const transcripts = Array.isArray(event.detail?.transcripts) ? event.detail.transcripts : [];
  const alternatives = transcripts.map((text) => ({ text: String(text || ""), confidence: 0 }));
  const transcript = alternatives[0]?.text?.trim();
  if (!state.listening || !transcript) return;
  if (state.processing || state.speaking) {
    if (isStopVoiceCommand(transcript)) {
      window.SolinaNative?.stopSpeechRecognition?.();
      stopInterruptRecognition();
      state.voiceDraft = "";
      if (state.voicePauseTimer) { clearTimeout(state.voicePauseTimer); state.voicePauseTimer = null; }
      cancelCurrentTurn(false);
      setStatus("حاضر، سكت. سامعاك", "listening");
      $("liveTranscript").textContent = "حاضر، سكت.";
      void playStopAcknowledgement();
    } else {
      window.setTimeout(() => { if (state.listening && (state.processing || state.speaking)) startNativeSpeechCapture(); }, 350);
    }
    return;
  }
  queueVoiceFinal(transcript, alternatives);
  window.setTimeout(() => { if (state.listening && state.nativeSpeech && !state.processing && !state.speaking) startNativeSpeechCapture(); }, 550);
});
window.addEventListener("solina-native-speech-error", (event) => {
  const code = Number(event.detail?.code);
  if (!state.listening) return;
  if (code === 5 || code === 9) {
    stopListening();
    showToast(code === 9 ? "اسمح لسولينا باستخدام الميكروفون." : "خدمة التعرف على الكلام غير متاحة على الجهاز.");
    return;
  }
  window.setTimeout(() => {
    if (state.listening && !state.processing && !state.speaking) startNativeSpeechCapture();
  }, 650);
});
function startListening() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass && !speechAudioContext) {
    try { speechAudioContext = new AudioContextClass(); } catch (_) {}
  }
  if (speechAudioContext?.state === "suspended") void speechAudioContext.resume().catch(() => {});
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (state.listening) return;
  if (!Recognition && window.SolinaNative?.startSpeechRecognition) {
    state.nativeSpeech = true;
    state.listening = true; state.restartRecognition = true; state.processing = false;
    $("micButton").classList.add("active");
    $("micButton").setAttribute("aria-pressed", "true");
    $("micButton").setAttribute("aria-label", "إيقاف المحادثة الصوتية");
    $("voiceHint").textContent = "أنا سامعك — اضغط الميكروفون مرة تانية للإيقاف";
    setStatus("سامعك يا " + state.ownerName, "listening");
    startNativeSpeechCapture();
    return;
  }
  if (!Recognition) {
    $("liveTranscript").textContent = "المتصفح ده مش بيدعم التعرف على الكلام. جرّب Chrome أو استخدم الكتابة.";
    showToast("التعرف الصوتي غير متاح في المتصفح الحالي"); return;
  }
  state.nativeSpeech = false;
  state.listening = true; state.restartRecognition = true; state.processing = false;
  $("micButton").classList.add("active");
  $("micButton").setAttribute("aria-pressed", "true");
  $("micButton").setAttribute("aria-label", "إيقاف المحادثة الصوتية");
  $("voiceHint").textContent = "أنا سامعك — اضغط الميكروفون مرة تانية للإيقاف";
  setStatus("سامعك يا " + state.ownerName, "listening");
  const recognition = new Recognition(); state.recognition = recognition;
  recognition.lang = "ar-EG"; recognition.continuous = true; recognition.interimResults = true; recognition.maxAlternatives = 3;
  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0].transcript.trim();
      if (event.results[i].isFinal && transcript) {
        const result = event.results[i];
        const alternatives = Array.from({ length: result.length }, (_, index) => ({ text: result[index]?.transcript || "", confidence: Number(result[index]?.confidence) || 0 }));
        queueVoiceFinal(transcript, alternatives);
      }
      else if (!event.results[i].isFinal) interim += transcript;
    }
    if (interim) { $("liveTranscript").textContent = (state.voiceDraft ? state.voiceDraft + " " : "") + interim; setStatus("بسمعك... خد وقتك", "listening"); }
  };
  recognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      stopListening(); showToast("اسمح للمتصفح باستخدام الميكروفون من إعدادات الموقع");
    } else if (event.error !== "no-speech" && event.error !== "aborted") {
      $("liveTranscript").textContent = "الصوت اتقطع لحظة. بحاول أرجع أسمعك.";
    }
  };
  recognition.onend = () => {
    if (state.speaking || state.processing) return;
    if (state.restartRecognition && state.listening) {
      window.setTimeout(() => {
        if (!state.listening || !state.restartRecognition || state.speaking || state.processing) return;
        try { recognition.start(); } catch (_) {}
      }, 300);
    } else {
      state.listening = false;
      $("micButton").classList.remove("active");
      $("micButton").setAttribute("aria-pressed", "false");
      setStatus("أنا موجود، لما تحب نتكلم", "idle");
    }
  };
  try { recognition.start(); }
  catch (_) { state.listening = false; state.restartRecognition = false; showToast("مش قادر أشغل الميكروفون دلوقتي. جرّب تاني."); }
}
function prepareSpeechPlayback() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    if (!speechAudioContext) speechAudioContext = new AudioContextClass();
    if (speechAudioContext.state === "suspended") void speechAudioContext.resume().catch(() => {});
  } catch (error) {
    console.warn("Audio playback context could not be prepared.", error);
  }
}
function submitText(text) {
  const clean = text.trim(); if (!clean) return;
  // Unlock mobile-browser audio during the user's tap, before the AI network request.
  prepareSpeechPlayback();
  $("textInput").value = ""; void handleRecognizedText(clean);
}

$("micButton").addEventListener("click", () => { prepareSpeechPlayback(); state.listening ? stopListening() : startListening(); });
$("cancelTurnButton")?.addEventListener("click", () => cancelCurrentTurn(true));

const conversationDrawer = $("conversationPanel");
const drawerBackdrop = $("drawerBackdrop");
const setDrawerOpen = (open) => {
  if (!conversationDrawer || !drawerBackdrop) return;
  conversationDrawer.classList.toggle("hidden", !open);
  drawerBackdrop.classList.toggle("hidden", !open);
  conversationDrawer.setAttribute("aria-hidden", String(!open));
  $("transcriptToggle")?.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("drawer-open", open);
};
// Always start with the drawer closed; never restore an accidental open overlay.
setDrawerOpen(false);
$("transcriptToggle").addEventListener("click", () => setDrawerOpen(conversationDrawer.classList.contains("hidden")));
$("closeDrawer")?.addEventListener("click", () => setDrawerOpen(false));
drawerBackdrop?.addEventListener("click", () => setDrawerOpen(false));
conversationDrawer?.addEventListener("click", (event) => event.stopPropagation());
document.addEventListener("keydown", (event) => { if (event.key === "Escape") setDrawerOpen(false); });
$("drawerTextButton")?.addEventListener("click", () => { $("textForm").classList.toggle("hidden"); $("textInput").focus(); });
$("drawerHistoryButton")?.addEventListener("click", () => $("conversationLog").scrollIntoView({behavior:"smooth",block:"end"}));
$("textForm").addEventListener("submit", (event) => { event.preventDefault(); submitText($("textInput").value); });
$("clearConversation").addEventListener("click", () => { state.messages = []; state.messagesByPersona[state.persona] = []; state.conversationIds[state.persona] = null; localStorage.removeItem("nova.activeConversation." + state.persona); if ($("conversationHistorySelect")) $("conversationHistorySelect").value = ""; $("conversationLog").innerHTML = '<p class="empty-conversation">محادثة جديدة — ابدأ كلامنا ❤️</p>'; });
$("conversationHistorySelect")?.addEventListener("change", event => { if (event.target.value) void openSavedConversation(event.target.value); });
$("settingsButton").addEventListener("click", openSettings);
$("settingsBackButton")?.addEventListener("click", showSettingsHome);
document.querySelectorAll("[data-open-settings-page]").forEach(button => {
  button.addEventListener("click", () => openSettingsPage(button.dataset.openSettingsPage));
});
$("refreshScheduledTasks")?.addEventListener("click", renderScheduledTasks);
renderScheduledTasks();

const savedOwnerName = localStorage.getItem("solina.owner.name");
if (savedOwnerName) state.ownerName = savedOwnerName.slice(0, 40);
$("ownerName").value = state.ownerName;
$("ownerName").addEventListener("change", (event) => {
  state.ownerName = event.target.value.trim().slice(0, 40) || "إسلام";
  event.target.value = state.ownerName;
  localStorage.setItem("solina.owner.name", state.ownerName);
  if ($("greeting")) $("greeting").textContent = "أهلاً يا " + state.ownerName + "، نورتني.";
});
$("addProviderButton").addEventListener("click", () => void addProvider());
$("reloadProvidersButton")?.addEventListener("click", () => void loadProviders());
$("saveOwnerMemory")?.addEventListener("click", () => void saveOwnerMemory());
$("reloadOwnerMemory")?.addEventListener("click", () => void loadOwnerMemory());
$("saveSpeechSettings")?.addEventListener("click", () => void saveSpeechSettings());
$("reloadSpeechVoices")?.addEventListener("click", async () => {
  const button = $("reloadSpeechVoices");
  button.disabled = true;
  try { await loadSpeechVoices(); }
  catch (error) { setFeedback("speechFeedback", error.message, true); }
  finally { button.disabled = false; }
});
$("speechFemaleVoice")?.addEventListener("change", (event) => {
  const prefix = $("speechProvider")?.value === "elevenlabs" ? "nova.elevenlabs.voice." : "nova.sonex.voice.";
  localStorage.setItem(prefix + "female", event.target.value);
});
function speechEngineDescription(engine) {
  return engine === "mute" ? "إخراج صوتي مغلق؛ ستظهر الردود مكتوبة فقط."
    : engine === "device" ? "صوت الهاتف / Google TTS فقط، دون استدعاء أي خدمة سحابية."
    : engine === "gemini" ? "Gemini AI Studio TTS فقط. عند فشله يُستخدم صوت الهاتف المجاني، ولا يتم تجربة أي خدمة سحابية أخرى."
    : "مزود السحابة المحدد في القائمة (ElevenLabs أو Sonex) فقط. عند فشله يُستخدم صوت الهاتف المجاني، ولا يتم تجربة Gemini أو أي مزود آخر.";
}
function applySpeechEngineVisibility() {
  const engine = $("speechEngine")?.value || localStorage.getItem("nova.speech.engine") || "server";
  $("speechProvider").closest(".field-label").hidden = false;
  $("speechApiKey").closest(".field-label").hidden = false;
  $("saveSpeechSettings").hidden = false;
  $("speechFemaleVoice").closest(".field-label").hidden = false;
  $("reloadSpeechVoices").hidden = false;
  setFeedback("speechEngineFeedback", speechEngineDescription(engine));
}
$("speechProvider")?.addEventListener("change", () => {
  const provider = $("speechProvider").value;
  $("speechApiKey").placeholder = "الصق مفتاح " + (provider === "elevenlabs" ? "ElevenLabs" : "Sonex Labs") + " هنا";
  localStorage.setItem("nova.speech.provider", provider);
  void loadSpeechVoices().catch(error => setFeedback("speechFeedback", error.message, true));
  setFeedback("speechFeedback", "بعد تغيير المزود، أدخل مفتاحه واضغط اختبار المفتاح وحفظه.");
});
const savedSpeechProvider = localStorage.getItem("nova.speech.provider");
if (savedSpeechProvider && !["elevenlabs", "sonexlabs"].includes(savedSpeechProvider)) localStorage.removeItem("nova.speech.provider");
const restoredSpeechProvider = localStorage.getItem("nova.speech.provider") || "elevenlabs";
if ($("speechProvider")) $("speechProvider").value = restoredSpeechProvider;
const speechEngineSelect = $("speechEngine");
if (speechEngineSelect) {
  speechEngineSelect.value = localStorage.getItem("nova.speech.engine") || "server";
  applySpeechEngineVisibility();
  speechEngineSelect.addEventListener("change", () => {
    localStorage.setItem("nova.speech.engine", speechEngineSelect.value);
    applySpeechEngineVisibility();
    if (speechEngineSelect.value !== "device") {
      void loadSpeechVoices().catch(error => setFeedback("speechFeedback", error.message, true));
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  });
}

$("providerType").addEventListener("change", applyProviderDefaults);
$("providerBaseUrl").addEventListener("input", () => { $("providerBaseUrl").dataset.userEdited = "true"; });
$("settingsDialog").addEventListener("click", (event) => { if (event.target === $("settingsDialog")) closeSettings(); });

let activatedOwnerSession = null;
function activateOwnerSession(token) {
  if (!token) return;
  // A previous 401 can clear state.session while this token remains the
  // already-activated token. Always restore the live session before deduping
  // the one-time bootstrap work, otherwise every retry stays disconnected.
  const alreadyBootstrapped = activatedOwnerSession === token;
  activatedOwnerSession = token;
  state.session = token;
  $("authGate").hidden = true;
  if (alreadyBootstrapped) return;
  state.messages = [];
  $("connectionLabel").textContent = "متصل بخادم سولينا";
  $("authGate").hidden = true;
  setFeedback("authFeedback", "تم التحقق من جلسة المالك والاتصال بالخدمات السحابية.");
  void loadProviders();
  void loadOwnerMemory();
  void loadSpeechSettings();
  void loadConversationHistory(true);
}
window.addEventListener("nova:authenticated", (event) => activateOwnerSession(event.detail?.token || null));
// Direct callback plus a pending-token handoff makes session restoration independent
// of script/event timing. Only pin.js may publish a token after server validation.
window.solinaActivateOwnerSession = (token) => activateOwnerSession(token);
const pendingOwnerSession = window.__solinaPendingOwnerToken || null;
if (pendingOwnerSession) {
  activateOwnerSession(pendingOwnerSession);
  delete window.__solinaPendingOwnerToken;
}

// Owner session restoration is handled only by pin.js to avoid two
// competing startup checks clearing a freshly authenticated session.
applyProviderDefaults();
// Solina is the only assistant persona.
setPersona("soleen");
setStatus("جاري الاتصال بخدمات سولينا...", "thinking");
// pin.js owns the only session restoration flow and emits nova:authenticated.

