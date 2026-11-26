import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = "https://razvryvazmqvvqkzetuo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_t5xrzZNN6Uj9zhhBLUYQVg_mj7qPjQL";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const $ = (id) => document.getElementById(id);
const state = {
  persona: "soly", emotion: "idle", listening: false, speaking: false,
  recognition: null, restartRecognition: false, ownerName: "إسلام",
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

async function invokeNova(action, payload = {}) {
  if (!state.session) throw new Error("سجّل الدخول بحساب المالك الأول.");
  const { data, error } = await supabase.functions.invoke("nova-ai", { body: { action, ...payload } });
  if (error) {
    const message = data?.error || error.message || "تعذر الاتصال بالخادم";
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
async function loadProviders() {
  if (!state.session) {
    $("providerList").innerHTML = '<p class="empty-provider-list">سجّل الدخول لعرض مفاتيحك ونماذجك.</p>';
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
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.textContent = model.enabled ? "تعطيل" : "تفعيل";
      if (!model.enabled) toggle.classList.add("disabled-model");
      toggle.addEventListener("click", async () => {
        toggle.disabled = true;
        try {
          await invokeNova("toggle_model", { model_id: model.id, enabled: !model.enabled });
          model.enabled = !model.enabled;
          renderProviders();
        } catch (error) { setFeedback("settingsFeedback", error.message, true); }
        finally { toggle.disabled = false; }
      });
      row.append(label, toggle); list.append(row);
    });
    actions.append(sync, show);
    card.append(head, meta, actions, list);
    container.append(card);
  });
}
async function addProvider() {
  const label = $("providerLabel").value.trim();
  const provider = $("providerType").value.trim() || "openai-compatible";
  const base_url = $("providerBaseUrl").value.trim();
  const api_key = $("providerApiKey").value.trim();
  if (!label || !base_url || !api_key) {
    setFeedback("settingsFeedback", "اكتب اسم المفتاح والرابط والمفتاح السري.", true); return;
  }
  const button = $("addProviderButton");
  button.disabled = true; button.textContent = "جاري الحفظ الآمن...";
  try {
    const result = await invokeNova("add_provider", { label, provider, base_url, api_key });
    $("providerApiKey").value = "";
    $("providerLabel").value = "";
    await loadProviders();
    setFeedback("settingsFeedback", result.message || "تمت إضافة المفتاح.");
  } catch (error) { setFeedback("settingsFeedback", error.message, true); }
  finally { button.disabled = false; button.textContent = "إضافة المفتاح"; }
}
async function signIn() {
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  if (!email || !password) { setFeedback("authFeedback", "اكتب البريد وكلمة المرور.", true); return; }
  const button = $("signInButton"); button.disabled = true;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    state.session = data.session;
    $("connectionLabel").textContent = "متصل بحساب المالك";
    $("authPassword").value = "";
    setFeedback("authFeedback", "تم تسجيل الدخول بحساب المالك.");
    await loadProviders();
  } catch (error) { setFeedback("authFeedback", error.message || "فشل تسجيل الدخول.", true); }
  finally { button.disabled = false; }
}
async function signOut() {
  await supabase.auth.signOut();
  state.session = null; state.providers = []; state.models = [];
  $("connectionLabel").textContent = "جاهز أقابلك";
  $("providerList").innerHTML = '<p class="empty-provider-list">سجّل الدخول لعرض مفاتيحك ونماذجك.</p>';
  setFeedback("authFeedback", "تم تسجيل الخروج.");
}

async function requestAIReply(text) {
  if (!state.session) return "أنا سامعك يا " + state.ownerName + ". سجّل دخولك من الإعدادات، وبعدها أضف مفتاح API عشان أقدر أرد عليك بذكاء اصطناعي حقيقي.";
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
$("signInButton").addEventListener("click", () => void signIn());
$("signOutButton").addEventListener("click", () => void signOut());
$("addProviderButton").addEventListener("click", () => void addProvider());
$("settingsDialog").addEventListener("click", (event) => { if (event.target === $("settingsDialog")) closeSettings(); });

supabase.auth.onAuthStateChange((_event, session) => {
  state.session = session;
  if (session) {
    setFeedback("authFeedback", "أنت مسجل الدخول بحساب المالك.");
    void loadProviders();
  } else {
    setFeedback("authFeedback", "سجّل الدخول بحساب المالك لإدارة المفاتيح.");
    state.providers = []; state.models = [];
    $("providerList").innerHTML = '<p class="empty-provider-list">سجّل الدخول لعرض مفاتيحك ونماذجك.</p>';
  }
});
supabase.auth.getSession().then(({ data }) => {
  state.session = data.session;
  if (state.session) void loadProviders();
  $("connectionLabel").textContent = state.session ? "متصل بحساب المالك" : "جاهز أقابلك";
});
import("./nova-3d.js").then(({ initNOVACharacter3D }) => {
  character3D = initNOVACharacter3D();
  character3D?.setPersona(state.persona);
}).catch((error) => {
  console.warn("3D module unavailable; using the CSS fallback.", error);
});
setPersona("soly");
setStatus("سولي معاك", "idle");
window.nova = { setPersona, startListening, stopListening, animateCharacter, supabase };
