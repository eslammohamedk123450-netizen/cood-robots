const $ = (id) => document.getElementById(id);
const state = {
  persona: "soly", emotion: "idle", listening: false, speaking: false,
  recognition: null, restartRecognition: false, processing: false, passwordRecovery: false, recoveryEmail: "", ownerName: "إسلام",
  messages: [], session: null, providers: [], models: [], audio: null, profile: ""
};
const personas = {
  soly: { name: "سولي", description: "صاحبك الأزرق 💙", color: "#69a0ff", accent: "#2760c7", intro: "سولي معاك" },
  soleen: { name: "سولين", description: "صاحبتك الوردية 💗", color: "#f58bc4", accent: "#b62aa5", intro: "سولين معاكي" }
};
let character3D = null;
let speechAudioContext = null;

function setStatus(label, mood = "idle") {
  state.emotion = mood;
  $("characterStatus").textContent = label;
  $("voiceState").textContent = label;
  document.body.dataset.mood = mood;
}
function setPersona(persona) {
  if (!personas[persona]) return;
  state.persona = persona;
  const current = personas[persona];
  document.documentElement.style.setProperty("--persona", current.color);
  document.documentElement.style.setProperty("--persona-deep", current.accent);
  $("personaName").textContent = current.name;
  $("personaDescription").textContent = current.description;
  $("characterStatus").textContent = current.intro;
  $("robotHead")?.classList.toggle("pink", persona === "soleen");
  if ($("hair")) $("hair").hidden = persona !== "soleen";
  if ($("bow")) $("bow").hidden = persona !== "soleen";
  document.querySelectorAll("[data-persona]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.persona === persona);
    button.setAttribute("aria-pressed", String(button.dataset.persona === persona));
  });
  character3D?.setPersona(persona);
  setStatus(current.intro, state.listening ? "listening" : "idle");
}
function animateCharacter(kind) {
  const stage = $("characterStage");
  const className = "gesture-" + kind;
  stage.classList.remove("gesture-wave", "gesture-happy", "gesture-thinking", "gesture-nod");
  void stage.offsetWidth;
  stage.classList.add(className);
  window.setTimeout(() => stage.classList.remove(className), 1500);
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
function speakWithDevice(text, persona) {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      reject(new Error("محرك النطق غير متاح في المتصفح ده. افتح NOVA من Chrome على أندرويد."));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-EG";
    utterance.rate = 0.94;
    utterance.pitch = persona === "soleen" ? 1.08 : 0.96;
    const voice = getDeviceArabicVoice(persona);
    if (voice) utterance.voice = voice;
    utterance.onend = resolve;
    utterance.onerror = (event) => reject(new Error("محرك الجهاز فشل في النطق: " + (event.error || "unknown")));
    window.speechSynthesis.speak(utterance);
  });
}
async function speak(text) {
  const spokenText = cleanSpeechText(text);
  if (!spokenText) return;
  const persona = state.persona;
  state.speaking = true;
  try { state.recognition?.stop(); } catch (_) {}
  if (state.audio) { try { state.audio.pause(); } catch (_) {} state.audio = null; }
  if (speechAudioElement) { try { speechAudioElement.pause(); } catch (_) {} speechAudioElement = null; }
  if (currentSpeechUrl) { URL.revokeObjectURL(currentSpeechUrl); currentSpeechUrl = null; }
  const engine = $("speechEngine")?.value || localStorage.getItem("nova.speech.engine") || "device";
  const finish = () => {
    state.speaking = false;
    state.audio = null;
    setStatus(state.listening ? "سامعك، كمل كلامك" : "مستنيك تبدأ", state.listening ? "listening" : "idle");
    if (state.listening && state.recognition) window.setTimeout(() => { try { state.recognition.start(); } catch (_) {} }, 350);
  };
  try {
    setStatus(personas[persona].name + (engine === "device" ? " بيستخدم صوت الجهاز..." : " بيجهز صوته..."), "thinking");
    if (engine === "device") {
      await speakWithDevice(spokenText, persona);
      finish();
      setStatus(personas[persona].name + " بيتكلم بصوت الجهاز", "speaking");
      animateCharacter("happy");
      return;
    }
    const voiceId = localStorage.getItem(persona === "soleen" ? "nova.sonex.voice.female" : "nova.sonex.voice.male") || "";
    const result = await invokeNova("tts", { text: spokenText, persona, voice_id: voiceId });
    if (!result.audio || typeof result.audio !== "string") throw new Error("الخادم مرجعش بيانات صوت.");
    const mime = String(result.mime_type || "").split(";")[0].trim().toLowerCase();
    if (mime !== "audio/mpeg" && mime !== "audio/mp3" && mime !== "audio/wav" && mime !== "audio/x-wav") {
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
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", () => { finish(); showToast("المتصفح رفض ملف الصوت (خطأ تشغيل " + (audio.error?.code || "غير معروف") + ")."); }, { once: true });
    state.audio = { pause: () => { audio.pause(); finish(); } };
    try {
      await audio.play();
    } catch (playError) {
      if (playError?.name !== "NotSupportedError") throw playError;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw playError;
      if (!speechAudioContext) speechAudioContext = new AudioContextClass();
      if (speechAudioContext.state === "suspended") await speechAudioContext.resume();
      const buffer = await speechAudioContext.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      const source = speechAudioContext.createBufferSource();
      source.buffer = buffer; source.connect(speechAudioContext.destination); source.onended = finish;
      state.audio = { pause: () => { try { source.stop(); } catch (_) {} finish(); } };
      source.start(0);
    }
    setStatus(personas[persona].name + " بيتكلم بصوت السيرفر", "speaking");
    animateCharacter("happy");
  } catch (error) {
    state.speaking = false; state.audio = null;
    if (currentSpeechUrl) { URL.revokeObjectURL(currentSpeechUrl); currentSpeechUrl = null; }
    setStatus("حصلت مشكلة في تشغيل الصوت", "error");
    const reason = error?.name ? error.name + ": " + (error.message || "") : (error.message || "خطأ غير معروف");
    showToast("تعذر تشغيل الصوت: " + reason.slice(0, 150));
    if (state.listening && state.recognition) window.setTimeout(() => { try { state.recognition.start(); } catch (_) {} }, 350);
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
    throw new Error(data?.error || "تعذر الاتصال بخادم NOVA (" + response.status + ")");
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
async function loadSonexVoices() {
  const result = await invokeNova("speech_voices");
  const voices = Array.isArray(result.voices) ? result.voices : [];
  const fill = (select, gender, storageKey) => {
    const options = voices.filter(v => v.gender === gender);
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
  fill($("speechMaleVoice"), "male", "nova.sonex.voice.male");
  fill($("speechFemaleVoice"), "female", "nova.sonex.voice.female");
  if (!voices.length) throw new Error("Sonex لم يرجع أصواتًا متاحة.");
  setFeedback("speechFeedback", "تم تحميل " + voices.length + " صوتًا. اختار صوت سولي وسولين من القائمتين.");
}
async function loadSpeechSettings() {
  if (!state.session) return;
  try {
    const result = await invokeNova("speech_get");
    if (result.configured) {
      setFeedback("speechFeedback", "مفتاح Sonex Labs محفوظ بأمان في Supabase Vault.");
      try { await loadSonexVoices(); }
      catch (voiceError) { setFeedback("speechFeedback", "المفتاح محفوظ، لكن تعذر تحميل الأصوات: " + voiceError.message, true); }
    } else setFeedback("speechFeedback", "أضف مفتاح Sonex Labs الذي يبدأ بـ vsk_ لتفعيل الصوت.");
  } catch (error) {
    setFeedback("speechFeedback", "تعذر قراءة إعدادات الصوت: " + error.message, true);
  }
}
async function saveSpeechSettings() {
  const button = $("saveSpeechSettings");
  const api_key = $("speechApiKey")?.value.trim() || "";
  if (!api_key) { setFeedback("speechFeedback", "الصق مفتاح Sonex Labs أولًا.", true); return; }
  button.disabled = true;
  button.textContent = "جاري حفظ المفتاح في Supabase...";
  try {
    await invokeNova("speech_save", { api_key });
    $("speechApiKey").value = "";
    await loadSpeechSettings();
    setFeedback("speechFeedback", "تم حفظ مفتاح Sonex Labs داخل Supabase Vault.");
  } catch (error) {
    setFeedback("speechFeedback", error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "حفظ مفتاح Sonex Labs بأمان";
  }
}
async function requestAIReply(text) {
  if (!state.session) return "أنا جاهز معاك يا إسلام ❤️ واجهة NOVA مفتوحة حاليًا في الوضع المحلي. تشغيل ردود الذكاء الاصطناعي وحفظ البيانات السحابي هيتفعل لما نربط الخدمات لاحقًا.";
  if (!state.messages.length) {
    state.messages.push({
      role: "system",
      content: "أنت " + personas[state.persona].name + "، رفيق إسلام الشخصي. تحدث بالمصرية اليومية الطبيعية كأنك شخص مصري بيتكلم مع صاحبه، وليس بالفصحى أو بأسلوب مترجم. استخدم تعبيرات مصرية تلقائية بدون مبالغة، واجعل الرد مناسبًا للنطق الصوتي: جمل واضحة وسلسة، لا تقرأ رموزًا أو تنسيقات أو روابط حرفيًا. كن ودودًا، حافظ على سياق الحوار، كن صريحًا ولا تدّع تنفيذ شيء لم تنفذه، واسأل للتوضيح عند الحاجة. ملف المالك والذاكرة الدائمة: " + (state.profile || "اسم المالك إسلام، وهو صاحب NOVA ومطوّرها.")
    });
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
  try {
    const result = await invokeNova("chat", { messages: state.messages });
    const reply = result.reply || "وصلني رد فاضي من النموذج.";
    state.messages.push({ role: "assistant", content: reply });
    return reply;
  } catch (error) {
    state.messages.pop();
    return "معلش يا " + state.ownerName + "، " + error.message;
  }
}
async function handleRecognizedText(text, voiceTurn = false) {
  const clean = text.trim();
  if (!clean || state.processing || (voiceTurn && !state.listening)) return;
  state.processing = true;
  try {
    if (voiceTurn) { try { state.recognition?.stop(); } catch (_) {} }
    $("liveTranscript").textContent = "أنت قلت: “" + clean + "”";
    addConversationLine(clean, "owner");
    setStatus("بفكر في كلامك...", "thinking");
    animateCharacter("thinking");
    const reply = await requestAIReply(clean);
    if (voiceTurn && !state.listening) return;
    addConversationLine(reply, "nova");
    $("liveTranscript").textContent = reply;
    await speak(reply);
  } finally {
    state.processing = false;
  }
}
function stopListening() {
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
      if (event.results[i].isFinal && transcript) void handleRecognizedText(transcript, true);
      else if (!event.results[i].isFinal) interim += transcript;
    }
    if (interim) { $("liveTranscript").textContent = interim; setStatus("بسمعك...", "listening"); }
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
function submitText(text) {
  const clean = text.trim(); if (!clean) return;
  $("textInput").value = ""; void handleRecognizedText(clean);
}

$("micButton").addEventListener("click", () => state.listening ? stopListening() : startListening());
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
  try { await loadSonexVoices(); }
  catch (error) { setFeedback("speechFeedback", error.message, true); }
  finally { button.disabled = false; }
});
$("speechMaleVoice")?.addEventListener("change", (event) => localStorage.setItem("nova.sonex.voice.male", event.target.value));
$("speechFemaleVoice")?.addEventListener("change", (event) => localStorage.setItem("nova.sonex.voice.female", event.target.value));

const speechEngineSelect = $("speechEngine");
if (speechEngineSelect) {
  speechEngineSelect.value = localStorage.getItem("nova.speech.engine") || "device";
  speechEngineSelect.addEventListener("change", () => {
    localStorage.setItem("nova.speech.engine", speechEngineSelect.value);
    setFeedback("speechEngineFeedback", speechEngineSelect.value === "device"
      ? "تم اختيار صوت الجهاز. تأكد من تثبيت صوت عربي في إعدادات أندرويد."
      : "تم اختيار Sonex Labs عبر Supabase لتوليد الصوت.");
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
import("./nova-3d.js").then(({ initNOVACharacter3D }) => {
  character3D = initNOVACharacter3D();
  character3D?.setPersona(state.persona);
}).catch((error) => {
  console.warn("3D module unavailable; using the CSS fallback.", error);
});
setPersona("soly");
setStatus("سولي معاك", "idle");

