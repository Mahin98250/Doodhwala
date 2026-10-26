(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = {
    user: null, route: null, map: null, roadLayer: null, stopLayers: [],
    driverMarker: null, watchId: null, gpsRequested: false, lastSentAt: 0,
    channel: null, loading: false, lastEtaRefreshAt: 0
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }
  function setStatus(message, kind) {
    $("driverStatus").textContent = message;
    $("driverStatus").className = "driver-status" + (kind ? " " + kind : "");
  }
  function setChip(value) { $("driverStatusChip").textContent = value; }
  function todayInIndia() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return values.year + "-" + values.month + "-" + values.day;
  }
  function formatTime(value) {
    if (!value) return "ETA pending";
    try { return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
    catch (_) { return "ETA pending"; }
  }
  function formatRange(stop) {
    if (!stop.eta_window_start || !stop.eta_window_end) return "Arrival estimate unavailable";
    return formatTime(stop.eta_window_start) + "–" + formatTime(stop.eta_window_end);
  }
  function initMap() {
    if (!window.L || state.map) return;
    state.map = L.map("driverMap", { zoomControl: true }).setView([23.03, 72.54], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.map);
  }
  function clearMap() {
    if (state.roadLayer) state.map.removeLayer(state.roadLayer);
    state.roadLayer = null;
    state.stopLayers.forEach(layer => state.map.removeLayer(layer));
    state.stopLayers = [];
  }
  function numberedIcon(number, done) {
    return L.divIcon({
      className: "",
      html: '<span class="driver-map-stop" style="' + (done ? "background:#8ca294" : "") + '">' + number + "</span>",
      iconSize: [28, 28], iconAnchor: [14, 14]
    });
  }
  function drawRoute() {
    initMap();
    if (!state.map || !state.route) return;
    clearMap();
    const bounds = [];
    const geometry = state.route.route_geometry;
    if (geometry?.type === "LineString" && Array.isArray(geometry.coordinates)) {
      state.roadLayer = L.geoJSON(geometry, {
        style: { color: "#17603f", weight: 5, opacity: 0.83 }
      }).addTo(state.map);
      bounds.push(...geometry.coordinates.map(pair => [pair[1], pair[0]]));
    }
    if (Number.isFinite(Number(state.route.origin_latitude)) && Number.isFinite(Number(state.route.origin_longitude))) {
      const point = [Number(state.route.origin_latitude), Number(state.route.origin_longitude)];
      state.stopLayers.push(L.marker(point, { icon: L.divIcon({ className: "", html: '<span class="driver-map-stop" style="background:#e6bf65;color:#253a2b">D</span>', iconSize: [28,28], iconAnchor:[14,14] }) }).addTo(state.map));
      bounds.push(point);
    }
    (state.route.stops || []).forEach(stop => {
      if (stop.latitude == null || stop.longitude == null) return;
      const point = [Number(stop.latitude), Number(stop.longitude)];
      const done = ["delivered", "skipped"].includes(stop.stop_status);
      state.stopLayers.push(L.marker(point, { icon: numberedIcon(stop.sequence_no, done) })
        .bindTooltip("Stop " + stop.sequence_no + " · " + (stop.recipient_name || "Milk delivery"))
        .addTo(state.map));
      bounds.push(point);
    });
    if (bounds.length) state.map.fitBounds(bounds, { padding: [24,24], maxZoom: 16 });
    setTimeout(() => state.map.invalidateSize(), 60);
  }
  function renderKpis() {
    const route = state.route;
    const stops = route.stops || [];
    const completed = stops.filter(stop => ["delivered", "skipped"].includes(stop.stop_status)).length;
    const remaining = stops.length - completed;
    const start = route.planned_start_at ? formatTime(route.planned_start_at) : "—";
    $("driverKpis").innerHTML =
      '<div class="driver-kpi"><small>Total stops</small><b>' + esc(stops.length) + '</b></div>' +
      '<div class="driver-kpi"><small>Remaining</small><b>' + esc(remaining) + '</b></div>' +
      '<div class="driver-kpi"><small>Planned start</small><b>' + esc(start) + '</b></div>';
    $("remainingStops").textContent = remaining + " stops left";
    $("driverRouteState").textContent = route.status === "active" ? "LIVE ROUTE" : route.status.toUpperCase();
    $("driverRouteSub").textContent = (Number(route.planned_distance_m || 0) / 1000).toFixed(1) +
      " km planned · approx. " + Math.max(1, Math.round(Number(route.planned_duration_s || 0) / 60)) +
      " minutes including handovers. Road traffic may change travel time.";
    $("startDriverRoute").classList.toggle("hidden", route.status !== "planned");
    $("resumeDriverGps").classList.toggle("hidden", route.status !== "active" || Boolean(state.watchId));
    $("stopDriverGps").classList.toggle("hidden", !state.watchId);
  }
  function renderStops() {
    const stops = state.route?.stops || [];
    const firstOpen = stops.find(stop => ["pending", "arrived"].includes(stop.stop_status));
    $("driverStops").innerHTML = stops.map(stop => {
      const done = ["delivered", "skipped"].includes(stop.stop_status);
      const current = firstOpen?.stop_id === stop.stop_id;
      const canAct = state.route.status === "active" && current;
      const addr = [stop.address_line, stop.area_name, stop.city, stop.pin_code].filter(Boolean).join(", ");
      const phone = String(stop.recipient_phone || "").replace(/[^\d+]/g, "");
      let actions = "";
      if (canAct && stop.stop_status === "pending") {
        actions = '<button class="done-action" data-stop-action="arrived" data-stop-id="' + esc(stop.stop_id) + '">I’ve arrived</button>' +
          '<button data-stop-action="skipped" data-stop-id="' + esc(stop.stop_id) + '">Skip stop</button>';
      } else if (canAct && stop.stop_status === "arrived") {
        actions = '<button class="done-action" data-stop-action="delivered" data-stop-id="' + esc(stop.stop_id) + '">Mark delivered</button>' +
          '<button data-stop-action="skipped" data-stop-id="' + esc(stop.stop_id) + '">Skip stop</button>';
      } else if (!done) {
        actions = '<button disabled type="button">' + (state.route.status !== "active" ? "Start route first" : "Finish previous stop first") + '</button>';
      } else {
        actions = '<button disabled type="button">' + (stop.stop_status === "delivered" ? "✓ Delivered" : "Skipped") + '</button>';
      }
      const status = stop.stop_status === "arrived" ? "ARRIVED" : stop.stop_status === "delivered" ? "DELIVERED" : stop.stop_status === "skipped" ? "SKIPPED" : current ? "NEXT STOP" : "UP NEXT";
      return '<article class="driver-stop ' + (current ? "current " : "") + (done ? "done" : "") + '">' +
        '<div class="driver-stop-number">' + esc(stop.sequence_no) + '</div><div class="driver-stop-content">' +
        '<div class="driver-stop-top"><b>' + esc(stop.recipient_name || "Milk customer") + '</b><span>' + esc(status) + '</span></div>' +
        '<div class="driver-stop-address">' + esc(addr || "Delivery address is not available") + '</div>' +
        (stop.skip_reason ? '<div class="driver-stop-address">Skip reason: ' + esc(stop.skip_reason) + '</div>' : '') +
        '<div class="driver-stop-meta"><span>ETA · ' + esc(formatRange(stop)) + '</span><span>' + esc(stop.quantity_litres || 0) + ' L milk</span></div>' +
        '<div class="driver-stop-actions">' + (phone ? '<a href="tel:' + esc(phone) + '">Call customer</a>' : '') + actions + '</div>' +
        '</div></article>';
    }).join("");
    $("driverStops").querySelectorAll("[data-stop-action]").forEach(button => {
      button.addEventListener("click", () => actOnStop(button));
    });
  }
  function renderRoute() {
    const route = state.route;
    if (!route) return;
    $("driverRouteTitle").textContent = route.service_date === todayInIndia() ? "Today's delivery route" : "Delivery route · " + route.service_date;
    renderKpis();
    renderStops();
    drawRoute();
    if (route.status === "active") {
      setChip(state.watchId ? "GPS LIVE" : "ROUTE ACTIVE");
      if (!state.watchId) setGpsStatus("Route is active, but GPS is not sharing. Tap Resume live location to restart sharing.", false);
    } else if (route.status === "planned") {
      setChip("ROUTE PLANNED");
      setGpsStatus("GPS is off. Start the route when you are ready to deliver.", false);
    } else {
      setChip("ROUTE COMPLETED");
      setGpsStatus("This route is complete. Location sharing has stopped and the last live marker was cleared.", false);
    }
  }
  function setGpsStatus(message, live) {
    $("gpsStatus").textContent = message;
    $("gpsStatus").className = "driver-gps-status" + (live ? " live" : "");
  }
  async function loadRoute() {
    if (state.loading || !state.user) return;
    state.loading = true;
    try {
      const [{ data: enrollment, error: enrollmentError }, { data, error }] = await Promise.all([
        Doodhwala.supabase.rpc("delivery_driver_is_enrolled"),
        Doodhwala.supabase.rpc("delivery_get_my_active_route")
      ]);
      if (enrollmentError) throw enrollmentError;
      if (error) throw error;
      $("driverEnrollCard").classList.toggle("hidden", Boolean(enrollment));
      const route = data?.route || null;
      if (!route) {
        stopGps(false);
        unsubscribeRoute();
        state.route = null;
        $("driverRoutePanel").classList.add("hidden");
        $("noDriverRoute").classList.toggle("hidden", !enrollment);
        if (enrollment) {
          setStatus("Driver account is enabled. No route is assigned for today yet.", "success");
          setChip("WAITING FOR ROUTE");
        } else {
          setStatus("Enable delivery mode to let a provider link you to a morning route.");
          setChip("NOT ENROLLED");
        }
        return;
      }
      state.route = route;
      if (route.status !== "active" && state.watchId !== null) stopGps(false);
      $("noDriverRoute").classList.add("hidden");
      $("driverRoutePanel").classList.remove("hidden");
      renderRoute();
      subscribeRoute(route.id);
      setStatus("Route loaded securely. Follow the stop order; location sharing only starts after you request it.", "success");
    } finally {
      state.loading = false;
    }
  }
  async function refreshRouteEtas(routeId) {
    const { data, error } = await Doodhwala.supabase.functions.invoke("delivery-routing", {
      body: { action: "refresh_eta", route_id: routeId }
    });
    if (error || data?.error) {
      throw new Error(data?.error || error?.message || "ETA refresh unavailable");
    }
    return data;
  }
  async function actOnStop(button) {
    const action = button.dataset.stopAction;
    let reason = null;
    if (action === "skipped") {
      reason = (prompt("Reason for skipping this doorstep?") || "").trim().slice(0,300);
      if (reason.length < 3) return;
    }
    button.disabled = true;
    try {
      const { error } = await Doodhwala.supabase.rpc("delivery_mark_route_stop_action", {
        p_stop_id: button.dataset.stopId,
        p_action: action,
        p_reason: reason
      });
      if (error) throw error;
      await loadRoute();
      if (state.route?.status === "active") {
        try { await refreshRouteEtas(state.route.id); } catch (etaError) {
          console.warn("Immediate ETA refresh deferred:", etaError);
        }
      }
      setStatus(action === "delivered" ? "Delivery marked complete." : action === "arrived" ? "Arrival recorded. Confirm delivery after handing over the milk." : "Stop skipped with a reason; continue to the next stop.", "success");
    } catch (error) {
      setStatus(error?.message || "Could not update this stop. Refresh and try again.", "error");
      button.disabled = false;
    }
  }
  async function startRoute() {
    if (!state.route) return;
    $("startDriverRoute").disabled = true;
    try {
      const { error } = await Doodhwala.supabase.rpc("delivery_start_route", { p_route_id: state.route.id });
      if (error) throw error;
      await loadRoute();
      startGps();
    } catch (error) {
      setStatus(error?.message || "Could not start this route. Check that each order is ready.", "error");
    } finally {
      $("startDriverRoute").disabled = false;
    }
  }
  function stopGps(clearRemote = true) {
    if (state.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(state.watchId);
    }
    state.watchId = null;
    state.gpsRequested = false;
    $("resumeDriverGps").classList.toggle("hidden", state.route?.status !== "active");
    $("stopDriverGps").classList.add("hidden");
    if (clearRemote && state.route?.id && state.route?.status === "active" && window.Doodhwala?.configured) {
      Doodhwala.supabase.rpc("delivery_stop_location_sharing", { p_route_id: state.route.id })
        .then(({ error }) => { if (error) console.warn("Could not clear last location:", error.message); })
        .catch(err => console.warn("Could not clear last location:", err));
    }
    setGpsStatus("GPS sharing is off.", false);
    if (state.route?.status === "active") setChip("ROUTE ACTIVE");
  }
  function startGps() {
    if (!state.route || state.route.status !== "active") {
      setStatus("Start the route before sharing GPS.", "error");
      return;
    }
    if (!navigator.geolocation) {
      setGpsStatus("This browser does not support GPS. Use a secure HTTPS browser on the delivery phone.", false);
      return;
    }
    if (state.watchId !== null) return;
    state.gpsRequested = true;
    state.lastSentAt = 0;
    state.watchId = navigator.geolocation.watchPosition(async position => {
      if (!state.route || state.route.status !== "active" || !state.gpsRequested) return;
      const coords = position.coords;
      const now = Date.now();
      if (now - state.lastSentAt < 4500) return;
      state.lastSentAt = now;
      const point = [coords.latitude, coords.longitude];
      updateDriverMarker(point);
      setGpsStatus("Sharing your live position · accuracy about " + Math.round(coords.accuracy || 0) + " m · updated now.", true);
      setChip("GPS LIVE");
      try {
        const { error } = await Doodhwala.supabase.rpc("delivery_update_location", {
          p_route_id: state.route.id,
          p_latitude: coords.latitude,
          p_longitude: coords.longitude,
          p_accuracy_m: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
          p_heading_deg: Number.isFinite(coords.heading) ? coords.heading : null,
          p_speed_mps: Number.isFinite(coords.speed) ? coords.speed : null
        });
        if (error) throw error;
        if (now - state.lastEtaRefreshAt >= 60_000) {
          state.lastEtaRefreshAt = now;
          refreshRouteEtas(state.route.id).then(data => {
            if (Number(data?.updated_stops || 0) > 0) {
              setGpsStatus("Live GPS active · refreshed arrival windows for " + data.updated_stops + " remaining stops.", true);
            }
          }).catch(error => {
            setGpsStatus("GPS is live. ETA refresh is waiting: " + (error?.message || "routing service unavailable") + ".", true);
          });
        }
      } catch (error) {
        setGpsStatus("GPS was read, but the secure update failed: " + (error?.message || "retrying"), false);
      }
    }, error => {
      setGpsStatus("GPS unavailable: " + error.message + ". Check phone location permission and keep the page open.", false);
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    $("resumeDriverGps").classList.add("hidden");
    $("stopDriverGps").classList.remove("hidden");
    setGpsStatus("Waiting for a GPS fix… allow location access when your browser asks.", false);
  }
  function updateDriverMarker(point) {
    if (!state.map) initMap();
    if (!state.map) return;
    if (!state.driverMarker) {
      state.driverMarker = L.marker(point, {
        icon: L.divIcon({ className: "", html: '<span class="driver-map-driver"><span>➤</span></span>', iconSize: [33,33], iconAnchor: [16,16] })
      }).addTo(state.map);
    } else state.driverMarker.setLatLng(point);
  }
  function subscribeRoute(routeId) {
    if (!routeId || !window.Doodhwala?.configured) return;
    unsubscribeRoute();
    const channel = Doodhwala.supabase.channel("delivery-route:" + routeId, { config: { private: true } })
      .on("broadcast", { event: "eta_updated" }, () => {
        loadRoute().catch(error => console.warn("Driver ETA refresh event could not be loaded:", error));
      })
      .on("broadcast", { event: "location_stopped" }, () => {
        // The driver already stopped sharing; customers are also told to clear their marker.
      });
    state.channel = channel;
    channel.subscribe(status => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.info("Private delivery-route channel is temporarily unavailable:", status);
      }
    });
  }
  function unsubscribeRoute() {
    if (!state.channel) return;
    try { Doodhwala.supabase.removeChannel(state.channel); } catch (_) {}
    state.channel = null;
  }
  async function bootstrap() {
    initMap();
    if (!window.Doodhwala?.configured) {
      setStatus("Supabase is not configured on this build.", "error");
      setChip("NOT CONNECTED");
      return;
    }
    const { data, error } = await Doodhwala.supabase.auth.getUser();
    if (error || !data?.user) {
      setStatus("Sign in with the delivery-person account first.", "error");
      setChip("SIGN IN REQUIRED");
      $("driverEnrollCard").classList.remove("hidden");
      $("enrollDriver").disabled = true;
      $("enrollDriver").textContent = "Sign in to enable delivery mode";
      return;
    }
    state.user = data.user;
    $("enrollDriver").addEventListener("click", async () => {
      $("enrollDriver").disabled = true;
      try {
        const { error } = await Doodhwala.supabase.rpc("delivery_driver_enroll");
        if (error) throw error;
        setStatus("Delivery mode enabled. Your provider can now link your driver account.", "success");
        await loadRoute();
      } catch (error) {
        setStatus(error?.message || "Could not enable delivery mode.", "error");
      } finally {
        $("enrollDriver").disabled = false;
      }
    });
    $("refreshDriverRoute").addEventListener("click", () => loadRoute().catch(error => setStatus(error?.message || "Route refresh failed.", "error")));
    $("startDriverRoute").addEventListener("click", startRoute);
    $("resumeDriverGps").addEventListener("click", startGps);
    $("stopDriverGps").addEventListener("click", () => stopGps(true));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && state.watchId !== null) {
        stopGps(true);
        setGpsStatus("Sharing paused because this page was hidden. Resume location when you return.", false);
      }
    });
    window.addEventListener("pagehide", () => stopGps(true));
    await loadRoute();
  }
  window.addEventListener("DOMContentLoaded", () => bootstrap().catch(error => {
    setStatus(error?.message || "Driver page could not be loaded.", "error");
    setChip("CONNECTION ISSUE");
  }));
})();
