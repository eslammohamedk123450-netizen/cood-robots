import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const allowedOrigins = new Set(["https://eslammohamedk123450-netizen.github.io"]);
const cors = (origin: string | null) => ({
  ...(origin && allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
});
const json = (data: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" } });

function safeBaseUrl(value: unknown, provider: string): string | null {
  if (typeof value !== "string" || value.length > 300) return null;
  try {
    const u = new URL(value.trim());
    const h = u.hostname.toLowerCase();
    if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || (u.port && u.port !== "443")) return null;
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".test") || h.endsWith(".invalid") || /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return null;
    if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return null;
    const officialHosts: Record<string,string> = {
      gemini: "generativelanguage.googleapis.com",
      openrouter: "openrouter.ai",
      openai: "api.openai.com",
      anthropic: "api.anthropic.com",
    };
    const expectedHost = officialHosts[provider];
    if (expectedHost && h !== expectedHost) return null;
    return u.toString().replace(/\/+$/, "");
  } catch { return null; }
}
async function readJsonBody(req: Request, maxBytes = 400_000): Promise<any> {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Empty request body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Request body too large");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(merged));
}
function normalizeMessages(value: unknown): Array<{role:"system"|"user"|"assistant";content:string}> | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 24) return null;
  let total = 0;
  let systemCount = 0;
  const clean: Array<{role:"system"|"user"|"assistant";content:string}> = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (!item || typeof item !== "object" || !["system","user","assistant"].includes(item.role) || typeof item.content !== "string") return null;
    if (item.content.length > 12000 || (item.role === "user" && !item.content.trim())) return null;
    total += item.content.length;
    if (total > 200000) return null;
    if (item.role === "system") {
      systemCount++;
      if (systemCount > 1 || i !== 0 || item.content.length > 8000) return null;
    }
    clean.push({ role: item.role, content: item.content });
  }
  if (clean[clean.length - 1].role !== "user") return null;
  return clean;
}
function cleanString(v: unknown, max = 120): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
type ProviderType = "gemini" | "openrouter" | "openai" | "anthropic" | "custom";
const providerTypes = new Set<string>(["gemini", "openrouter", "openai", "anthropic", "custom", "openai-compatible"]);
function providerHeaders(provider: ProviderType, apiKey: string): Record<string,string> {
  if (provider === "gemini") return { "x-goog-api-key": apiKey, Accept: "application/json" };
  if (provider === "anthropic") return { "x-api-key": apiKey, "anthropic-version": "2023-06-01", Accept: "application/json" };
  return { Authorization: "Bearer " + apiKey, Accept: "application/json" };
}
async function providerModels(provider: ProviderType, baseUrl: string, apiKey: string): Promise<Array<{id:string; name:string}>> {
  const response = await fetch(baseUrl + "/models", {
    headers: providerHeaders(provider, apiKey),
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Provider models endpoint returned HTTP " + response.status);
  const body = await response.json();
  const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : [];
  return rows.filter((m: any) => provider !== "gemini" || (Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))).map((m: any) => {
    const rawId = cleanString(m?.id ?? m?.name, 200);
    const id = provider === "gemini" ? rawId.replace(/^models\//, "") : rawId;
    return { id, name: cleanString(m?.displayName ?? m?.name ?? m?.id, 200) };
  }).filter((m: any) => m.id).slice(0, 500);
}
async function requestGeminiSpeech(baseUrl: string, apiKey: string, text: string, persona: string): Promise<{data:string; mimeType:string}> {
  const voiceName = persona === "soleen" ? "Callirrhoe" : "Achird";
  const style = persona === "soleen"
    ? "Speak in natural everyday Egyptian Arabic (Masri, Egypt). You are a warm, friendly young Egyptian woman talking naturally to a close friend. Use an authentic Egyptian accent, relaxed conversational rhythm, expressive but subtle intonation, human-like phrasing, gentle breaths, and natural pauses. Avoid Modern Standard Arabic, robotic reading, announcer delivery, or exaggerated acting."
    : "Speak in natural everyday Egyptian Arabic (Masri, Egypt). You are a warm, friendly young Egyptian man talking naturally to a close friend. Use an authentic Egyptian accent, relaxed conversational rhythm, expressive but subtle intonation, human-like phrasing, gentle breaths, and natural pauses. Avoid Modern Standard Arabic, robotic reading, announcer delivery, or exaggerated acting.";
  const endpoint = baseUrl.replace(/\/+$/, "") + "/models/gemini-3.8-flash-tts:generateContent";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text, speechMetadata: { style } }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { languageCode: "ar-EG", voiceConfig: { prebuiltVoiceConfig: { voiceName } } } },
    }),
    signal: AbortSignal.timeout(60000),
    redirect: "error",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = cleanString(result?.error?.message, 300);
    throw new Error(providerMessage || "Gemini TTS رفض الطلب (HTTP " + response.status + "). تأكد أن مفتاح Gemini يدعم نموذج الصوت.");
  }
  const audioPart = result?.candidates?.[0]?.content?.parts?.find((part: any) => part?.inlineData?.data);
  if (!audioPart?.inlineData?.data) throw new Error("Gemini TTS لم يرجع ملفًا صوتيًا.");
  return { data: audioPart.inlineData.data, mimeType: cleanString(audioPart.inlineData.mimeType, 120) || "audio/L16;codec=pcm;rate=24000" };
}
async function requestProviderChat(provider: ProviderType, baseUrl: string, apiKey: string, modelId: string, messages: any[]): Promise<string> {
  const systemText = messages.filter((m) => m?.role === "system" && typeof m.content === "string").map((m) => m.content).join("\n");
  const dialogue = messages.filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string");
  if (provider === "gemini") {
    const contents = dialogue.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content.slice(0, 12000) }],
    }));
    const payload: any = { contents, generationConfig: { temperature: 0.75, maxOutputTokens: 2048 } };
    if (systemText) payload.systemInstruction = { parts: [{ text: systemText.slice(0, 8000) }] };
    const response = await fetch(baseUrl + "/models/" + encodeURIComponent(modelId.replace(/^models\//, "")) + ":generateContent", {
      method: "POST",
      headers: { ...providerHeaders(provider, apiKey), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
      redirect: "error",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("HTTP " + response.status);
    const reply = result?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("").trim();
    if (!reply) throw new Error("empty response");
    return reply;
  }
  if (provider === "anthropic") {
    const response = await fetch(baseUrl + "/messages", {
      method: "POST",
      headers: { ...providerHeaders(provider, apiKey), "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 2048,
        ...(systemText ? { system: systemText.slice(0, 8000) } : {}),
        messages: dialogue.map((m) => ({ role: m.role, content: m.content.slice(0, 12000) })),
      }),
      signal: AbortSignal.timeout(45000),
      redirect: "error",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("HTTP " + response.status);
    const reply = Array.isArray(result?.content) ? result.content.map((part: any) => part.text || "").join("").trim() : "";
    if (!reply) throw new Error("empty response");
    return reply;
  }
  const response = await fetch(baseUrl + "/chat/completions", {
    method: "POST",
    headers: { ...providerHeaders(provider, apiKey), "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelId, messages, stream: false }),
    signal: AbortSignal.timeout(45000),
    redirect: "error",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("HTTP " + response.status);
  const reply = result?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) throw new Error("empty response");
  return reply.trim();
}


const OWNER_USER_ID = "f980820b-f59d-453c-9df8-2b9afc695c74";
const PIN_ITERATIONS = 310000;
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(value: string): Uint8Array {
  return new Uint8Array((value.match(/.{2}/g) ?? []).map((part) => parseInt(part, 16)));
}
async function deriveServerPinHash(pin: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(saltHex), iterations: PIN_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}
async function sha256Hex(value: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function createSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 400_000) return json({ error: "Request body too large" }, 413, origin);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const body = await readJsonBody(req);
    const action = cleanString(body?.action, 40);

    if (action === "check_setup") {
      const { data, error } = await admin.from("nova_owner_pin_auth").select("id").eq("id", 1).maybeSingle();
      if (error) throw new Error("Owner PIN setup status unavailable");
      return json({ initialized: Boolean(data) }, 200, origin);
    }

    if (action === "setup_pin") {
      const pin = typeof body?.pin === "string" ? body.pin : "";
      if (!/^\d{6,12}$/.test(pin)) return json({ error: "الكود لازم يكون من 6 إلى 12 رقمًا." }, 400, origin);
      const { data: existing, error: readError } = await admin.from("nova_owner_pin_auth").select("id").eq("id", 1).maybeSingle();
      if (readError) throw new Error("Owner PIN setup status unavailable");
      if (existing) return json({ error: "تم إنشاء كود المالك بالفعل. استخدم شاشة الدخول بالكود." }, 409, origin);
      const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
      const pinHash = await deriveServerPinHash(pin, salt);
      const { error: insertError } = await admin.from("nova_owner_pin_auth").insert({
        id: 1, user_id: OWNER_USER_ID, pin_salt: salt, pin_hash: pinHash, failed_attempts: 0,
      });
      if (insertError) {
        if (insertError.code === "23505") return json({ error: "تم إنشاء كود المالك بالفعل. أعد تحميل الصفحة وسجّل بالكود." }, 409, origin);
        throw new Error("تعذر حفظ كود المالك على الخادم");
      }
      const tokenValue = createSessionToken();
      const tokenHash = await sha256Hex(tokenValue);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: sessionError } = await admin.from("nova_owner_sessions").insert({ token_hash: tokenHash, user_id: OWNER_USER_ID, expires_at: expiresAt });
      if (sessionError) throw new Error("تم إنشاء الكود لكن تعذر بدء الجلسة. سجّل الدخول بالكود.");
      return json({ token: tokenValue, expires_at: expiresAt, message: "تم إنشاء كود المالك على الخادم بنجاح." }, 201, origin);
    }

    if (action === "login_pin") {
      const pin = typeof body?.pin === "string" ? body.pin : "";
      if (!/^\d{6,12}$/.test(pin)) return json({ error: "اكتب كودًا من 6 إلى 12 رقمًا." }, 400, origin);
      const { data: authRow, error: authReadError } = await admin.from("nova_owner_pin_auth")
        .select("pin_salt,pin_hash,failed_attempts,locked_until").eq("id", 1).maybeSingle();
      if (authReadError) throw new Error("تعذر قراءة إعدادات الدخول");
      if (!authRow) return json({ error: "لم يتم إنشاء كود المالك بعد. افتح شاشة الإنشاء." }, 409, origin);
      if (authRow.locked_until && new Date(authRow.locked_until).getTime() > Date.now()) {
        const seconds = Math.ceil((new Date(authRow.locked_until).getTime() - Date.now()) / 1000);
        return new Response(JSON.stringify({ error: "تم إيقاف المحاولات مؤقتًا بعد 6 محاولات خاطئة. حاول بعد 10 دقائق.", retry_after: seconds }), {
          status: 429, headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store", "Retry-After": String(seconds) },
        });
      }
      const candidate = await deriveServerPinHash(pin, authRow.pin_salt);
      if (!constantTimeEqual(candidate, authRow.pin_hash)) {
        const { data: failureRows, error: failureError } = await admin.rpc("nova_record_pin_failure");
        if (failureError) throw new Error("تعذر تسجيل محاولة الدخول");
        const failure = Array.isArray(failureRows) ? failureRows[0] : failureRows;
        const attempts = Number(failure?.failed_attempts ?? 1);
        if (failure?.locked_until) {
          return new Response(JSON.stringify({ error: "الكود غير صحيح. تم إيقاف الدخول لمدة 10 دقائق بعد 6 محاولات.", retry_after: 600 }), {
            status: 429, headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store", "Retry-After": "600" },
          });
        }
        return json({ error: "الكود غير صحيح. متبقي " + Math.max(0, 6 - attempts) + " محاولات." }, 401, origin);
      }
      const { error: resetError } = await admin.from("nova_owner_pin_auth")
        .update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() }).eq("id", 1);
      if (resetError) throw new Error("تعذر تحديث حالة الدخول");
      await admin.from("nova_owner_sessions").delete().lt("expires_at", new Date().toISOString());
      const tokenValue = createSessionToken();
      const tokenHash = await sha256Hex(tokenValue);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: sessionError } = await admin.from("nova_owner_sessions").insert({ token_hash: tokenHash, user_id: OWNER_USER_ID, expires_at: expiresAt });
      if (sessionError) throw new Error("تعذر إنشاء جلسة الدخول. حاول مرة أخرى.");
      return json({ token: tokenValue, expires_at: expiresAt, message: "تم التحقق من كود المالك." }, 200, origin);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "اكتب كود المالك أولًا." }, 401, origin);
    const tokenHash = await sha256Hex(token);
    const { data: sessionRow, error: sessionReadError } = await admin.from("nova_owner_sessions")
      .select("token_hash,user_id,expires_at").eq("token_hash", tokenHash).eq("user_id", OWNER_USER_ID)
      .gt("expires_at", new Date().toISOString()).maybeSingle();
    if (sessionReadError || !sessionRow) return json({ error: "انتهت جلسة الدخول. اكتب كود المالك مرة أخرى." }, 401, origin);
    const userId = OWNER_USER_ID;
    await admin.from("nova_owner_sessions").update({ last_used_at: new Date().toISOString() }).eq("token_hash", tokenHash);
    const actionLimits: Record<string, number> = {
      list: 60,
      add_provider: 5,
      sync_models: 10,
      toggle_model: 30,
      chat: 20,
      tts: 12,
    };
    const requestLimit = actionLimits[action];
    if (!requestLimit) return json({ error: "Unknown action" }, 400, origin);
    const { data: allowed, error: limitError } = await admin.rpc("nova_consume_rate_limit", {
      p_user_id: userId,
      p_action: action,
      p_limit: requestLimit,
      p_window_seconds: 60,
    });
    if (limitError) throw new Error("Rate limit protection unavailable");
    if (allowed !== true) {
      return new Response(JSON.stringify({ error: "طلبات كتير في وقت قصير. استنى دقيقة وجرب تاني." }), {
        status: 429,
        headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store", "Retry-After": "60" },
      });
    }

    if (action === "list") {
      const { data: providers, error } = await admin.from("nova_api_keys")
        .select("id,label,provider,base_url,is_active,created_at")
        .eq("user_id", userId).order("created_at", { ascending: true });
      if (error) throw error;
      const { data: models, error: modelError } = await admin.from("nova_api_models")
        .select("id,api_key_id,model_id,display_name,enabled,last_checked_at")
        .eq("user_id", userId).order("model_id");
      if (modelError) throw modelError;
      return json({ providers: providers ?? [], models: models ?? [] }, 200, origin);
    }

    if (action === "add_provider") {
      const label = cleanString(body?.label, 80);
      const provider = cleanString(body?.provider, 50) || "custom";
      if (!providerTypes.has(provider as ProviderType)) return json({ error: "مزود الخدمة غير مدعوم" }, 400, origin);
      const baseUrl = safeBaseUrl(body?.base_url, provider);
      const apiKey = typeof body?.api_key === "string" ? body.api_key.trim() : "";
      if (!label || !baseUrl || apiKey.length < 8 || apiKey.length > 4096) return json({ error: "راجع الاسم والرابط ومفتاح API" }, 400, origin);
      const { data: secretId, error: secretError } = await admin.rpc("nova_store_api_secret", { p_name: "NOVA " + label, p_secret: apiKey });
      if (secretError || !secretId) throw new Error("Secure Vault storage failed");
      const { data: row, error } = await admin.from("nova_api_keys").insert({
        user_id: userId, label, provider, base_url: baseUrl, secret_id: secretId, is_active: true,
      }).select("id,label,provider,base_url,is_active,created_at").single();
      if (error) throw error;
      return json({ provider: row, message: "تم حفظ المفتاح داخل Vault بأمان. حدّث قائمة النماذج لاكتشاف النماذج المتاحة." }, 201, origin);
    }

    if (action === "sync_models") {
      const providerId = cleanString(body?.provider_id, 80);
      const { data: provider, error } = await admin.from("nova_api_keys")
        .select("id,provider,base_url,secret_id").eq("id", providerId).eq("user_id", userId).maybeSingle();
      if (error || !provider) return json({ error: "المفتاح غير موجود" }, 404, origin);
      const { data: apiKey, error: keyError } = await admin.rpc("nova_read_api_secret", { p_secret_id: provider.secret_id });
      if (keyError || typeof apiKey !== "string" || !apiKey) throw new Error("Vault credential unavailable");
      const models = await providerModels(provider.provider as ProviderType, provider.base_url, apiKey);
      if (!models.length) return json({ error: "لم يرجع المزود أي نماذج" }, 422, origin);
      const rows = models.map((m) => ({ user_id: userId, api_key_id: provider.id, model_id: m.id, display_name: m.name, enabled: false }));
      const { error: upsertError } = await admin.from("nova_api_models").upsert(rows, { onConflict: "api_key_id,model_id", ignoreDuplicates: true });
      if (upsertError) throw upsertError;
      await admin.from("nova_api_models").update({ last_checked_at: new Date().toISOString() }).eq("api_key_id", provider.id).eq("user_id", userId);
      return json({ synced: models.length }, 200, origin);
    }

    if (action === "toggle_model") {
      const modelId = cleanString(body?.model_id, 80);
      const enabled = body?.enabled === true;
      const { data, error } = await admin.from("nova_api_models").update({ enabled, updated_at: new Date().toISOString() })
        .eq("id", modelId).eq("user_id", userId).select("id,enabled").maybeSingle();
      if (error || !data) return json({ error: "تعذر تحديث النموذج" }, 404, origin);
      return json({ model: data }, 200, origin);
    }

    if (action === "tts") {
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      const persona = body?.persona === "soleen" ? "soleen" : body?.persona === "soly" ? "soly" : "";
      if (!text || text.length > 2600 || !persona) return json({ error: "نص الصوت أو الشخصية غير صالح." }, 400, origin);
      const { data: providers, error: providerError } = await admin.from("nova_api_keys")
        .select("id,base_url,secret_id").eq("user_id", userId).eq("provider", "gemini").eq("is_active", true)
        .order("created_at", { ascending: true }).limit(1);
      if (providerError) throw providerError;
      const provider = providers?.[0];
      if (!provider) return json({ error: "علشان أتكلم بصوت طبيعي، أضف مفتاح Gemini من الإعدادات > مزودات API. الصوت الآلي القديم اتشال." }, 409, origin);
      const { data: apiKey, error: keyError } = await admin.rpc("nova_read_api_secret", { p_secret_id: provider.secret_id });
      if (keyError || typeof apiKey !== "string" || !apiKey) throw new Error("Gemini API credential unavailable");
      const audio = await requestGeminiSpeech(provider.base_url, apiKey, text, persona);
      return json({ audio: audio.data, mime_type: audio.mimeType, voice: persona === "soleen" ? "Callirrhoe" : "Achird", engine: "gemini-3.8-flash-tts" }, 200, origin);
    }

    if (action === "chat") {
      const messages = normalizeMessages(body?.messages);
      if (!messages) return json({ error: "سجل المحادثة غير صالح أو تجاوز الحدود المسموحة" }, 400, origin);
      const userMessage = messages[messages.length - 1];
      const { data: models, error } = await admin.from("nova_api_models")
        .select("id,model_id,api_key_id")
        .eq("user_id", userId).eq("enabled", true).limit(30);
      if (error) throw error;
      if (!models?.length) return json({ error: "مفيش نماذج مفعّلة. أضف مفتاح API وفعّل نموذجًا واحدًا على الأقل." }, 409, origin);
      const providerIds = [...new Set(models.map((model: any) => model.api_key_id))];
      const { data: providers, error: providerError } = await admin.from("nova_api_keys")
        .select("id,provider,base_url,secret_id,is_active").eq("user_id", userId).eq("is_active", true).in("id", providerIds);
      if (providerError) throw providerError;
      const providerMap = new Map((providers ?? []).map((provider: any) => [provider.id, provider]));
      const failures: string[] = [];
      for (const model of models) {
        const provider = providerMap.get(model.api_key_id);
        if (!provider) continue;
        const { data: apiKey, error: keyError } = await admin.rpc("nova_read_api_secret", { p_secret_id: provider.secret_id });
        if (keyError || typeof apiKey !== "string" || !apiKey) { failures.push(model.model_id + ": vault unavailable"); continue; }
        try {
          const providerType = provider.provider as ProviderType;
          if (!providerTypes.has(providerType)) { failures.push(model.model_id + ": unsupported provider"); continue; }
          const reply = await requestProviderChat(providerType, provider.base_url, apiKey, model.model_id, messages);
          if (reply) return json({ reply, model: model.model_id, provider: providerType }, 200, origin);
          failures.push(model.model_id + ": empty response");
        } catch (error) {
          failures.push(model.model_id + ": " + (error instanceof Error ? error.message : "request failed"));
        }
      }
      return json({ error: "كل النماذج المفعّلة فشلت في الرد. راجع المفاتيح أو حالة النماذج.", failures: failures.slice(0, 8) }, 502, origin);
    }

    return json({ error: "Unknown action" }, 400, origin);
  } catch (error) {
    console.error("NOVA provider function error:", error instanceof Error ? error.message : "unknown");
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "Request body too large") return json({ error: message }, 413, origin);
    if (error instanceof SyntaxError) return json({ error: "Invalid JSON request body" }, 400, origin);
    return json({ error: "Internal server error" }, 500, origin);
  }
});
