import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PROJECT_URL = Deno.env.get("SUPABASE_URL") || "";
const SECRET_KEYS = (() => { try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); } catch { return {}; } })();
const SERVICE_KEY = SECRET_KEYS.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PUBLISHABLE_KEYS = (() => { try { return Object.values(JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}")); } catch { return []; } })();
const ALLOWED_ORIGINS = new Set(["https://mahin98250.github.io"]);
const METHODS = new Set(["upi", "card", "netbanking", "wallet", "cod"]);
const MAX_BODY_BYTES = 8_000;
const rateBuckets = new Map<string, { start: number; count: number }>();

function json(body: unknown, status: number, origin: string | null) {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin" });
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info");
    headers.set("Access-Control-Max-Age", "600");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function limited(req: Request) {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  let b = rateBuckets.get(ip);
  if (!b || now - b.start > 60_000) { b = { start: now, count: 0 }; rateBuckets.set(ip, b); }
  b.count++;
  if (rateBuckets.size > 4000) for (const [k, v] of rateBuckets) if (now - v.start > 60_000) rateBuckets.delete(k);
  return b.count > 30;
}

async function rest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("apikey", SERVICE_KEY);
  headers.set("Authorization", "Bearer " + SERVICE_KEY);
  headers.set("Content-Type", "application/json");
  return fetch(PROJECT_URL + "/rest/v1/" + path, { ...init, headers });
}

async function main(req: Request) {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return json({ ok: true }, 200, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "origin_not_allowed" }, 403, null);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
  if (limited(req)) return json({ error: "rate_limited" }, 429, origin);
  if (!PROJECT_URL || !SERVICE_KEY) return json({ error: "payment_service_not_configured" }, 503, origin);

  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || token === auth) return json({ error: "authentication_required" }, 401, origin);
  // Fail closed when the publishable-key allow-list is absent or malformed.
  // Never forward an empty or caller-controlled API key to Supabase Auth.
  if (!Array.isArray(PUBLISHABLE_KEYS) || PUBLISHABLE_KEYS.length === 0 ||
      PUBLISHABLE_KEYS.some((key) => typeof key !== "string" || key.length === 0)) {
    return json({ error: "payment_auth_not_configured" }, 503, origin);
  }
  const apiKey = req.headers.get("apikey") || "";
  if (!apiKey || !PUBLISHABLE_KEYS.includes(apiKey)) {
    return json({ error: "invalid_api_key" }, 401, origin);
  }

  const userResponse = await fetch(PROJECT_URL + "/auth/v1/user", {
    headers: { apikey: apiKey, Authorization: "Bearer " + token },
  });
  if (!userResponse.ok) return json({ error: "invalid_session" }, 401, origin);
  const user = await userResponse.json();
  if (!user?.id) return json({ error: "invalid_session" }, 401, origin);

  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ error: "request_too_large" }, 413, origin);
  let rawBody = "";
  try {
    const reader = req.body?.getReader();
    if (!reader) return json({ error: "invalid_json" }, 400, origin);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return json({ error: "request_too_large" }, 413, origin);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    rawBody = new TextDecoder().decode(bytes);
  } catch { return json({ error: "invalid_json" }, 400, origin); }
  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch { return json({ error: "invalid_json" }, 400, origin); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_request" }, 400, origin);

  const action = String(body.action || "create_intent");
  if (action === "get_status") {
    const id = String(body.payment_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_payment_id" }, 400, origin);
    const result = await rest("payment_transactions?id=eq." + encodeURIComponent(id) + "&customer_id=eq." + encodeURIComponent(user.id) + "&select=id,order_id,amount_paise,currency,method,status,created_at,updated_at&limit=1");
    if (!result.ok) return json({ error: "payment_lookup_failed" }, 502, origin);
    const rows = await result.json();
    if (!rows.length) return json({ error: "payment_not_found" }, 404, origin);
    return json({ ok: true, payment: rows[0], money_moved: rows[0].status === "captured" }, 200, origin);
  }
  if (action !== "create_intent") return json({ error: "unsupported_action" }, 400, origin);

  const orderId = String(body.order_id || "");
  const method = String(body.method || "");
  const idempotencyKey = String(body.idempotency_key || "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "invalid_order_id" }, 400, origin);
  if (!METHODS.has(method)) return json({ error: "unsupported_payment_method" }, 400, origin);
  if (!/^[A-Za-z0-9:_-]{12,120}$/.test(idempotencyKey)) return json({ error: "invalid_idempotency_key" }, 400, origin);

  const orderResponse = await rest("orders?id=eq." + encodeURIComponent(orderId) + "&customer_id=eq." + encodeURIComponent(user.id) + "&select=id,customer_id,provider_id,status,total&limit=1");
  if (!orderResponse.ok) return json({ error: "order_lookup_failed" }, 502, origin);
  const orders = await orderResponse.json();
  const order = orders[0];
  if (!order) return json({ error: "order_not_found" }, 404, origin);
  if (["cancelled", "rejected", "refunded"].includes(String(order.status))) return json({ error: "order_not_payable" }, 409, origin);

  const total = Number(order.total);
  if (!Number.isFinite(total) || total <= 0 || total > 10_000_000) return json({ error: "invalid_order_amount" }, 409, origin);
  const amountPaise = Math.round(total * 100);
  const existingResponse = await rest("payment_transactions?customer_id=eq." + encodeURIComponent(user.id) + "&idempotency_key=eq." + encodeURIComponent(idempotencyKey) + "&select=id,order_id,amount_paise,currency,method,status,created_at&limit=1");
  if (!existingResponse.ok) return json({ error: "payment_lookup_failed" }, 502, origin);
  const existingRows = await existingResponse.json();
  if (existingRows.length) {
    const existing = existingRows[0];
    if (existing.order_id !== orderId || Number(existing.amount_paise) !== amountPaise || existing.method !== method) return json({ error: "idempotency_conflict" }, 409, origin);
    return json({ ok: true, payment: existing, gateway_ready: false, next_step: "payment_provider_setup_required", money_moved: false }, 200, origin);
  }

  // Fail closed until a regulated/acquiring payment provider and signed webhook are configured.
  // Creating an intent is bookkeeping only; never tell the customer this order is paid.
  const insert = await rest("payment_transactions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      order_id: orderId, customer_id: user.id, provider_id: order.provider_id,
      amount_paise: amountPaise, currency: "INR", method, status: "created",
      idempotency_key: idempotencyKey, gateway_name: null,
    }),
  });
  if (insert.status === 409) {
    // Concurrent retries can race after both observe no existing row. Re-read the
    // unique-key winner and return it only if its order terms match this request.
    const racedResponse = await rest("payment_transactions?customer_id=eq." + encodeURIComponent(user.id) + "&idempotency_key=eq." + encodeURIComponent(idempotencyKey) + "&select=id,order_id,amount_paise,currency,method,status,created_at&limit=1");
    if (racedResponse.ok) {
      const racedRows = await racedResponse.json();
      const raced = racedRows[0];
      if (raced && raced.order_id === orderId && Number(raced.amount_paise) === amountPaise && raced.method === method) {
        return json({ ok: true, payment: raced, gateway_ready: false, next_step: "payment_provider_setup_required", money_moved: false }, 200, origin);
      }
    }
    return json({ error: "idempotency_conflict" }, 409, origin);
  }
  if (!insert.ok) return json({ error: "payment_intent_create_failed" }, 502, origin);
  const rows = await insert.json();
  return json({
    ok: true, payment: rows[0], gateway_ready: false,
    next_step: "payment_provider_setup_required", money_moved: false,
    message: "Payment intent recorded. Online collection is disabled until provider credentials and verified webhooks are configured.",
  }, 201, origin);
}

Deno.serve(async (req: Request) => {
  try { return await main(req); }
  catch (error) {
    console.error("Doodhwala Pay request failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "internal_error" }, 500, req.headers.get("origin"));
  }
});
