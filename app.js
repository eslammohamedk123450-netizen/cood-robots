const $ = (id) => document.getElementById(id);
const state = {
  persona: "soly", emotion: "idle", listening: false, speaking: false,
  recognition: null, restartRecognition: false, passwordRecovery: false, recoveryEmail: "", ownerName: "إسلام",
  messages: [], session: null, providers: [], models: []
};
const personas = {
  soly: { name: "سولي", description: "صاحبك الأزرق 💙", color: "#69a0ff", accent: "#2760c7", intro: "سولي معاك" },
  soleen: { name: "سولين", description: "صاحبتك الوردية 💗", color: "#f58bc4", accent: "#b62aa5", intro: "سولين معاكي" }
};
let character3D = null;

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
function speak(text) {
  if (!("speechSynthesis" in window)) {
    setStatus("الصوت غير مدعوم في المتصفح ده", "error");
    return;
  }
  state.speaking = true;
  try { state.recognition?.stop(); } catch (_) {}
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ar-EG";
  utterance.rate = 0.96;
  utterance.pitch = state.persona === "soleen" ? 1.08 : 0.98;
  utterance.onstart = () => {
    setStatus(personas[state.persona].name + " بيتكلم", "speaking");
    animateCharacter("happy");
  };
  utterance.onend = () => {
    state.speaking = false;
    setStatus(state.listening ? "سامعك، كمل كلامك" : "مستنيك تبدأ", state.listening ? "listening" : "idle");
    if (state.listening && state.recognition) window.setTimeout(() => { try { state.recognition.start(); } catch (_) {} }, 300);
  };
  utterance.onerror = () => {
    state.speaking = false;
    setStatus("حصلت مشكلة في تشغيل الصوت", "error");
    if (state.listening && state.recognition) window.setTimeout(() => { try { state.recognition.start(); } catch (_) {} }, 300);
  };
  window.speechSynthesis.speak(utterance);
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
    const count = document.createElement("span");
    count.className = "badge";
    count.textContent = enabledCount + " / " + models.length + " نموذج مفعّل";
    head.append(title, count);
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
async function requestAIReply(text) {
  if (!state.session) return "أنا جاهز معاك يا إسلام ❤️ واجهة NOVA مفتوحة حاليًا في الوضع المحلي. تشغيل ردود الذكاء الاصطناعي وحفظ البيانات السحابي هيتفعل لما نربط الخدمات لاحقًا.";
  if (!state.messages.length) {
    state.messages.push({
      role: "system",
      content: "أنت " + personas[state.persona].name + "، رفيق إسلام الشخصي. تحدث بالعربية المصرية الطبيعية الودودة، كن صريحًا ومختصرًا عند الحاجة، لا تدّع تنفيذ شيء لم تنفذه، واسأل للتوضيح عندما يلزم. اسم المالك إسلام."
    });
  }
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
async function handleRecognizedText(text) {
  const clean = text.trim();
  if (!clean) return;
  $("liveTranscript").textContent = "أنت قلت: “" + clean + "”";
  addConversationLine(clean, "owner");
  setStatus("بفكر في كلامك...", "thinking");
  animateCharacter("thinking");
  const reply = await requestAIReply(clean);
  addConversationLine(reply, "nova");
  $("liveTranscript").textContent = reply;
  speak(reply);
}
function stopListening() {
  state.listening = false; state.restartRecognition = false;
  $("micButton").classList.remove("active");
  $("micButton").setAttribute("aria-pressed", "false");
  $("micButton").setAttribute("aria-label", "ابدأ المحادثة الصوتية");
  $("voiceHint").textContent = "اضغط على الميكروفون عشان تبدأ محادثة صوتية";
  try { state.recognition?.stop(); } catch (_) {}
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  setStatus("أنا موجود، لما تحب نتكلم", "idle");
}
function startListening() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    $("liveTranscript").textContent = "المتصفح ده مش بيدعم التعرف على الكلام. جرّب Chrome أو استخدم الكتابة.";
    showToast("التعرف الصوتي غير متاح في المتصفح الحالي"); return;
  }
  if (state.listening) return;
  state.listening = true; state.restartRecognition = true;
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
      if (event.results[i].isFinal && transcript) void handleRecognizedText(transcript);
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
    if (state.speaking) return;
    if (state.restartRecognition && state.listening) {
      window.setTimeout(() => {
        if (!state.listening || !state.restartRecognition || state.speaking) return;
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
$("providerType").addEventListener("change", applyProviderDefaults);
$("providerBaseUrl").addEventListener("input", () => { $("providerBaseUrl").dataset.userEdited = "true"; });
$("settingsDialog").addEventListener("click", (event) => { if (event.target === $("settingsDialog")) closeSettings(); });

window.addEventListener("nova:authenticated", (event) => {
  state.session = event.detail?.token || null;
  state.messages = [];
  $("connectionLabel").textContent = "متصل بخادم NOVA";
  setFeedback("authFeedback", "تم التحقق من كود المالك والاتصال بالخادم.");
  void loadProviders();
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

