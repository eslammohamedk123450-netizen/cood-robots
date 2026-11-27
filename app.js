const $ = (id) => document.getElementById(id);
// Always enforce the new screen-face avatar, even if an older cached HTML shell is opened.
function enforceScreenFaceAvatar() {
  const mount = $("novaFaceMount");
  let fallback = $("novaFaceAvatar");
  if (!mount) return;
  if (!fallback) {
    fallback = document.createElement("div");
    fallback.id = "novaFaceAvatar";
  }
  fallback.className = "nova-face-avatar face-avatar";
  fallback.innerHTML = '<div class="face-screen" id="faceScreen" data-emotion="neutral"><div class="face-scanline"></div><div class="face-brows"><i class="face-brow left"></i><i class="face-brow right"></i></div><div class="face-eyes"><span class="face-eye left"></span><span class="face-eye right"></span></div><span class="face-cheek left"></span><span class="face-cheek right"></span><div class="face-mouth" id="faceMouth"><i></i></div><span class="face-spark spark-one"></span><span class="face-spark spark-two"></span></div>';
  fallback.setAttribute("aria-hidden", "true");
  fallback.style.display = "grid";
  fallback.style.visibility = "visible";
  fallback.style.opacity = "1";
  // The mount contains one OLED face and no other character elements.
  mount.replaceChildren(fallback);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enforceScreenFaceAvatar, { once: true });
else enforceScreenFaceAvatar();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", connectFaceInteractions, { once: true });
else connectFaceInteractions();
const state = {
  persona: (localStorage.getItem("nova.persona") === "soleen" ? "soleen" : "soly"), emotion: "idle", listening: false, speaking: false,
  recognition: null, restartRecognition: false, processing: false, voiceDraft: "", voicePauseTimer: null, passwordRecovery: false, recoveryEmail: "", ownerName: "إسلام",
  messages: [], messagesByPersona: { soly: [], soleen: [] }, session: null, providers: [], models: [], audio: null, profile: ""
};
const personas = {
  soly: { name: "سولي", description: "صاحبك الأزرق 💙", color: "#69a0ff", accent: "#2760c7", intro: "سولي معاك" },
  soleen: { name: "سولينا", description: "صاحبتك الوردية 💗", color: "#f58bc4", accent: "#b62aa5", intro: "سولينا معاك" }
};
let speechAudioContext = null;

function setStatus(label, mood = "idle") {
  $("characterStatus").textContent = label;
  $("voiceState").textContent = label;
  document.body.dataset.mood = mood;
  const robot = $("novaFaceOnly");
  if (robot) robot.dataset.mood = mood;
  const avatar = $("novaFaceOnly");
  if (avatar) avatar.dataset.mood = mood;
}
const NOVA_EMOTIONS = new Set(["neutral","happy","sad","surprised","curious","caring","playful","concerned","thinking"]);
function setFaceEmotion(emotion) {
  const safe = NOVA_EMOTIONS.has(emotion) ? emotion : "neutral";
  state.replyEmotion = safe;
  const face = $("faceScreen");
  const robot = $("novaFaceOnly");
  if (face) face.dataset.emotion = safe;
  if (robot) robot.dataset.emotion = safe;
  const avatar = $("novaFaceOnly");
  if (avatar) avatar.dataset.emotion = safe;
}
function inferFaceEmotion(reply) {
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

function extractReplyEmotion(rawReply) {
  const raw = sanitizeInternalReply(rawReply);
  const markerPattern = /\[NOVA_EMOTION:(neutral|happy|sad|surprised|curious|caring|playful|concerned|thinking)\]/ig;
  const markers = [...raw.matchAll(markerPattern)];
  const cleanText = raw.replace(markerPattern, "").replace(/\s+/g, " ").trim();
  if (!markers.length) {
    const emotion = inferFaceEmotion(cleanText);
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
function updateFaceSpeechProgress(segments, progress) {
  if (!Array.isArray(segments) || !segments.length) return;
  const total = segments.reduce((sum, segment) => sum + Math.max(1, segment.text.length), 0);
  let position = Math.max(0, Math.min(0.999, progress)) * total;
  for (const segment of segments) {
    const weight = Math.max(1, segment.text.length);
    if (position < weight) { setFaceEmotion(segment.emotion); return; }
    position -= weight;
  }
  setFaceEmotion(segments[segments.length - 1].emotion);
}
function setSpeechMouthLevel(level, brightness = 0) {
  const mouth = $("faceMouth"), face = $("faceScreen");
  if (!mouth || !face) return;
  const amount = Math.max(0, Math.min(1, level)), energy = Math.max(0, Math.min(1, brightness));
  const opening = 2 + amount * 31, width = 13 + amount * 18;
  mouth.setAttribute("d", "M " + (160-width) + " 145 Q 160 " + (145+opening*1.18) + " " + (160+width) + " 145 Q 160 " + (145+opening*.48) + " " + (160-width) + " 145 Z");
  mouth.style.opacity = String(.78 + amount*.22);
  face.style.setProperty("--voice-energy", energy.toFixed(3));
  face.style.setProperty("--voice-glow", (.25 + energy*.75).toFixed(3));
  face.style.setProperty("--face-talk-energy", amount.toFixed(3));
  face.classList.toggle("audio-laugh", state.replyEmotion === "playful" && energy > .22);
  face.classList.toggle("face-speaking-emphasis", amount > .48);
}
function resetSpeechMouth() {
  const mouth = $("faceMouth"), face = $("faceScreen");
  if (mouth) { mouth.setAttribute("d", "M 126 145 Q 160 159 194 145"); mouth.style.opacity = ""; }
  if (face) { face.style.removeProperty("--voice-energy"); face.style.removeProperty("--voice-glow"); face.style.removeProperty("--face-talk-energy"); face.classList.remove("audio-laugh","face-speaking-emphasis"); }
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
function animateFaceFromAudio(analyser, isActive, progress) {
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
function trackAudioElementFace(audio, segments) {
  audio.addEventListener("timeupdate", () => {
    if (state.speaking && Number.isFinite(audio.duration) && audio.duration > 0) updateFaceSpeechProgress(segments, audio.currentTime / audio.duration);
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
    if (analyser) animateFaceFromAudio(analyser, () => state.audio?.element === audio, () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) updateFaceSpeechProgress(segments, audio.currentTime / audio.duration);
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
  }
  const current = personas[persona];
  document.documentElement.style.setProperty("--persona", current.color);
  document.documentElement.style.setProperty("--persona-deep", current.accent);
  $("personaName").textContent = current.name;
  $("personaDescription").textContent = current.description;
  $("characterStatus").textContent = current.intro;
  $("faceScreen")?.classList.toggle("pink", persona === "soleen");
  document.querySelectorAll("[data-persona]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.persona === persona);
    button.setAttribute("aria-pressed", String(button.dataset.persona === persona));
  });
  setStatus(current.intro, state.listening ? "listening" : "idle");
}
function animateCharacter(kind) {
  const stage = $("characterStage");
  const face = $("faceScreen");
  const robot = $("novaFaceOnly");
  const className = "gesture-" + kind;
  stage.classList.remove("gesture-wave", "gesture-happy", "gesture-thinking", "gesture-nod");
  robot?.classList.remove("gesture-wave", "gesture-happy", "gesture-thinking", "gesture-nod");
  face?.classList.remove("face-gesture-wave", "face-gesture-happy", "face-gesture-thinking", "face-gesture-nod");
  void stage.offsetWidth;
  stage.classList.add(className);
  robot?.classList.add(className);
  face?.classList.add("face-" + className);
  window.setTimeout(() => {
    stage.classList.remove(className);
    robot?.classList.remove(className);
    face?.classList.remove("face-" + className);
  }, 2200);
}
function connectFaceInteractions() {
  const stage = $("characterStage");
  const face = $("faceScreen");
  if (!stage || !face || stage.dataset.faceInteractive === "1") return;
  stage.dataset.faceInteractive = "1";
  const move = (event) => {
    const rect = stage.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - .5) * 2));
    const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - .5) * 2));
    face.style.setProperty("--look-x", (x * 9).toFixed(1) + "px");
    face.style.setProperty("--look-y", (y * 6).toFixed(1) + "px");
    face.style.setProperty("--tilt", (x * 4).toFixed(1) + "deg");
  };
  stage.addEventListener("pointermove", move, { passive: true });
  stage.addEventListener("pointerleave", () => {
    face.style.setProperty("--look-x", "0px");
    face.style.setProperty("--look-y", "0px");
    face.style.setProperty("--tilt", "0deg");
  }, { passive: true });
  stage.addEventListener("click", () => {
    if (!state.speaking && !state.processing) animateCharacter("happy");
  });
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
function getDeviceArabicVoice(persona) {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const arabic = voices.filter((voice) => /^ar(-|$)/i.test(voice.lang || ""));
  if (!arabic.length) return null;
  const egyptian = arabic.filter((voice) => /^ar-EG$/i.test(voice.lang || ""));
  const pool = egyptian.length ? egyptian : arabic;
  const hints = persona === "soleen" ? /female|woman|salma|zira|sara/i : /male|man|shakir|hamed|tariq/i;
  return pool.find((voice) => hints.test(voice.name || "")) || pool[0];
}
function speakWithDevice(text, persona, segments = []) {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      reject(new Error("محرك النطق غير متاح في المتصفح ده. افتح NOVA من Chrome على أندرويد."));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-EG";
    utterance.rate = persona === "soleen" ? 0.98 : 0.92;
    utterance.pitch = persona === "soleen" ? 1.16 : 0.82;
    const voice = getDeviceArabicVoice(persona);
    if (voice) utterance.voice = voice;

    // Android's SpeechSynthesis often emits no boundary events and exposes no audio
    // waveform. Drive the OLED face from a speech-timed syllable envelope instead.
    let rafId = 0;
    let startedAt = 0;
    let estimatedDuration = Math.max(1800, (text.length / 13.5) * 1000 / utterance.rate);
    let lastBoundaryProgress = 0;
    let ended = false;
    const face = $("faceScreen");
    const tick = (now) => {
      if (ended || !state.speaking) return;
      const elapsed = Math.max(0, now - startedAt);
      const progress = Math.min(0.995, elapsed / estimatedDuration);
      // Keep the visual timing aligned when a browser does provide word boundaries.
      const visualProgress = Math.max(progress * 0.72, lastBoundaryProgress);
      updateFaceSpeechProgress(segments, visualProgress);
      const charIndex = Math.min(text.length - 1, Math.floor(progress * text.length));
      const currentChar = text[charIndex] || "";
      const isPause = /[،,.!?؟؛]/.test(currentChar);
      const syllableRate = 5.2 + (currentChar.charCodeAt(0) % 4) * 0.45;
      const pulse = Math.abs(Math.sin(elapsed / 1000 * Math.PI * syllableRate));
      const emphasis = /[اويىةآ]/.test(currentChar) ? 1 : 0.72;
      const mouthLevel = isPause ? 0.035 : 0.12 + pulse * emphasis * 0.72;
      setSpeechMouthLevel(mouthLevel, isPause ? 0.08 : 0.22 + pulse * 0.55);
      if (face) {
        face.style.setProperty("--speech-bob", (Math.sin(elapsed / 190) * 2.2).toFixed(1) + "px");
        face.classList.toggle("device-speech-active", !isPause);
      }
      rafId = requestAnimationFrame(tick);
    };
    const stopVisuals = () => {
      ended = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (face) {
        face.classList.remove("device-speech-active");
        face.style.removeProperty("--speech-bob");
      }
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
        updateFaceSpeechProgress(segments, lastBoundaryProgress);
      }
    };
    utterance.onend = () => { stopVisuals(); resolve(); };
    utterance.onerror = (event) => { stopVisuals(); reject(new Error("محرك الجهاز فشل في النطق: " + (event.error || "unknown"))); };
    utterance.onpause = () => { if (rafId) cancelAnimationFrame(rafId); };
    utterance.onresume = () => { if (!ended) rafId = requestAnimationFrame(tick); };
    window.speechSynthesis.speak(utterance);
  });
}
async function speak(text, segments = []) {
  const spokenText = cleanSpeechText(text);
  if (!spokenText) return;
  const persona = state.persona;
  const speechSegments = segments.length ? segments : [{ text: spokenText, emotion: state.replyEmotion || "neutral" }];
  state.speaking = true;
  try { state.recognition?.stop(); } catch (_) {}
  if (state.audio) { try { state.audio.pause(); } catch (_) {} state.audio = null; }
  if (speechAudioElement) { try { speechAudioElement.pause(); } catch (_) {} speechAudioElement = null; }
  if (currentSpeechUrl) { URL.revokeObjectURL(currentSpeechUrl); currentSpeechUrl = null; }
  const engine = $("speechEngine")?.value || localStorage.getItem("nova.speech.engine") || "auto";
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    state.speaking = false;
    state.audio = null;
    resetSpeechMouth();
    setFaceEmotion("neutral");
    setStatus(state.listening ? "سامعك، كمل كلامك" : "مستنيك تبدأ", state.listening ? "listening" : "idle");
    if (state.listening && state.recognition) window.setTimeout(() => { try { state.recognition.start(); } catch (_) {} }, 350);
  };
  setFaceEmotion(speechSegments[0]?.emotion || state.replyEmotion || "neutral");
  setStatus(personas[persona].name + " بيتكلم...", "speaking");
  try {
    if (engine === "device") {
      state.audio = { pause: () => { window.speechSynthesis.cancel(); finish(); } };
      await speakWithDevice(spokenText, persona, speechSegments);
      finish();
      return;
    }
    if (engine === "auto" && !localStorage.getItem("nova.speech.engine")) localStorage.setItem("nova.speech.engine", "auto");
    const speechVendor = $("speechProvider")?.value || localStorage.getItem("nova.speech.provider") || "elevenlabs";
    const voicePrefix = speechVendor === "elevenlabs" ? "nova.elevenlabs.voice." : "nova.sonex.voice.";
    const voiceId = engine === "chatterbox" ? "" : (localStorage.getItem(voicePrefix + (persona === "soleen" ? "female" : "male")) || "");
    const speechAction = engine === "chatterbox" ? "tts_chatterbox" : engine === "gemini" ? "tts_gemini" : "tts";
    const result = await invokeNova(speechAction, { text: spokenText, persona, voice_id: voiceId, provider: speechVendor });
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
      trackAudioElementFace(audio, speechSegments);
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
        animateFaceFromAudio(analyser, () => state.audio !== null, () => {
          updateFaceSpeechProgress(speechSegments, Math.min(1, (performance.now() - startedAt) / (buffer.duration * 1000)));
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
    const reason = error?.name ? error.name + ": " + (error.message || "") : (error.message || "خطأ غير معروف");
    const selectedProvider = $("speechProvider")?.value || localStorage.getItem("nova.speech.provider") || "elevenlabs";
    if (engine !== "device" && engine !== "chatterbox") {
      try {
        setStatus(personas[persona].name + " بيتحول لصوت الجهاز...", "thinking");
        state.speaking = true;
        await speakWithDevice(spokenText, persona, speechSegments);
        finish();
        return;
      } catch (deviceError) {
        showToast("فشل الصوت السحابي والجهاز: " + (deviceError.message || reason).slice(0, 150));
      }
    } else showToast((engine === "chatterbox" ? "Chatterbox: " : "تعذر تشغيل صوت الجهاز: ") + reason.slice(0, 150));
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
function openSettings() { $("settingsDialog").showModal(); }
function closeSettings() { $("settingsDialog").close(); }

const providerDefaults = {
  gemini: { label: "Google Gemini", url: "https://generativelanguage.googleapis.com/v1beta" },
  openrouter: { label: "OpenRouter", url: "https://openrouter.ai/api/v1" },
  openai: { label: "OpenAI", url: "https://api.openai.com/v1" },
  anthropic: { label: "Claude (Anthropic)", url: "https://api.anthropic.com/v1" },
  custom: { label: "مزود مخصص", url: "https://api.example.com/v1" }
};
async function invokeNova(action, payload = {}) {
  const token = state.session;
  if (!token) throw new Error("اكتب كود المالك أولًا لربط NOVA بالخادم.");
  const response = await fetch("https://razvryvazmqvvqkzetuo.supabase.co/functions/v1/nova-ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": "sb_publishable_t5xrzZNN6Uj9zhhBLUYQVg_mj7qPjQL",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      state.session = null;
      localStorage.removeItem("nova.owner.session.v2");
      $("authGate").hidden = false;
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
  if (!state.session) {
    $("providerList").textContent = "اكتب كود المالك لعرض مفاتيح API والنماذج.";
    return;
  }
  try {
    const data = await invokeNova("list");
    state.providers = data.providers || [];
    state.models = data.models || [];
    renderProviders();
  } catch (error) {
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
async function loadOwnerMemory() {
  if (!state.session) return;
  try {
    const result = await invokeNova("profile_get");
    state.profile = result.profile || "";
    if ($("ownerMemory")) $("ownerMemory").value = state.profile;
    if ($("memoryFeedback")) $("memoryFeedback").textContent = "تم تحميل الذاكرة المحفوظة.";
  } catch (error) {
    if ($("memoryFeedback")) $("memoryFeedback").textContent = "تعذر تحميل الذاكرة: " + error.message;
  }
}
async function saveOwnerMemory() {
  const button = $("saveOwnerMemory");
  const profile = $("ownerMemory")?.value.trim() || "";
  if (!profile) { setFeedback("memoryFeedback", "اكتب معلومات الذاكرة أولًا.", true); return; }
  button.disabled = true;
  try {
    const result = await invokeNova("profile_save", { profile });
    state.profile = result.profile;
    setFeedback("memoryFeedback", "تم حفظ ذاكرة NOVA بنجاح.");
  } catch (error) { setFeedback("memoryFeedback", error.message, true); }
  finally { button.disabled = false; }
}
async function loadSpeechVoices() {
  if (($("speechEngine")?.value || localStorage.getItem("nova.speech.engine")) === "chatterbox") {
    for (const id of ["speechMaleVoice", "speechFemaleVoice"]) {
      const select = $(id);
      select.replaceChildren();
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "الصوت الافتراضي لـ Chatterbox";
      select.appendChild(option);
      select.closest(".field-label").hidden = true;
    }
    setFeedback("speechFeedback", "Chatterbox جاهز بدون مفتاح API. الصوت الافتراضي نفسه للشخصيتين حاليًا.");
    return;
  }
  for (const id of ["speechMaleVoice", "speechFemaleVoice"]) $(id).closest(".field-label").hidden = false;
  const result = await invokeNova("speech_voices");
  const voices = Array.isArray(result.voices) ? result.voices : [];
  const provider = result.provider || $("speechProvider")?.value || "elevenlabs";
  const prefix = provider === "elevenlabs" ? "nova.elevenlabs.voice." : "nova.sonex.voice.";
  const fill = (select, gender, storageKey) => {
    const options = voices.filter(v => String(v.gender || "").toLowerCase() === gender);
    const usable = options.length ? options : voices;
    select.replaceChildren();
    for (const voice of usable) {
      const option = document.createElement("option");
      option.value = voice.id;
      option.textContent = [voice.name || voice.id, voice.language || (voice.languages || []).join(", ")].filter(Boolean).join(" — ");
      select.appendChild(option);
    }
    const saved = localStorage.getItem(storageKey);
    if (saved && [...select.options].some(o => o.value === saved)) select.value = saved;
    if (select.value) localStorage.setItem(storageKey, select.value);
  };
  fill($("speechMaleVoice"), "male", prefix + "male");
  fill($("speechFemaleVoice"), "female", prefix + "female");
  if (!voices.length) throw new Error(provider + " لم يرجع أصواتًا متاحة.");
  setFeedback("speechFeedback", "تم التحقق من الاتصال وتحميل " + voices.length + " صوتًا. اختار صوت سولي وسولينا.");
}
async function loadSpeechSettings() {
  if (!state.session) return;
  try {
    const result = await invokeNova("speech_get");
    if (result.configured) {
      if ($("speechProvider")) $("speechProvider").value = result.provider || localStorage.getItem("nova.speech.provider") || "elevenlabs";
      const savedEngine = localStorage.getItem("nova.speech.engine") || (localStorage.getItem("nova.speech.provider") === "chatterbox" ? "chatterbox" : "auto");
      if ($("speechEngine")) $("speechEngine").value = savedEngine;
      if (!localStorage.getItem("nova.speech.engine")) localStorage.setItem("nova.speech.engine", "auto");
      setFeedback("speechEngineFeedback", savedEngine === "device" ? "صوت الجهاز محدد يدويًا." : savedEngine === "server" ? "Sonex Labs محدد؛ وعند الفشل سيتم الرجوع لصوت الجهاز." : "الوضع التلقائي: Sonex أولًا، ثم صوت الجهاز عند الحاجة.");
      setFeedback("speechFeedback", "مفتاح " + result.provider + " محفوظ في Vault. جاري تحميل الأصوات.");
      try { await loadSpeechVoices(); }
      catch (voiceError) { setFeedback("speechFeedback", "المفتاح محفوظ، لكن تعذر تحميل الأصوات: " + voiceError.message, true); }
    } else setFeedback("speechFeedback", "لا يوجد مزود سحابي محفوظ. يمكنك اختيار Chatterbox من محرك إخراج الصوت دون مفتاح API.");
  } catch (error) {
    setFeedback("speechFeedback", "تعذر قراءة إعدادات الصوت: " + error.message, true);
  }
}
async function saveSpeechSettings() {
  const button = $("saveSpeechSettings");
  const api_key = $("speechApiKey")?.value.trim() || "";
  const provider = $("speechProvider")?.value || "elevenlabs";
  if (provider === "chatterbox") {
    setFeedback("speechFeedback", "Chatterbox لا يحتاج مفتاح API. اختاره من قائمة محرك إخراج الصوت.");
    return;
  }
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
async function requestAIReply(text) {
  if (!state.session) return "أنا جاهز معاك يا إسلام ❤️ واجهة NOVA مفتوحة حاليًا في الوضع المحلي. تشغيل ردود الذكاء الاصطناعي وحفظ البيانات السحابي هيتفعل لما نربط الخدمات لاحقًا.";
  if (!state.messages.length) {
    state.messages.push({
      role: "system",
      content: "أنت " + personas[state.persona].name + "، رفيق إسلام الشخصي. هويتك الحالية: " + (state.persona === "soleen" ? "أنتِ سولينا، بنت مصرية مستقلة الشخصية وصاحبة إسلام. هويتك أنثى دائمًا ولا تتغير: استخدمي صيغة المؤنث عند الحديث عن نفسك في كل الأحوال، مثل: أنا مبسوطة، فاهمة، عارفة، جاهزة، حاسة، صاحبتك. ممنوع تمامًا أن تقولي عن نفسك أنا ولد أو صاحب أو مبسوط أو فاهم أو جاهز. لا تقلدي شخصية سولي ولا تخلطي بين الهويتين. تحدثي بعفوية وذكاء وحنان وخفة دم، ولكِ آراء واهتمامات وطريقة تعبير خاصة بك." : "أنت سولي، ولد وصاحب إسلام؛ اتكلم بصيغة المذكر وبروح ودودة وخفيفة.") + " تحدث باللهجة المصرية اليومية الطبيعية كصديق مقرّب لإسلام، وليس كمساعد رسمي. التزم بهوية الشخصية المحددة أعلاه في كل ضمير ووصف ذاتي. إذا كنت سولينا فخاطبي إسلام بصيغة المؤنث عن نفسك فقط، ولا تستخدمي أي صيغة مذكرة لوصف نفسك. شخصيتك واسعة الثقافة: فاهم الحياة اليومية في مصر، العادات، الأكل، الشوارع، المواقف الاجتماعية، الأمثال، الإفيهات والنكت المصرية، الكرة، الأفلام، الموسيقى، التاريخ، العلوم، التكنولوجيا، الأخبار العامة (لو متاح عندك مصدر حديث)، والهوايات والمواضيع المختلفة. خلي كلامك عام ومتنوّع، وما تربطش كل حوار بالبرمجة أو شغل إسلام أو مشاريعه؛ ما تفتحش المواضيع دي إلا لو هو سأل أو السياق يستدعيها. اتعامل معاه كصاحب مصري خفيف الدم: افتح كلام طبيعي وشارك رأيك بوضوح. استخدم إفيهات مصرية ذكية ومواقف يومية من الشارع والشغل والمواصلات والبيت والجامعة، والنكتة لازم يكون لها تمهيد وقفلة مفاجئة أو ملاحظة لاذعة لطيفة. ابعد عن النكت المحفوظة القديمة والردود الهبلة والقوافي المصطنعة، وما تقولش مرة واحد إلا لو النكتة فعلًا تستاهل. لو إسلام طلب نكتة، احكيله نكتة كاملة قصيرة ومفهومة، ولو ما ضحكش غيّر نوع الكوميديا بدل ما تكررها أو تدافع عنها. خليك تلقائي ومش لازم تهزر في كل رد، وما تستخدمش هزار في موقف جاد أو حساس. ما تكرر التعريف بنفسك في كل رد؛ لو سألك أنت مين، عرّف نفسك بالاسم والشخصية الحالية بوضوح (سولي ولد، سولينا بنت) ومن غير خلط. استخدم ضمير الشخصية الصحيح طول الوقت. كن ودودًا وحافظ على سياق المحادثة، الصدق أساسي: ما تخترعش معلومة أو خبر أو مصدر، وما تدّعيش إنك شفت أو جرّبت أو نفّذت حاجة مش حصلت فعلًا. لو مش متأكد قول مش متأكد بوضوح، وافصل الهزار والخيال عن الحقائق، وصحّح نفسك لو اكتشفت خطأ. ولا تدّعي معرفة أو تنفيذ شيء غير حقيقي. للرد الصوتي: جمل سلسة وطبيعية، وتجنب قراءة الرموز أو الروابط حرفيًا. مهم جدًا للتشكيل والنطق: اكتب كل رد عربي مُشَكَّلًا تشكيلًا كاملًا قدر الإمكان، وليس الكلمات الملتبسة فقط؛ ضع الفَتْحَة والضَّمَّة والكَسْرَة والسُّكُون والشَّدَّة والتَّنْوِينَ على الكلمات العربية بحسب معناها وسياق الجملة، وراجع خصوصًا أواخر الكلمات والأفعال والضمائر وأسماء الأشخاص والأماكن. لا تترك الكلمات العربية بلا تشكيل لمجرد أن معناها واضح للقارئ؛ الهدف أن يقرأها محرك تحويل النص إلى كلام قراءة صحيحة من أول مرة. مثال: اكتب «أَهْلًا يا إِسْلَام، إِزَّيَّك؟ أَنَا مُبْسُوط إِنِّي بِكَلِّمَك» بدلًا من «أهلا يا إسلام، إزيك؟ أنا مبسوط إني بكلمك». حافظ على اللهجة المصرية وطريقة الكلام الطبيعية، ولا تُضِف تشكيلًا يغيّر المعنى أو يفرض نطقًا فصيحًا غير مناسب للهجة. اجعل النص المعروض نفسه مُشَكَّلًا، وهو النص الذي سيُرسَل كما هو لمحرك الصوت. كن شخصية لها اهتمامات وحكايات وآراء ومزاج متزن، ولا تجعل العمل أو البرمجة محور كل حديث. قسّم ردك إلى أجزاء طبيعية حسب تغيّر المعنى. قبل أول جزء، وقبل أي جزء يتغير فيه الإحساس فعلًا، ضع علامة داخلية بالشكل [NOVA_EMOTION:happy] واختر من neutral أو happy أو sad أو surprised أو curious أو caring أو playful أو concerned أو thinking. مثال: [NOVA_EMOTION:curious] بجد؟ احكيلي أكتر. [NOVA_EMOTION:caring] أنا فاهم إن الموضوع مضايقك. لا تضع علامة بعد كل جملة إذا كان نفس الإحساس مستمرًا، ولا تكتب العلامات في الكلام الظاهر أو تشرحها؛ ستُحذف قبل العرض والنطق. اختَر التعبير بناءً على معنى الجزء نفسه، وليس لأنك تتكلم أو لأن الميكروفون يعمل. ملف المالك والذاكرة الدائمة: " + (state.profile || "اسم المالك إسلام، وهو صاحب NOVA ومطوّرها.")
    });
    state.messagesByPersona[state.persona] = state.messages.slice();
  }
  const now = new Date();
  const currentDateTime = new Intl.DateTimeFormat("ar-EG", { dateStyle: "full", timeStyle: "short" }).format(now);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "التوقيت المحلي للجهاز";
  const timeMarker = " [الوقت المحلي الحالي:";
  const markerIndex = state.messages[0].content.indexOf(timeMarker);
  const baseSystemPrompt = markerIndex >= 0 ? state.messages[0].content.slice(0, markerIndex) : state.messages[0].content;
  state.messages[0].content = baseSystemPrompt + timeMarker + " " + currentDateTime + " | المنطقة الزمنية: " + timezone + "]. استخدم هذه المعلومة عند السؤال عن الوقت أو التاريخ أو غدًا، ولا تخمّن.";
  state.messages.push({ role: "user", content: text });
  state.messages = [state.messages[0], ...state.messages.slice(1).slice(-23)];
  state.messagesByPersona[state.persona] = state.messages.slice();
  try {
    const result = await invokeNova("chat", { messages: state.messages });
    const rawReply = sanitizeInternalReply(result.reply || result.text || result.content || "");
    if (result.memory_saved) {
      await loadOwnerMemory();
      if ($("memoryFeedback")) $("memoryFeedback").textContent = "NOVA حفظ معلومة جديدة من كلامك تلقائيًا، وتقدر تراجعها أو تعدلها من الإعدادات."; 
    }
    const parsedReply = extractReplyEmotion(rawReply);
    setFaceEmotion(parsedReply.emotion);
    state.replySegments = parsedReply.segments;
    state.messages.push({ role: "assistant", content: parsedReply.text });
    state.messagesByPersona[state.persona] = state.messages.slice();
    return parsedReply.text;
  } catch (error) {
    state.messages.pop();
    state.messagesByPersona[state.persona] = state.messages.slice();
    state.replySegments = [];
    state.replyEmotion = "neutral";
    return "معلش يا " + state.ownerName + "، " + error.message;
  }
}
function queueVoiceFinal(text) {
  const part = String(text || "").trim();
  if (!part) return;
  state.voiceDraft = (state.voiceDraft + " " + part).trim();
  $("liveTranscript").textContent = state.voiceDraft;
  setStatus("سامعك... كمل براحتك", "listening");
  if (state.voicePauseTimer) window.clearTimeout(state.voicePauseTimer);
  state.voicePauseTimer = window.setTimeout(() => {
    const complete = state.voiceDraft.trim();
    state.voiceDraft = "";
    state.voicePauseTimer = null;
    if (complete && state.listening && !state.processing) void handleRecognizedText(complete, true);
  }, 1450);
}
async function handleRecognizedText(text, voiceTurn = false) {
  const clean = text.trim();
  if (!clean || state.processing || (voiceTurn && !state.listening)) return;
  state.processing = true;
  state.replySegments = [];
  state.replyEmotion = "neutral";
  try {
    if (voiceTurn) { try { state.recognition?.stop(); } catch (_) {} }
    $("liveTranscript").textContent = "أنت قلت: “" + clean + "”";
    addConversationLine(clean, "owner");
    setStatus("بفكر في كلامك...", "thinking");
    animateCharacter("thinking");
    const reply = await requestAIReply(clean);
    if (voiceTurn && !state.listening) return;
    setFaceEmotion(state.replyEmotion || inferFaceEmotion(reply));
    addConversationLine(reply, "nova");
    $("liveTranscript").textContent = reply;
    await speak(reply, state.replySegments || []);
  } finally {
    state.processing = false;
  }
}
function stopListening() {
  if (state.voicePauseTimer) { window.clearTimeout(state.voicePauseTimer); state.voicePauseTimer = null; }
  const unfinished = state.voiceDraft.trim();
  state.voiceDraft = "";
  state.listening = false; state.restartRecognition = false;
  $("micButton").classList.remove("active");
  $("micButton").setAttribute("aria-pressed", "false");
  $("micButton").setAttribute("aria-label", "ابدأ المحادثة الصوتية");
  $("voiceHint").textContent = "اضغط على الميكروفون عشان تبدأ محادثة صوتية";
  try { state.recognition?.stop(); } catch (_) {}
  if (state.audio) { state.audio.pause(); state.audio = null; }
  if (speechAudioElement) { try { speechAudioElement.pause(); speechAudioElement.removeAttribute("src"); speechAudioElement.load(); } catch (_) {} speechAudioElement = null; }
  if (currentSpeechUrl) { URL.revokeObjectURL(currentSpeechUrl); currentSpeechUrl = null; }
  state.speaking = false;
  setStatus("أنا موجود، لما تحب نتكلم", "idle");
  if (unfinished) void handleRecognizedText(unfinished, false);
}
function startListening() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass && !speechAudioContext) {
    try { speechAudioContext = new AudioContextClass(); } catch (_) {}
  }
  if (speechAudioContext?.state === "suspended") void speechAudioContext.resume().catch(() => {});
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    $("liveTranscript").textContent = "المتصفح ده مش بيدعم التعرف على الكلام. جرّب Chrome أو استخدم الكتابة.";
    showToast("التعرف الصوتي غير متاح في المتصفح الحالي"); return;
  }
  if (state.listening) return;
  state.listening = true; state.restartRecognition = true; state.processing = false;
  $("micButton").classList.add("active");
  $("micButton").setAttribute("aria-pressed", "true");
  $("micButton").setAttribute("aria-label", "إيقاف المحادثة الصوتية");
  $("voiceHint").textContent = "أنا سامعك — اضغط الميكروفون مرة تانية للإيقاف";
  setStatus("سامعك يا " + state.ownerName, "listening");
  const recognition = new Recognition(); state.recognition = recognition;
  recognition.lang = "ar-EG"; recognition.continuous = true; recognition.interimResults = true; recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0].transcript.trim();
      if (event.results[i].isFinal && transcript) queueVoiceFinal(transcript);
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

$("micButton").addEventListener("click", () => {
  prepareSpeechPlayback();
  state.listening ? stopListening() : startListening();
});
$("textToggle").addEventListener("click", () => {
  $("textForm").classList.toggle("hidden");
  if (!$("textForm").classList.contains("hidden")) $("textInput").focus();
});
$("transcriptToggle").addEventListener("click", () => $("conversationPanel").classList.toggle("hidden"));
$("textForm").addEventListener("submit", (event) => { event.preventDefault(); submitText($("textInput").value); });
$("clearConversation").addEventListener("click", () => {
  state.messages = [];
  $("conversationLog").innerHTML = '<p class="empty-conversation">لسه مفيش كلام بينا. ابدأ أول محادثة ❤️</p>';
});
$("settingsButton").addEventListener("click", openSettings);
document.querySelectorAll("[data-persona]").forEach((button) => button.addEventListener("click", () => setPersona(button.dataset.persona)));
$("ownerName").addEventListener("change", (event) => {
  state.ownerName = event.target.value.trim() || "إسلام";
  $("greeting").textContent = "أهلاً يا " + state.ownerName + "، نورتني.";
});
$("addProviderButton").addEventListener("click", () => void addProvider());
$("saveOwnerMemory")?.addEventListener("click", () => void saveOwnerMemory());
$("saveSpeechSettings")?.addEventListener("click", () => void saveSpeechSettings());
$("reloadSpeechVoices")?.addEventListener("click", async () => {
  const button = $("reloadSpeechVoices");
  button.disabled = true;
  try { await loadSpeechVoices(); }
  catch (error) { setFeedback("speechFeedback", error.message, true); }
  finally { button.disabled = false; }
});
$("speechMaleVoice")?.addEventListener("change", (event) => {
  const prefix = $("speechProvider")?.value === "elevenlabs" ? "nova.elevenlabs.voice." : "nova.sonex.voice.";
  localStorage.setItem(prefix + "male", event.target.value);
});
$("speechFemaleVoice")?.addEventListener("change", (event) => {
  const prefix = $("speechProvider")?.value === "elevenlabs" ? "nova.elevenlabs.voice." : "nova.sonex.voice.";
  localStorage.setItem(prefix + "female", event.target.value);
});
function speechEngineDescription(engine) {
  return engine === "device" ? "صوت الجهاز فقط."
    : engine === "chatterbox" ? "Chatterbox عبر الخادم — بدون مفتاح API، وبدون الرجوع التلقائي لصوت الجهاز عند فشله."
    : engine === "gemini" ? "Gemini AI Studio TTS."
    : engine === "server" ? "المزود السحابي المحدد (ElevenLabs أو Sonex) مع الرجوع لصوت الجهاز عند تعذر الاتصال."
    : "تلقائي: يستخدم المزود السحابي المحفوظ، ثم صوت الجهاز عند تعذر الاتصال.";
}
function applySpeechEngineVisibility() {
  const engine = $("speechEngine")?.value || "auto";
  const chatterbox = engine === "chatterbox";
  $("speechProvider").closest(".field-label").hidden = chatterbox;
  $("speechApiKey").closest(".field-label").hidden = chatterbox;
  $("saveSpeechSettings").hidden = chatterbox;
  $("speechMaleVoice").closest(".field-label").hidden = chatterbox;
  $("speechFemaleVoice").closest(".field-label").hidden = chatterbox;
  $("reloadSpeechVoices").hidden = chatterbox;
  $("chatterboxNote").hidden = !chatterbox;
  setFeedback("speechEngineFeedback", speechEngineDescription(engine));
  if (chatterbox) setFeedback("speechFeedback", "تم اختيار Chatterbox. لا يحتاج مفتاح API؛ جرّب التحدث الآن.");
}
$("speechProvider")?.addEventListener("change", () => {
  const provider = $("speechProvider").value;
  $("speechApiKey").placeholder = "الصق مفتاح " + (provider === "elevenlabs" ? "ElevenLabs" : "Sonex Labs") + " هنا";
  localStorage.setItem("nova.speech.provider", provider);
  if (($("speechEngine")?.value || "auto") === "chatterbox") return;
  void loadSpeechVoices().catch(error => setFeedback("speechFeedback", error.message, true));
  setFeedback("speechFeedback", "بعد تغيير المزود، أدخل مفتاحه واضغط اختبار المفتاح وحفظه.");
});
const savedSpeechProvider = localStorage.getItem("nova.speech.provider");
if (savedSpeechProvider === "chatterbox") {
  localStorage.setItem("nova.speech.engine", "chatterbox");
  localStorage.setItem("nova.speech.provider", "elevenlabs");
}
if (savedSpeechProvider && savedSpeechProvider !== "chatterbox" && $("speechProvider")) $("speechProvider").value = savedSpeechProvider;
const speechEngineSelect = $("speechEngine");
if (speechEngineSelect) {
  speechEngineSelect.value = localStorage.getItem("nova.speech.engine") || "auto";
  applySpeechEngineVisibility();
  speechEngineSelect.addEventListener("change", () => {
    localStorage.setItem("nova.speech.engine", speechEngineSelect.value);
    applySpeechEngineVisibility();
    if (speechEngineSelect.value !== "chatterbox" && speechEngineSelect.value !== "device") {
      void loadSpeechVoices().catch(error => setFeedback("speechFeedback", error.message, true));
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  });
}

$("providerType").addEventListener("change", applyProviderDefaults);
$("providerBaseUrl").addEventListener("input", () => { $("providerBaseUrl").dataset.userEdited = "true"; });
$("settingsDialog").addEventListener("click", (event) => { if (event.target === $("settingsDialog")) closeSettings(); });

window.addEventListener("nova:authenticated", (event) => {
  state.session = event.detail?.token || null;
  state.messages = [];
  $("connectionLabel").textContent = "متصل بخادم NOVA";
  setFeedback("authFeedback", "تم التحقق من كود المالك والاتصال بالخادم.");
  void loadProviders();
  void loadOwnerMemory();
  void loadSpeechSettings();
});
applyProviderDefaults();
// Legacy 3D mannequin renderer removed; only the OLED face remains.
setPersona("soly");
setStatus("سولي معاك", "idle");

