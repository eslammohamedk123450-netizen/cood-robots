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
      headers: {
        "Content-Type": "application/json",
        "apikey": PUBLISHABLE_KEY,
        ...(payload.token ? { "Authorization": "Bearer " + payload.token } : {})
      },
      body: JSON.stringify({ action, ...payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "تعذر الاتصال بخادم NOVA.");
      error.status = response.status;
      error.retryAfter = Number(data.retry_after || response.headers.get("Retry-After") || 0);
      throw error;
    }
    return data;
  }
  function showGate(isFirstSetup) {
    $("authGate").hidden = false;
    $("pinSetupForm").hidden = !isFirstSetup;
    $("pinLoginForm").hidden = isFirstSetup;
    $("pinGateTitle").textContent = isFirstSetup ? "إنشاء كود المالك" : "تسجيل الدخول";
    $("pinGateDescription").textContent = isFirstSetup
      ? "أنشئ كودك مرة واحدة فقط. سيعمل نفس الكود على كل أجهزتك."
      : "اكتب كود المالك فقط لفتح NOVA من أي جهاز.";
    message("");
    if (isFirstSetup) $("newOwnerPin").focus();
    else $("ownerPin").focus();
  }
  function openApp(token) {
    ["nova.owner.pin.hash.v1", "nova.owner.pin.salt.v1", "nova.owner.pin.attempts.v1", "nova.owner.pin.lockUntil.v1"].forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(SESSION_KEY, token);
    $("authGate").hidden = true;
    if ($("connectionLabel")) $("connectionLabel").textContent = "متصل بخادم NOVA";
    if ($("greeting")) $("greeting").textContent = "أهلاً يا إسلام، نورتني.";
    window.dispatchEvent(new CustomEvent("nova:authenticated", { detail: { token } }));
  }
  async function checkSetup() {
    try {
      const result = await callServer("check_setup");
      showGate(!result.initialized);
    } catch (error) {
      $("pinSetupForm").hidden = true;
      $("pinLoginForm").hidden = true;
      message("مش قادر أوصل لخادم NOVA. اتأكد من الإنترنت وأعد تحميل الصفحة. " + error.message, true);
    }
  }
  async function savePin(event) {
    event.preventDefault();
    const pin = $("newOwnerPin").value.trim();
    const confirm = $("confirmOwnerPin").value.trim();
    if (!/^\d{6,12}$/.test(pin)) return message("الكود لازم يكون من 6 إلى 12 رقمًا.", true);
    if (pin !== confirm) return message("الكودان غير متطابقين. اكتبهم مرة تانية.", true);
    const button = $("saveOwnerPinButton");
    button.disabled = true;
    button.textContent = "جاري إنشاء الكود على الخادم...";
    try {
      const result = await callServer("setup_pin", { pin });
      $("pinSetupForm").reset();
      openApp(result.token);
      message("");
    } catch (error) {
      if (error.status === 409) {
        showGate(false);
        message("كود المالك اتعمل بالفعل. سجّل الدخول بالكود الموجود.", true);
      } else {
        message(error.message || "تعذر إنشاء الكود. حاول مرة أخرى.", true);
      }
    } finally {
      button.disabled = false;
      button.textContent = "إنشاء الكود وفتح NOVA";
    }
  }
  async function unlockPin(event) {
    event.preventDefault();
    const pin = $("ownerPin").value.trim();
    if (!/^\d{6,12}$/.test(pin)) return message("اكتب كودًا من 6 إلى 12 رقمًا.", true);
    const button = $("unlockOwnerButton");
    button.disabled = true;
    button.textContent = "جاري التحقق من الخادم...";
    try {
      const result = await callServer("login_pin", { pin });
      $("pinLoginForm").reset();
      openApp(result.token);
      message("");
    } catch (error) {
      $("ownerPin").value = "";
      if (error.status === 429) {
        const minutes = Math.max(1, Math.ceil((error.retryAfter || 600) / 60));
        message(error.message + " المتبقي تقريبًا " + minutes + " دقيقة.", true);
      } else {
        message(error.message || "الكود غير صحيح.", true);
      }
    } finally {
      button.disabled = false;
      button.textContent = "دخول";
    }
  }
  function start() {
    if (!$("pinSetupForm") || !$("pinLoginForm") || !$("authGate")) return;
    $("pinSetupForm").addEventListener("submit", savePin);
    $("pinLoginForm").addEventListener("submit", unlockPin);
    void checkSetup();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();