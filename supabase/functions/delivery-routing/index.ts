import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// All database RPCs use the caller's end-user JWT; this function never elevates to service-role access.

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const ROUTING_BASE_URL = (Deno.env.get("DELIVERY_ROUTING_BASE_URL") || "").replace(/\/+$/, "");
const PUBLISHABLE_KEYS = (() => {
  try {
    const value = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    return Array.isArray(value) ? value : Object.values(value);
  } catch {
    return [Deno.env.get("SUPABASE_ANON_KEY") || ""].filter(Boolean);
  }
})();
const ALLOWED_ORIGINS = new Set([
  "https://mahin98250.github.io",
  ...(Deno.env.get("DELIVERY_ALLOWED_ORIGINS") || "").split(",").map(value => value.trim()).filter(Boolean),
]);
const MAX_BODY_BYTES = 20_000;
const MAX_STOPS = 99;
const RATE_LIMIT_PER_MINUTE = 30;
const rateBuckets = new Map<string, { start: number; count: number }>();

type Point = { latitude: number; longitude: number };
type DeliveryOrder = {
  order_id: string;
  latitude: number;
  longitude: number;
  recipient_name?: string;
  address_line?: string;
  area_name?: string;
  city?: string;
  quantity_litres?: number;
  order_status?: string;
  created_at?: string;
};
type Matrix = { code?: string; durations?: (number | null)[][]; distances?: (number | null)[][] };

function json(body: unknown, status: number, origin: string | null) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info");
    headers.set("Access-Control-Max-Age", "600");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function rateLimited(req: Request): boolean {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start > 60_000) {
    bucket = { start: now, count: 0 };
    rateBuckets.set(ip, bucket);
  }
  bucket.count++;
  if (rateBuckets.size > 4000) {
    for (const [key, value] of rateBuckets) {
      if (now - value.start > 60_000) rateBuckets.delete(key);
    }
  }
  return bucket.count > RATE_LIMIT_PER_MINUTE;
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const length = Number(req.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES || !req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchJson(url: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: init.signal || AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("upstream_http_" + response.status);
  return await response.json();
}

async function rpcAsUser(apiKey: string, token: string, name: string, args: Record<string, unknown>) {
  return await fetchJson(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: apiKey,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
}

function totalCost(route: number[], matrix: (number | null)[][]): number {
  let cost = 0;
  let previous = 0; // index 0 is the provider base
  for (const next of route) {
    const duration = matrix[previous]?.[next];
    if (duration === null || duration === undefined || !Number.isFinite(duration)) return Number.POSITIVE_INFINITY;
    cost += duration;
    previous = next;
  }
  return cost;
}

// Road-duration nearest-neighbour seed followed by a bounded 2-opt improvement.
// This minimizes the supplied road matrix rather than straight-line distance.
function optimizeStops(matrix: (number | null)[][]): number[] {
  const size = matrix.length;
  if (size < 2 || size > MAX_STOPS + 1 || matrix.some(row => !Array.isArray(row) || row.length !== size)) {
    throw new Error("invalid_route_matrix");
  }
  const remaining = new Set(Array.from({ length: size - 1 }, (_, index) => index + 1));
  const route: number[] = [];
  let current = 0;
  while (remaining.size) {
    let best = -1;
    let bestDuration = Number.POSITIVE_INFINITY;
    for (const candidate of remaining) {
      const duration = matrix[current]?.[candidate];
      if (duration !== null && duration !== undefined && Number.isFinite(duration) && duration < bestDuration) {
        best = candidate;
        bestDuration = duration;
      }
    }
    if (best < 0) throw new Error("unreachable_delivery_stop");
    route.push(best);
    remaining.delete(best);
    current = best;
  }

  let bestCost = totalCost(route, matrix);
  let improved = true;
  let passes = 0;
  while (improved && passes < 12) {
    improved = false;
    passes++;
    for (let start = 0; start < route.length - 1; start++) {
      for (let end = start + 1; end < route.length; end++) {
        const candidate = route.slice();
        const reversed = candidate.slice(start, end + 1).reverse();
        candidate.splice(start, end - start + 1, ...reversed);
        const candidateCost = totalCost(candidate, matrix);
        if (candidateCost + 0.01 < bestCost) {
          route.splice(0, route.length, ...candidate);
          bestCost = candidateCost;
          improved = true;
        }
      }
    }
  }
  return route;
}

function timeWindow(cursorMs: number): { start: string; end: string } {
  const uncertaintyMs = 7 * 60_000;
  return {
    start: new Date(cursorMs - uncertaintyMs).toISOString(),
    end: new Date(cursorMs + uncertaintyMs).toISOString(),
  };
}

async function planRoute(apiKey: string, token: string, body: Record<string, unknown>) {
  const providerId = body.provider_id;
  const driverId = body.driver_user_id;
  const serviceDate = body.service_date;
  const startTime = body.start_time;
  const rawOrderIds = body.order_ids;

  if (!isUuid(providerId) || !isUuid(driverId)) return { error: "invalid_provider_or_driver", status: 400 };
  if (!Array.isArray(rawOrderIds) || rawOrderIds.length < 1 || rawOrderIds.length > MAX_STOPS
    || rawOrderIds.some(id => !isUuid(id)) || new Set(rawOrderIds).size !== rawOrderIds.length) {
    return { error: "select_between_1_and_99_unique_orders", status: 400 };
  }
  if (typeof serviceDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)
    || typeof startTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
    return { error: "service_date_and_start_time_required", status: 400 };
  }
  if (!SUPABASE_URL || !ROUTING_BASE_URL) return { error: "routing_service_not_configured", status: 503 };
  try {
    const routingUrl = new URL(ROUTING_BASE_URL);
    if (routingUrl.protocol !== "https:" && routingUrl.hostname !== "localhost" && routingUrl.hostname !== "127.0.0.1") {
      return { error: "routing_service_must_use_https", status: 503 };
    }
  } catch {
    return { error: "routing_service_url_invalid", status: 503 };
  }

  let planning: any;
  try {
    planning = await rpcAsUser(apiKey, token, "delivery_get_route_planning_data", {
      p_provider_id: providerId,
      p_limit: MAX_STOPS,
    });
  } catch {
    return { error: "delivery_planning_not_available", status: 403 };
  }
  if (!planning?.origin || !Array.isArray(planning.orders)) return { error: "provider_route_origin_not_configured", status: 409 };
  const selectedIds = rawOrderIds as string[];
  const candidateById = new Map<string, DeliveryOrder>();
  for (const item of planning.orders as DeliveryOrder[]) candidateById.set(item.order_id, item);
  if (selectedIds.some(id => !candidateById.has(id))) return { error: "selected_order_is_not_route_eligible", status: 409 };
  const selected = selectedIds.map(id => candidateById.get(id)!);
  const origin: Point = planning.origin;
  const points: Point[] = [origin, ...selected];
  if (![origin.latitude, origin.longitude, ...selected.flatMap(point => [point.latitude, point.longitude])]
    .every(value => Number.isFinite(Number(value)))) {
    return { error: "route_coordinates_incomplete", status: 409 };
  }
  const coords = points.map(point => Number(point.longitude) + "," + Number(point.latitude)).join(";");
  let matrix: Matrix;
  try {
    matrix = await fetchJson(ROUTING_BASE_URL + "/table/v1/driving/" + coords + "?annotations=duration,distance");
  } catch {
    return { error: "road_matrix_unavailable", status: 502 };
  }
  if (matrix.code !== "Ok" || !matrix.durations || !matrix.distances) return { error: "road_matrix_unavailable", status: 502 };
  let route: number[];
  try {
    route = optimizeStops(matrix.durations);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "route_optimization_failed", status: 422 };
  }
  const orderIds = route.map(index => selected[index - 1].order_id);
  const routePoints = [points[0], ...route.map(index => points[index])];
  const routeCoordinates = routePoints.map(point => Number(point.longitude) + "," + Number(point.latitude)).join(";");
  let routeResult: any;
  try {
    routeResult = await fetchJson(ROUTING_BASE_URL + "/route/v1/driving/" + routeCoordinates + "?overview=full&geometries=geojson&steps=false");
  } catch {
    return { error: "road_geometry_unavailable", status: 502 };
  }
  const line = routeResult.routes?.[0]?.geometry?.coordinates;
  if (routeResult.code !== "Ok" || !Array.isArray(line) || line.length < 2) return { error: "road_geometry_unavailable", status: 502 };
  const maxGeometryPoints = 1800;
  const stride = Math.max(1, Math.ceil(line.length / maxGeometryPoints));
  const simplified = line.filter((_: unknown, index: number) => index === 0 || index === line.length - 1 || index % stride === 0);
  const geometry = { type: "LineString", coordinates: simplified };
  if (JSON.stringify(geometry).length > 190_000) return { error: "route_geometry_too_large", status: 422 };

  // India has a fixed UTC+05:30 offset; the service date/time is treated as local IST.
  const plannedStart = new Date(serviceDate + "T" + startTime + ":00+05:30");
  if (!Number.isFinite(plannedStart.getTime()) || plannedStart.getTime() < Date.now() - 10 * 60_000) {
    return { error: "planned_start_must_be_in_the_future", status: 400 };
  }
  const etaStarts: string[] = [];
  const etaEnds: string[] = [];
  let cursor = plannedStart.getTime();
  let previous = 0;
  let roadSeconds = 0;
  let roadMeters = 0;
  for (const index of route) {
    const travelSeconds = matrix.durations[previous]?.[index];
    const travelMeters = matrix.distances[previous]?.[index];
    if (travelSeconds == null || travelMeters == null || !Number.isFinite(travelSeconds) || !Number.isFinite(travelMeters)) {
      return { error: "unreachable_delivery_stop", status: 422 };
    }
    cursor += travelSeconds * 1000;
    roadSeconds += travelSeconds;
    roadMeters += travelMeters;
    const window = timeWindow(cursor);
    etaStarts.push(window.start);
    etaEnds.push(window.end);
    cursor += 60_000; // initial doorstep handover estimate
    previous = index;
  }
  const plannedDuration = Math.round(roadSeconds + 60 * route.length);
  let routeId: string;
  try {
    routeId = await rpcAsUser(apiKey, token, "delivery_create_route", {
      p_provider_id: providerId,
      p_driver_user_id: driverId,
      p_service_date: serviceDate,
      p_planned_start_at: plannedStart.toISOString(),
      p_order_ids: orderIds,
      p_eta_starts: etaStarts,
      p_eta_ends: etaEnds,
      p_planned_distance_m: Math.round(routeResult.routes?.[0]?.distance ?? roadMeters),
      p_planned_duration_s: plannedDuration,
      p_route_geometry: geometry,
      p_stop_service_seconds: 60,
    });
  } catch {
    return { error: "route_create_failed_check_driver_assignment_and_order_status", status: 409 };
  }
  if (!isUuid(routeId)) return { error: "route_create_failed", status: 502 };
  const orderedStops = route.map((index, position) => {
    const order = selected[index - 1];
    return {
      order_id: order.order_id,
      sequence_no: position + 1,
      recipient_name: order.recipient_name || "Milk customer",
      address_line: order.address_line || "",
      area_name: order.area_name || "",
      city: order.city || "",
      quantity_litres: order.quantity_litres || 0,
      latitude: Number(order.latitude),
      longitude: Number(order.longitude),
      eta_window_start: etaStarts[position],
      eta_window_end: etaEnds[position],
    };
  });
  return {
    status: 201,
    route_id: routeId,
    stop_count: route.length,
    planned_distance_m: Math.round(routeResult.routes?.[0]?.distance ?? roadMeters),
    planned_duration_s: plannedDuration,
    planned_start_at: plannedStart.toISOString(),
    routing_method: "road-duration matrix + nearest-neighbour + bounded 2-opt",
    eta_note: "Road estimates do not include live traffic; ETAs are windows and may change during the run.",
    origin: { latitude: Number(origin.latitude), longitude: Number(origin.longitude) },
    route_geometry: geometry,
    ordered_stops: orderedStops,
  };
}


async function refreshEta(apiKey: string, token: string, routeIdValue: unknown) {
  if (!isUuid(routeIdValue)) return { status: 400, error: "valid_route_id_required" };
  if (!SUPABASE_URL || !ROUTING_BASE_URL) return { status: 503, error: "routing_service_not_configured" };
  try {
    const routeData = await rpcAsUser(apiKey, token, "delivery_get_active_route_eta", {
      p_route_id: routeIdValue,
    });
    if (!routeData?.location || !Array.isArray(routeData.pending_stops)) {
      return { status: 409, error: "route_eta_data_unavailable" };
    }
    const stops = routeData.pending_stops;
    if (stops.length === 0) return { status: 200, route_id: routeIdValue, updated_stops: 0 };
    if (stops.length > MAX_STOPS || stops.some((stop: any) =>
      !isUuid(stop.stop_id) || !Number.isFinite(Number(stop.latitude)) || !Number.isFinite(Number(stop.longitude)))) {
      return { status: 409, error: "invalid_pending_route_stops" };
    }
    const points: Point[] = [
      { latitude: Number(routeData.location.latitude), longitude: Number(routeData.location.longitude) },
      ...stops.map((stop: any) => ({ latitude: Number(stop.latitude), longitude: Number(stop.longitude) })),
    ];
    if (!points.every(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
      && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180)) {
      return { status: 409, error: "invalid_route_coordinates" };
    }
    const coordinates = points.map(point => Number(point.longitude) + "," + Number(point.latitude)).join(";");
    let matrix: Matrix;
    try {
      matrix = await fetchJson(ROUTING_BASE_URL + "/table/v1/driving/" + coordinates + "?annotations=duration");
    } catch {
      return { status: 502, error: "road_matrix_unavailable" };
    }
    if (matrix.code !== "Ok" || !matrix.durations || matrix.durations.length !== points.length) {
      return { status: 502, error: "road_matrix_unavailable" };
    }

    const etaStarts: string[] = [];
    const etaEnds: string[] = [];
    const stopIds: string[] = [];
    const uncertaintyMs = 5 * 60_000;
    const serviceSeconds = Math.min(300, Math.max(15, Number(routeData.stop_service_seconds) || 60));
    let cursor = Date.now();
    let previousIndex = 0;
    for (let index = 1; index < points.length; index++) {
      const seconds = matrix.durations[previousIndex]?.[index];
      if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
        return { status: 422, error: "unreachable_delivery_stop" };
      }
      cursor += seconds * 1000;
      etaStarts.push(new Date(Math.max(Date.now(), cursor - uncertaintyMs)).toISOString());
      etaEnds.push(new Date(cursor + uncertaintyMs).toISOString());
      stopIds.push(stops[index - 1].stop_id);
      cursor += serviceSeconds * 1000;
      previousIndex = index;
    }
    try {
      await rpcAsUser(apiKey, token, "delivery_update_remaining_etas", {
        p_route_id: routeIdValue,
        p_stop_ids: stopIds,
        p_eta_starts: etaStarts,
        p_eta_ends: etaEnds,
      });
    } catch {
      return { status: 409, error: "eta_update_failed_route_changed_or_permission_denied" };
    }
    return {
      status: 200,
      route_id: routeIdValue,
      updated_stops: stopIds.length,
      eta_window_minutes: 5,
      eta_note: "Updated from fresh driver GPS and road travel duration; traffic and doorstep delays can still change arrival.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("fresh_driver_location_required")) return { status: 409, error: "fresh_driver_location_required" };
    if (message.includes("active_driver_route_required")) return { status: 403, error: "active_driver_route_required" };
    if (message.includes("authentication_required")) return { status: 401, error: "authentication_required" };
    return { status: 502, error: "route_eta_refresh_failed" };
  }
}

async function main(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return json({ ok: true }, 200, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "origin_not_allowed" }, 403, null);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
  if (rateLimited(req)) return json({ error: "rate_limited" }, 429, origin);
  if (!SUPABASE_URL || !PUBLISHABLE_KEYS.length) return json({ error: "delivery_service_not_configured" }, 503, origin);

  const authorization = req.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const apiKey = req.headers.get("apikey") || "";
  if (!token || token === authorization || !apiKey || !PUBLISHABLE_KEYS.includes(apiKey)) {
    return json({ error: "authentication_required" }, 401, origin);
  }

  let user: any;
  try {
    user = await fetchJson(SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: apiKey, Authorization: "Bearer " + token },
    });
  } catch {
    return json({ error: "invalid_session" }, 401, origin);
  }
  if (!isUuid(user?.id)) return json({ error: "invalid_session" }, 401, origin);
  const body = await readBody(req);
  if (!body) return json({ error: "invalid_or_oversized_json" }, 400, origin);
  if (body.action === "refresh_eta") {
    const result = await refreshEta(apiKey, token, body.route_id);
    const { status, ...payload } = result;
    return json(payload, Number(status || 200), origin);
  }
  if (body.action !== "plan_route") return json({ error: "unsupported_action" }, 400, origin);

  const result = await planRoute(apiKey, token, body);
  const { status, ...payload } = result;
  return json(payload, Number(status || 400), origin);
}

Deno.serve(main);
