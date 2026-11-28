export const SPEECH_QUOTA_COOLDOWN_MS = 12 * 60 * 60 * 1000;

function getStorage(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function speechQuotaCooldownKey(provider) {
  const safeProvider = String(provider || "unknown").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return "nova.speech.quotaCooldown.v1." + safeProvider;
}

export function isSpeechQuotaCoolingDown(provider, storage, now = Date.now()) {
  const target = getStorage(storage);
  if (!target) return false;
  const key = speechQuotaCooldownKey(provider);
  try {
    const raw = target.getItem(key);
    if (raw === null) return false;
    const until = Number(raw);
    if (Number.isFinite(until) && until > now) return true;
    target.removeItem(key);
  } catch {}
  return false;
}

export function markSpeechQuotaExceeded(provider, storage, now = Date.now()) {
  const target = getStorage(storage);
  if (!target) return false;
  try {
    target.setItem(speechQuotaCooldownKey(provider), String(now + SPEECH_QUOTA_COOLDOWN_MS));
    return true;
  } catch { return false; }
}

export function clearSpeechQuotaCooldown(provider, storage) {
  const target = getStorage(storage);
  if (!target) return false;
  try {
    target.removeItem(speechQuotaCooldownKey(provider));
    return true;
  } catch { return false; }
}
