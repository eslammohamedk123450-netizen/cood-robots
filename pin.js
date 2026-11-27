(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const API_URL = "https://razvryvazmqvvqkzetuo.supabase.co/functions/v1/nova-ai";
  const PUBLISHABLE_KEY = "sb_publishable_t5xrzZNN6Uj9zhhBLUYQVg_mj7qPjQL";
  const SESSION_KEY = "nova.owner.session.v2";
  function message(text, error = false) {
    const node = $("pinFeedback");
    if (!node) return;
    node.textContent = text;
    node.style.color = error ? "#ff9d91" : "";
  }
  async function callServer(action, payload = {}) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": PUBLISHABLE_KEY },
      body: JSON.stringify({ action, ...payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "تعذر الاتصال بخادم NOVA.");
    return data;
  }
  function openApp(token) {
    localStorage.setItem(SESSION_KEY, token);
    $("authGate").hidden = true;
    if ($("connectionLabel")) $("connectionLabel").textContent = "متصل بخادم NOVA";
    if ($("greeting")) $("greeting").textContent = "أهلاً يا إسلام، نورتني.";
    // Persist a replayable handoff in case the app module has not registered yet.
    window.__solinaPendingOwnerToken = token;
    window.dispatchEvent(new CustomEvent("nova:authenticated", { detail: { token } }));
    window.solinaActivateOwnerSession?.(token);
  }
  async function unlockPin(event) {
    event.preventDefault();
    const pin = $("ownerPin").value.trim();
    if (!/^\d{6,12}$/.test(pin)) return message("اكتب كودًا من 6 إلى 12 رقمًا.", true);
    const button = $("unlockOwnerButton");
    button.disabled = true; button.textContent = "جاري التحقق...";
    try {
      const result = await callServer("login_pin", { pin });
      $("pinLoginForm").reset(); openApp(result.token); message("");
    } catch (error) {
      $("ownerPin").value = ""; message(error.message || "الكود غير صحيح.", true);
    } finally { button.disabled = false; button.textContent = "دخول"; }
  }
  let restoreInFlight = null;
  async function ensureOwnerSession() {
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return false;
    if (restoreInFlight) return restoreInFlight;
    restoreInFlight = (async () => {
      try {
        const result = await callServer("check_session", { token: saved });
        if (result.valid) { openApp(saved); return saved; }
        localStorage.removeItem(SESSION_KEY);
        return false;
      } catch (error) {
        // A temporary network failure must never erase a still-valid owner token.
        message("تعذر التحقق من جلسة المالك بسبب الاتصال بالخادم. احتفظنا بالجلسة؛ حاول تحديث الصفحة.", true);
        return false;
      } finally {
        restoreInFlight = null;
      }
    })();
    return restoreInFlight;
  }
  window.novaEnsureOwnerSession = ensureOwnerSession;

  async function start() {
    if (!$("pinLoginForm") || !$("authGate")) return;
    $("pinLoginForm").addEventListener("submit", unlockPin);
    if (await ensureOwnerSession()) return;
    $("authGate").hidden = false;
    $("pinLoginForm").hidden = false;
    if (!localStorage.getItem(SESSION_KEY)) {
      message("اكتب كود المالك للدخول. بعد تسجيل الدخول على هذا المتصفح، لن نطلبه منك في كل زيارة.");
      $("ownerPin").focus();
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void start(), { once: true });
  else void start();
})();