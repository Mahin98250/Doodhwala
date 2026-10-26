(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = { user: null, providerId: null, drivers: [], orders: [], map: null, routeLayer: null, stopLayers: [] };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }
  function setStatus(message, kind) {
    const node = $("dispatchStatus");
    node.textContent = message;
    node.className = "dd-status" + (kind ? " " + kind : "");
  }
  function localDate(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date || new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return values.year + "-" + values.month + "-" + values.day;
  }
  function addDays(dateText, days) {
    const date = new Date(dateText + "T12:00:00+05:30");
    date.setUTCDate(date.getUTCDate() + days);
    return localDate(date);
  }
  function setDateDefaults() {
    const date = localDate(new Date());
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).format(new Date()).split(":").map(Number);
    $("serviceDate").value = parts[0] > 5 || (parts[0] === 5 && parts[1] >= 10) ? addDays(date, 1) : date;
    $("serviceDate").min = date;
    $("startTime").value = "05:00";
  }
  function initMap() {
    if (!window.L || state.map) return;
    state.map = L.map("routeMap", { zoomControl: true, scrollWheelZoom: false }).setView([23.03, 72.54], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.map);
  }
  function clearMap() {
    if (state.routeLayer) state.map.removeLayer(state.routeLayer);
    state.routeLayer = null;
    state.stopLayers.forEach(layer => state.map.removeLayer(layer));
    state.stopLayers = [];
  }
  function markerIcon(label, origin) {
    return L.divIcon({
      className: "",
      html: '<span class="' + (origin ? "dd-origin-marker" : "dd-map-marker") + '">' + label + "</span>",
      iconSize: [27, 27],
      iconAnchor: [13, 13]
    });
  }
  function renderRouteMap(origin, geometry, stops) {
    initMap();
    if (!state.map) return;
    clearMap();
    const bounds = [];
    if (geometry?.type === "LineString" && Array.isArray(geometry.coordinates)) {
      state.routeLayer = L.geoJSON(geometry, { style: { color: "#17603f", weight: 5, opacity: 0.8 } }).addTo(state.map);
      bounds.push(...geometry.coordinates.map(pair => [pair[1], pair[0]]));
    }
    if (origin && Number.isFinite(Number(origin.latitude)) && Number.isFinite(Number(origin.longitude))) {
      const point = [Number(origin.latitude), Number(origin.longitude)];
      state.stopLayers.push(L.marker(point, { icon: markerIcon("D", true) }).bindTooltip("Dairy / route start").addTo(state.map));
      bounds.push(point);
    }
    stops.forEach(stop => {
      if (!Number.isFinite(Number(stop.latitude)) || !Number.isFinite(Number(stop.longitude))) return;
      const point = [Number(stop.latitude), Number(stop.longitude)];
      state.stopLayers.push(L.marker(point, { icon: markerIcon(stop.sequence_no, false) })
        .bindTooltip("Stop " + stop.sequence_no + " · " + (stop.recipient_name || "Milk delivery"))
        .addTo(state.map));
      bounds.push(point);
    });
    if (bounds.length) state.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
    setTimeout(() => state.map.invalidateSize(), 50);
  }
  function formatTime(value) {
    if (!value) return "ETA pending";
    try {
      return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit"
      }).format(new Date(value));
    } catch (_) { return "ETA pending"; }
  }
  function renderPreview(data, origin) {
    const stops = data.ordered_stops || [];
    const km = (Number(data.planned_distance_m || 0) / 1000).toFixed(1);
    const mins = Math.max(1, Math.round(Number(data.planned_duration_s || 0) / 60));
    $("routePreview").innerHTML =
      '<div class="dd-route-stats">' +
        '<div class="dd-route-stat"><small>Optimized distance</small><b>' + esc(km) + ' km</b></div>' +
        '<div class="dd-route-stat"><small>Est. route time</small><b>' + esc(mins) + ' min</b></div>' +
        '<div class="dd-route-stat"><small>Households</small><b>' + esc(stops.length) + '</b></div>' +
      '</div><div class="dd-stop-preview">' + stops.map(stop =>
        '<div class="dd-stop-line"><span class="dd-stop-number">' + esc(stop.sequence_no) + '</span>' +
        '<div class="dd-stop-copy"><b>' + esc(stop.recipient_name || "Milk customer") + ' · ' +
          esc(formatTime(stop.eta_window_start)) + '–' + esc(formatTime(stop.eta_window_end)) + '</b>' +
        '<small>' + esc([stop.address_line, stop.area_name].filter(Boolean).join(", ")) +
          (stop.quantity_litres ? ' · ' + esc(stop.quantity_litres) + ' L' : '') + '</small></div></div>'
      ).join("") + '</div><p class="dd-footnote">Road-duration estimate; live traffic and doorstep delays can change arrival windows.</p>';
    renderRouteMap(origin, data.route_geometry, stops);
  }
  function renderDrivers() {
    const linked = state.drivers.filter(driver => driver.linked);
    const select = $("driverSelect");
    select.innerHTML = linked.length
      ? '<option value="">Choose a linked driver</option>' + linked.map(driver =>
          '<option value="' + esc(driver.driver_user_id) + '">' + esc(driver.display_name) + '</option>').join("")
      : '<option value="">Link an enrolled driver first</option>';
    select.disabled = !linked.length;
    $("driverEmpty").classList.toggle("hidden", state.drivers.length > 0);
    $("driverRows").innerHTML = state.drivers.map(driver =>
      '<div class="dd-driver-row"><div class="dd-driver-ident"><b>' + esc(driver.display_name) + '</b>' +
      '<small>Driver ID · ' + esc(driver.driver_user_id) + '</small></div>' +
      (driver.linked
        ? '<button class="dd-link-button" type="button" disabled>✓ Linked</button>'
        : '<button class="dd-link-button" data-link-driver="' + esc(driver.driver_user_id) + '" type="button">Link driver</button>') +
      '</div>'
    ).join("");
    $("driverRows").querySelectorAll("[data-link-driver]").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const { error } = await Doodhwala.supabase.rpc("delivery_provider_link_driver", {
            p_provider_id: state.providerId,
            p_driver_user_id: button.dataset.linkDriver
          });
          if (error) throw error;
          setStatus("Driver linked securely. They can now receive a planned route.", "success");
          await loadDrivers();
        } catch (error) {
          setStatus(error?.message || "Could not link this driver. Ask them to opt in first.", "error");
          button.disabled = false;
        }
      });
    });
    updateControls();
  }
  function renderOrders() {
    const queue = $("orderQueue");
    if (!state.orders.length) {
      queue.innerHTML = '<div class="dd-empty">No eligible deliveries found. Orders need delivery coordinates and must be ready for delivery (or awaiting a new route after a skip).</div>';
    } else {
      queue.innerHTML = state.orders.map(order =>
        '<label class="dd-order-row"><input type="checkbox" data-order-id="' + esc(order.order_id) + '" checked>' +
        '<span class="dd-order-main"><b>' + esc(order.recipient_name || "Milk customer") + '</b>' +
        '<small>' + esc([order.address_line, order.area_name, order.city].filter(Boolean).join(", ")) + '</small>' +
        '<small>' + esc(order.order_status || "ready") + ' · ID ' + esc(order.order_id.slice(0, 8)) + '</small></span>' +
        '<span class="dd-order-meta">' + esc(order.quantity_litres || 0) + ' L</span></label>'
      ).join("");
    }
    $("orderCount").textContent = state.orders.length + " available";
    $("selectAllOrders").checked = state.orders.length > 0;
    queue.querySelectorAll("[data-order-id]").forEach(input => input.addEventListener("change", updateControls));
    updateControls();
  }
  function selectedOrderIds() {
    return Array.from($("orderQueue").querySelectorAll("[data-order-id]:checked")).map(input => input.dataset.orderId);
  }
  function updateControls() {
    const linkedDriver = Boolean($("driverSelect").value);
    const selected = selectedOrderIds();
    $("planRoute").disabled = !state.providerId || !linkedDriver || selected.length < 1 || selected.length > 99;
    $("selectAllOrders").disabled = !state.orders.length;
    const selectedText = selected.length + " selected";
    if (state.orders.length) $("orderCount").textContent = selectedText + " · " + state.orders.length + " available";
  }
  async function loadDrivers() {
    const { data, error } = await Doodhwala.supabase.rpc("delivery_list_enrolled_drivers", { p_provider_id: state.providerId });
    if (error) throw error;
    state.drivers = Array.isArray(data) ? data : [];
    renderDrivers();
  }
  async function loadQueue() {
    $("orderQueue").innerHTML = '<div class="dd-loading"><span class="dd-spinner"></span> Refreshing route-eligible orders…</div>';
    const { data, error } = await Doodhwala.supabase.rpc("delivery_get_route_planning_data", {
      p_provider_id: state.providerId, p_limit: 99
    });
    if (error) throw error;
    state.orders = Array.isArray(data?.orders) ? data.orders : [];
    state.origin = data?.origin || null;
    renderOrders();
    if (!state.orders.length) {
      $("routePreview").innerHTML = '<div class="dd-preview-placeholder"><span>✓</span><b>No stops ready yet</b><small>Delivery orders appear when they have a saved pin and are ready for the route.</small></div>';
    }
    if (state.origin) renderRouteMap(state.origin, null, []);
  }
  async function bootstrap() {
    setDateDefaults();
    initMap();
    if (!window.Doodhwala?.configured) {
      setStatus("Supabase is not configured on this build. Tracking pages will remain read-only until the backend is connected.", "error");
      return;
    }
    const { data: userResult, error: authError } = await Doodhwala.supabase.auth.getUser();
    if (authError || !userResult?.user) {
      setStatus("Please sign in as the provider owner to plan routes. Sign in, then reopen Smart Dispatch.", "error");
      $("driverSelect").disabled = true;
      $("planRoute").disabled = true;
      return;
    }
    state.user = userResult.user;
    const { data: dashboard, error } = await Doodhwala.supabase.rpc("provider_get_dashboard");
    if (error || !dashboard?.provider?.id) {
      setStatus("This account does not have a connected provider profile yet, or the provider dashboard RPC is unavailable.", "error");
      return;
    }
    state.providerId = dashboard.provider.id;
    $("driverSelect").addEventListener("change", updateControls);
    $("refreshQueue").addEventListener("click", () => loadQueue().catch(err => setStatus(err?.message || "Could not refresh orders.", "error")));
    $("selectAllOrders").addEventListener("change", event => {
      $("orderQueue").querySelectorAll("[data-order-id]").forEach(input => { input.checked = event.target.checked; });
      updateControls();
    });
    $("planRoute").addEventListener("click", createRoute);
    try {
      await Promise.all([loadDrivers(), loadQueue()]);
      setStatus("Provider connected. Link an opted-in driver, choose a delivery window and optimize the selected route.", "success");
    } catch (err) {
      setStatus(err?.message || "Could not load delivery operations. Confirm the routing migration is applied in the selected environment.", "error");
    }
  }
  async function createRoute() {
    const driverId = $("driverSelect").value;
    const orderIds = selectedOrderIds();
    if (!driverId || !orderIds.length) return;
    if (orderIds.length > 99) {
      setStatus("Each route currently supports up to 99 stops. Split larger rounds between multiple routes/drivers.", "error");
      return;
    }
    $("planRoute").disabled = true;
    $("planRoute").textContent = "Optimizing road route…";
    setStatus("Calculating road travel times, improving stop order, and saving ETA windows…");
    try {
      const { data, error } = await Doodhwala.supabase.functions.invoke("delivery-routing", {
        body: {
          action: "plan_route",
          provider_id: state.providerId,
          driver_user_id: driverId,
          order_ids: orderIds,
          service_date: $("serviceDate").value,
          start_time: $("startTime").value
        }
      });
      if (error) throw error;
      if (!data?.route_id || !Array.isArray(data.ordered_stops)) throw new Error(data?.error || "Route was not created. Check the routing endpoint configuration.");
      renderPreview(data, state.origin);
      setStatus("Route saved: " + data.stop_count + " stops, " + (Number(data.planned_distance_m || 0) / 1000).toFixed(1) + " km. The assigned driver can open Driver view.", "success");
    } catch (error) {
      const message = error?.context?.body?.error || error?.message || "Route planning failed.";
      setStatus("Could not optimize this route: " + message + ". Check the routing endpoint and route migration before retrying.", "error");
    } finally {
      $("planRoute").textContent = "Optimize morning route →";
      updateControls();
    }
  }
  window.addEventListener("DOMContentLoaded", bootstrap);
})();
