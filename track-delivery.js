(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order") || "";
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const state = { user: null, tracking: null, map: null, destination: null, driverMarker: null, homeMarker: null, roadLayer: null, channel: null, statusChannel: null };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }
  function setStatus(message, kind) {
    $("trackingStatus").textContent = message;
    $("trackingStatus").className = "tracking-status" + (kind ? " " + kind : "");
  }
  function formatTime(value) {
    if (!value) return "";
    try { return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
    catch (_) { return ""; }
  }
  function formatDateTime(value) {
    if (!value) return "Not updated";
    try { return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
    catch (_) { return "Not updated"; }
  }
  function statusText(status) {
    return ({
      placed: "Order placed", accepted: "Order accepted", preparing: "Preparing your milk",
      ready: "Ready for delivery", out_for_delivery: "Out for delivery", delivered: "Delivered",
      rejected: "Order declined", cancelled: "Order cancelled"
    })[status] || "Delivery status";
  }
  function initMap() {
    if (!window.L || state.map) return;
    state.map = L.map("trackingMap", { zoomControl: true }).setView([23.03, 72.54], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.map);
  }
  function markerIcon(driver) {
    return L.divIcon({
      className: "",
      html: driver ? '<span class="tracking-driver-marker"><span>➤</span></span>' : '<span class="tracking-home-marker">⌂</span>',
      iconSize: driver ? [35,35] : [29,29],
      iconAnchor: driver ? [17,17] : [14,14]
    });
  }
  function showDestination(destination) {
    initMap();
    if (!state.map || !destination || destination.latitude == null || destination.longitude == null) return;
    const point = [Number(destination.latitude), Number(destination.longitude)];
    if (!point.every(Number.isFinite)) return;
    state.destination = point;
    if (!state.homeMarker) {
      state.homeMarker = L.marker(point, { icon: markerIcon(false), interactive: false }).addTo(state.map);
    } else state.homeMarker.setLatLng(point);
    state.map.setView(point, 15);
    setTimeout(() => state.map.invalidateSize(), 70);
  }
  function showDriver(location) {
    if (!state.map || !state.tracking?.route_id || !location) return;
    const point = [Number(location.latitude), Number(location.longitude)];
    if (!point.every(Number.isFinite)) return;
    if (!state.driverMarker) {
      state.driverMarker = L.marker(point, { icon: markerIcon(true), interactive: false }).addTo(state.map);
    } else state.driverMarker.setLatLng(point);
    if (state.destination) {
      const driverPoint = L.latLng(point);
      const destinationPoint = L.latLng(state.destination);
      const bounds = L.latLngBounds(driverPoint, destinationPoint);
      state.map.fitBounds(bounds, { padding: [28,28], maxZoom: 16 });
    } else state.map.setView(point, 15);
    $("trackingLivePill").textContent = "LIVE LOCATION";
    $("trackingLivePill").classList.add("live");
    $("trackingLocationState").textContent = "Driver location updated " + formatDateTime(location.updated_at) +
      (location.accuracy_m ? " · accuracy about " + Math.round(location.accuracy_m) + " m" : "") + ".";
    $("trackingLocationState").classList.add("live");
  }
  function clearDriver(message) {
    if (state.driverMarker && state.map) {
      state.map.removeLayer(state.driverMarker);
      state.driverMarker = null;
    }
    $("trackingLivePill").textContent = "WAITING";
    $("trackingLivePill").classList.remove("live");
    $("trackingLocationState").textContent = message || "Live location is paused or the driver's latest fix is stale. The ETA window remains an estimate.";
    $("trackingLocationState").classList.remove("live");
  }
  function renderTimeline(tracking) {
    const routeReady = tracking.available && ["planned","active","completed"].includes(tracking.route_status);
    const skipped = tracking.stop_status === "skipped";
    const delivered = tracking.order_status === "delivered" || tracking.stop_status === "delivered";
    const steps = [
      { label: "Order placed", active: true, done: true },
      { label: "Preparing your milk", active: ["preparing","ready","out_for_delivery","delivered"].includes(tracking.order_status), done: ["ready","out_for_delivery","delivered"].includes(tracking.order_status) },
      { label: routeReady ? "Driver route assigned" : "Waiting for driver route", active: routeReady, done: tracking.route_status === "active" || tracking.route_status === "completed" },
      { label: "Out for delivery", active: tracking.route_status === "active" || tracking.order_status === "out_for_delivery", done: tracking.route_status === "active" || tracking.order_status === "delivered" },
      { label: skipped ? "Delivery attempt skipped" : "Delivered to your doorstep", active: delivered || skipped, done: delivered || skipped },
      ...(skipped ? [{ label: "Contact your provider to reschedule", active: true, done: false }] : [])
    ];
    $("trackingTimeline").innerHTML = steps.map((step, index) =>
      '<div class="tracking-step ' + (step.active ? "active " : "") + (step.done ? "done" : "") + '">' +
      '<span class="tracking-step-icon">' + (step.done ? "✓" : index + 1) + '</span><div><b>' + esc(step.label) + '</b>' +
      '<small>' + (step.active ? (step.done ? "Completed" : "In progress") : "Upcoming") + '</small></div></div>'
    ).join("");
  }
  function render(tracking) {
    state.tracking = tracking;
    $("trackingContent").classList.remove("hidden");
    $("trackingMapTitle").textContent = tracking.stop_status === "skipped" ? "Delivery attempt skipped" :
      (tracking.order_status === "delivered" || tracking.stop_status === "delivered" ? "Delivery completed" : statusText(tracking.order_status));
    $("trackingOrderSummary").innerHTML =
      '<div class="tracking-summary-row"><span>Order</span><b>' + esc(tracking.order_id.slice(0,8).toUpperCase()) + '</b></div>' +
      '<div class="tracking-summary-row"><span>Status</span><b>' + esc(tracking.stop_status === "skipped" ? "Delivery attempt skipped" : statusText(tracking.order_status)) + '</b></div>' +
      '<div class="tracking-summary-row"><span>Your address</span><b>' + esc([tracking.destination?.address_line,tracking.destination?.area_name,tracking.destination?.city].filter(Boolean).join(", ") || "Saved delivery address") + '</b></div>';
    if (tracking.stop_status === "skipped") {
      $("trackingEta").textContent = "Delivery needs rescheduling";
      $("trackingEtaNote").textContent = "The route stop was skipped" + (tracking.skip_reason ? ": " + tracking.skip_reason : ". Contact your provider to arrange a new delivery.");
    } else if (tracking.available && tracking.eta_window_start && tracking.eta_window_end && tracking.order_status !== "delivered") {
      $("trackingEta").textContent = formatTime(tracking.eta_window_start) + "–" + formatTime(tracking.eta_window_end);
      $("trackingEtaNote").textContent = "Road-time estimate; traffic and doorstep delays may change this window.";
    } else if (tracking.order_status === "delivered" || tracking.stop_status === "delivered") {
      $("trackingEta").textContent = "Delivered ✓";
      $("trackingEtaNote").textContent = "Your milk delivery has been marked complete.";
    } else {
      $("trackingEta").textContent = "Arrival time pending";
      $("trackingEtaNote").textContent = "Your provider has not assigned this order to a route yet. This page will show the ETA when the route is planned.";
    }
    $("trackingStopBadge").textContent = tracking.stop_status === "skipped"
      ? "Your stop · #" + tracking.stop_number + " · skipped; reschedule needed"
      : tracking.available
        ? "Your stop · #" + tracking.stop_number + (tracking.route_status === "planned" ? " · route planned" : tracking.route_status === "active" ? " · driver on route" : " · route complete")
        : "Stop number pending";
    renderTimeline(tracking);
    showDestination(tracking.destination);
    if (tracking.location && !tracking.location_stale) showDriver(tracking.location);
    else clearDriver(tracking.stop_status === "skipped"
      ? "Live driver location is hidden for a skipped delivery. Contact your provider to arrange a new drop."
      : (tracking.stop_status === "delivered" || tracking.order_status === "delivered")
        ? "Your delivery is complete; live driver location is now hidden."
        : tracking.route_status === "completed"
          ? "This delivery route is complete; live location sharing has stopped."
          : "Live location appears after the driver starts the route and shares a fresh GPS fix.");
    if (!tracking.available) setStatus(tracking.message || "Your order has not been added to a driver route yet.", "success");
    else setStatus("Tracking is limited to this order and its assigned route. Your stop number and arrival window update when dispatch changes.", "success");
  }
  async function loadTracking() {
    const { data, error } = await Doodhwala.supabase.rpc("delivery_get_my_tracking", { p_order_id: orderId });
    if (error) throw error;
    if (!data || typeof data !== "object") throw new Error("Tracking information is not available yet.");
    render(data);
    if (data.available && data.route_id) subscribeRoute(data.route_id, data.route_status);
  }
  function subscribeRoute(routeId, routeStatus) {
    if (!routeId || !window.Doodhwala?.configured) return;
    if (state.channel && state.tracking?.route_id === routeId) return;
    unsubscribeRoute();
    const channel = Doodhwala.supabase.channel("delivery-route:" + routeId, { config: { private: true } })
      .on("broadcast", { event: "eta_updated" }, () => {
        loadTracking().catch(err => console.warn("Delivery ETA refresh failed:", err));
      })
      .on("broadcast", { event: "location" }, packet => {
        const location = packet?.payload || packet;
        if (!location || location.route_id !== routeId || state.tracking?.route_status !== "active"
          || !["pending", "arrived"].includes(state.tracking?.stop_status)) return;
        showDriver(location);
      })
      .on("broadcast", { event: "location_stopped" }, packet => {
        const event = packet?.payload || packet;
        if (event?.route_id === routeId) clearDriver("Driver live-location sharing is paused. The last marker has been cleared.");
      })
      .on("broadcast", { event: "stop_updated" }, packet => {
        const event = packet?.payload || packet;
        if (event?.route_id === routeId && event?.order_id === orderId) {
          loadTracking().catch(err => console.warn("Delivery stop update could not be loaded:", err));
        }
      })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "order_status_events", filter: "order_id=eq." + orderId
      }, () => { loadTracking().catch(err => console.warn("Tracking refresh failed", err)); });
    state.channel = channel;
    channel.subscribe(status => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setStatus("Live updates are reconnecting. Refresh the page for the latest status.", "error");
      }
    });
  }
  function unsubscribeRoute() {
    if (!state.channel) return;
    try { Doodhwala.supabase.removeChannel(state.channel); } catch (_) {}
    state.channel = null;
  }
  async function bootstrap() {
    if (!UUID_RE.test(orderId)) {
      setStatus("Open Track live from one of your own orders to see delivery details.", "error");
      return;
    }
    if (!window.Doodhwala?.configured) {
      setStatus("The delivery tracking backend is not connected in this build.", "error");
      return;
    }
    const { data: auth, error } = await Doodhwala.supabase.auth.getUser();
    if (error || !auth?.user) {
      setStatus("Please sign in to view live delivery tracking.", "error");
      return;
    }
    state.user = auth.user;
    initMap();
    await loadTracking();
  }
  window.addEventListener("DOMContentLoaded", () => bootstrap().catch(error => {
    setStatus(error?.message || "Could not load this delivery. Retry from My orders.", "error");
  }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.user) loadTracking().catch(() => {});
  });
  window.addEventListener("pagehide", unsubscribeRoute);
})();
