import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const allowedOrigins = new Set(["https://eslammohamedk123450-netizen.github.io"]);
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && (allowedOrigins.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) ? origin : "https://eslammohamedk123450-netizen.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const json = (data: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" } });

function safeBaseUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 300) return null;
  try {
    const u = new URL(value.trim());
    const h = u.hostname.toLowerCase();
    if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || (u.port && u.port !== "443")) return null;
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return null;
    if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return null;
    return u.toString().replace(/\/+$/, "");
  } catch { return null; }
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

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Sign in is required" }, 401, origin);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: "Bearer " + token } } });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Invalid or expired session" }, 401, origin);
  const userId = authData.user.id;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const body = await req.json();
    const action = cleanString(body?.action, 40);

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
      const baseUrl = safeBaseUrl(body?.base_url);
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
      const rows = models.map((m) => ({ user_id: userId, api_key_id: provider.id, model_id: m.id, display_name: m.name }));
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

    if (action === "chat") {
      const messages = Array.isArray(body?.messages) ? body.messages.slice(-24) : [];
      const userMessage = messages.length ? messages[messages.length - 1] : null;
      if (!userMessage || userMessage.role !== "user" || typeof userMessage.content !== "string" || userMessage.content.length > 12000) {
        return json({ error: "رسالة غير صالحة" }, 400, origin);
      }
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
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500, origin);
  }
});
