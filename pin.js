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
      headers: { "Content-Type": "application/json", "apikey": PUBLISHABLE_KEY,
        ...(payload.token ? { "Authorization": "Bearer " + payload.token } : {}) },
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
    window.dispatchEvent(new CustomEvent("nova:authenticated", { detail: { token } }));
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
  async function start() {
    if (!$("pinLoginForm") || !$("authGate")) return;
    $("pinLoginForm").addEventListener("submit", unlockPin);
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const result = await callServer("check_session", { token: saved });
        if (result.valid) { openApp(saved); return; }
      } catch (_) {}
      localStorage.removeItem(SESSION_KEY);
    }
    $("authGate").hidden = false;
    $("pinLoginForm").hidden = false;
    message("اكتب كود المالك للدخول. بعد تسجيل الدخول على هذا المتصفح، لن نطلبه منك في كل زيارة.");
    $("ownerPin").focus();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void start(), { once: true });
  else void start();
})();