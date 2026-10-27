(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const PAGE_SIZE = 30;
  const state = { user: null, items: [], unreadCount: 0, oldest: null, oldestId: null, hasMore: false, busy: false };
  const client = () => window.Doodhwala?.supabase;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }
  function setError(message) {
    $("notificationsError").textContent = String(message || "Something went wrong. Please try again.");
    $("notificationsError").hidden = false;
  }
  function clearError() {
    $("notificationsError").textContent = "";
    $("notificationsError").hidden = true;
  }
  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function status(message) { $("notificationsStatus").textContent = message || ""; }
  function render() {
    $("notificationsUnreadCount").textContent = state.unreadCount + (state.unreadCount === 1 ? " unread" : " unread");
    $("notificationsMarkAll").disabled = state.unreadCount === 0 || state.busy;
    $("notificationsLoadMore").hidden = !state.hasMore;
    const list = $("notificationsList");
    if (!state.items.length) {
      list.innerHTML = '<section class="notifications-panel"><div class="notifications-empty-icon">✓</div><h2>You are all caught up</h2><p>New order updates will appear here when a status changes.</p></section>';
      return;
    }
    list.innerHTML = state.items.map(item => {
      const unread = !item.read_at;
      return '<article class="notification-card '+(unread ? "unread" : "")+'" data-notification-card="'+esc(item.id)+'">'+
        '<div class="notification-icon" aria-hidden="true">'+(unread ? "●" : "✓")+'</div>'+
        '<div class="notification-copy"><h2>'+(unread?'<span class="notification-unread-dot" aria-label="Unread"></span>':"")+esc(item.title)+'</h2>'+
        '<p>'+esc(item.body)+'</p><time datetime="'+esc(item.created_at)+'">'+esc(formatDate(item.created_at))+'</time></div>'+
        '<div class="notification-actions">'+(unread?'<button type="button" data-notification-read="'+esc(item.id)+'">Mark read</button>':"")+
        '<a href="/Doodhwala/orders.html">View orders</a></div></article>';
    }).join("");
    list.querySelectorAll("[data-notification-read]").forEach(button => {
      button.addEventListener("click", () => markRead(button.dataset.notificationRead, button));
    });
  }
  async function loadPage({ append = false } = {}) {
    const db = client();
    if (!db) throw new Error("Notifications are unavailable because the app backend is not configured.");
    status(append ? "Loading older updates…" : "Loading your notifications…");
    const { data, error } = await db.rpc("get_my_notifications", {
      p_limit: PAGE_SIZE,
      p_before: append ? state.oldest : null,
      p_before_id: append ? state.oldestId : null
    });
    if (error) throw error;
    const page = Array.isArray(data?.items) ? data.items : [];
    state.unreadCount = Number(data?.unread_count || 0);
    if (append) {
      const seen = new Set(state.items.map(item => item.id));
      state.items = state.items.concat(page.filter(item => !seen.has(item.id)));
    } else {
      state.items = page;
    }
    state.oldest = state.items.length ? state.items[state.items.length - 1].created_at : null;
    state.oldestId = state.items.length ? state.items[state.items.length - 1].id : null;
    state.hasMore = page.length === PAGE_SIZE;
    render();
    status(state.items.length ? "Showing the newest order updates first." : "No order updates yet.");
  }
  async function refresh() {
    clearError();
    const db = client();
    if (!db) throw new Error("The app backend is not configured.");
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    state.user = data?.session?.user || null;
    $("notificationsSignedOut").hidden = Boolean(state.user);
    $("notificationsSignedIn").hidden = !state.user;
    if (!state.user) {
      state.items = [];
      state.unreadCount = 0;
      $("notificationsAccountLabel").textContent = "";
      return;
    }
    $("notificationsAccountLabel").textContent = state.user.email || "Signed-in account";
    await loadPage();
  }
  async function markRead(id, button) {
    if (state.busy) return;
    state.busy = true;
    if (button) { button.disabled = true; button.textContent = "Saving…"; }
    clearError();
    try {
      const { error } = await client().rpc("mark_my_notification_read", { p_notification_id: id });
      if (error) throw error;
      await loadPage();
    } catch (error) {
      setError(error?.message || "Could not mark this update as read.");
      if (button) { button.disabled = false; button.textContent = "Mark read"; }
    } finally { state.busy = false; render(); }
  }
  $("notificationsRefresh").addEventListener("click", async () => {
    if (state.busy) return;
    state.busy = true; $("notificationsRefresh").disabled = true; clearError();
    try { await refresh(); }
    catch (error) { setError(error?.message || "Could not refresh notifications."); }
    finally { state.busy = false; $("notificationsRefresh").disabled = false; render(); }
  });
  $("notificationsMarkAll").addEventListener("click", async () => {
    if (state.busy || !state.unreadCount) return;
    state.busy = true; $("notificationsMarkAll").disabled = true; clearError();
    try {
      const { error } = await client().rpc("mark_all_my_notifications_read");
      if (error) throw error;
      await loadPage();
      status("All notifications marked as read.");
    } catch (error) { setError(error?.message || "Could not mark notifications as read."); }
    finally { state.busy = false; render(); }
  });
  $("notificationsLoadMore").addEventListener("click", async () => {
    if (state.busy || !state.hasMore || !state.oldest || !state.oldestId) return;
    state.busy = true; $("notificationsLoadMore").disabled = true; clearError();
    try { await loadPage({ append: true }); }
    catch (error) { setError(error?.message || "Could not load older notifications."); }
    finally { state.busy = false; $("notificationsLoadMore").disabled = false; render(); }
  });
  client()?.auth?.onAuthStateChange?.(() => window.setTimeout(() => refresh().catch(error => setError(error?.message)), 0));
  refresh().catch(error => {
    setError(error?.message || "Could not load notifications.");
    status("The notification service could not be reached.");
  });
})();
