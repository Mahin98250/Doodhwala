(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const form = $("supportForm");
  const status = $("supportStatus");
  const submit = $("supportSubmit");
  const success = $("supportTicketSuccess");
  const requestsHost = $("myRequestsList");
  const refreshRequestsButton = $("refreshMyRequests");
  const initialSubmitLabel = submit.innerHTML;
  let submitting = false;
  let refreshingRequests = false;

  const client = () => window.Doodhwala?.supabase;
  const say = (message, type = "") => {
    status.textContent = message;
    status.className = "support-status" + (type ? " " + type : "");
    status.setAttribute("role", type === "error" ? "alert" : "status");
    status.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  };

  async function getUser() {
    const db = client();
    if (!db) return null;
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  async function loadMyRequests() {
    const db = client();
    if (!requestsHost || refreshingRequests) return;
    refreshingRequests = true;
    requestsHost.setAttribute("aria-busy", "true");
    requestsHost.textContent = "Loading your support requests…";
    try {
      if (!db) throw new Error("The support backend is not configured.");
      const { data: sessionData, error: sessionError } = await db.auth.getSession();
      if (sessionError) throw sessionError;
      const user = sessionData?.session?.user;
      if (!user) {
        requestsHost.innerHTML = '<p class="support-status">Sign in to see requests linked to your account.</p>';
        return;
      }
      const { data, error } = await db.from("support_tickets")
        .select("id,category,subject,status,priority,created_at,updated_at")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      requestsHost.innerHTML = data?.length
        ? data.map(ticket => '<article class="my-request"><div><b>' + escapeHtml(ticket.subject) +
          '</b><small>' + escapeHtml(ticket.category) + ' · ' +
          escapeHtml(new Date(ticket.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) +
          '</small></div><span class="my-request-status ' + escapeHtml(ticket.status) + '">' +
          escapeHtml(String(ticket.status || "open").replace("_", " ")) +
          '</span><small>Ref: ' + escapeHtml(ticket.id) + '</small></article>').join("")
        : '<p class="support-status">No support requests yet. If something goes wrong, submit a request above.</p>';
    } catch (_) {
      requestsHost.innerHTML = '<p class="support-status error">Could not load your support requests. Use Refresh above or try again.</p>' +
        '<button class="support-refresh" type="button" data-retry-my-requests>Try again</button>';
    } finally {
      requestsHost.setAttribute("aria-busy", "false");
      refreshingRequests = false;
    }
  }

  async function refreshAuth() {
    try {
      const user = await getUser();
      void loadMyRequests();
      submit.innerHTML = user ? "Submit support request <span>→</span>" : "Sign in to send request <span>→</span>";
      if (!client()) say("Support submission is unavailable because the app backend is not configured. You can still use the quick answers above.", "error");
      else if (!user) say("Sign in is required so we can attach your request to the right account.");
      else say("Signed in. Describe the issue and submit your request.");
    } catch (_) {
      submit.innerHTML = "Retry account check <span>→</span>";
      say("We couldn't verify your account. Check your connection and try again.", "error");
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (submitting) return;
    success.hidden = true;
    const db = client();
    if (!db) {
      say("We couldn't connect to support. Please try again later.", "error");
      return;
    }

    submitting = true;
    const submitLabel = submit.innerHTML;
    submit.disabled = true;
    submit.textContent = "Checking your account…";
    try {
      const { data: sessionData, error: sessionError } = await db.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData?.session?.user) {
        location.href = "/Doodhwala/auth/?return=" + encodeURIComponent("/Doodhwala/support/");
        return;
      }

      const category = $("supportCategory").value;
      const subject = $("supportSubject").value.trim();
      const description = $("supportDescription").value.trim();
      const rawOrder = $("supportOrderId").value.trim();
      let orderId = null;
      if (rawOrder) {
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuid.test(rawOrder)) throw new Error("Order ID format looks incorrect. Paste the full order UUID or leave it blank.");
        orderId = rawOrder;
      }
      if (subject.length < 3 || description.length < 5) throw new Error("Please add a short summary and a few details.");

      submit.textContent = "Sending request…";
      const { data, error } = await db.rpc("create_support_ticket", {
        p_subject: subject,
        p_description: description,
        p_category: category,
        p_order_id: orderId
      });
      if (error) throw error;
      const ticket = Array.isArray(data) ? data[0] : data;
      if (!ticket || typeof ticket !== "object" || !ticket.id) {
        throw new Error("We couldn't confirm that your request was recorded. Refresh your request history before trying again.");
      }

      form.hidden = true;
      success.hidden = false;
      $("supportTicketMessage").textContent = "Your request has been recorded. Reference: " + String(ticket.id) + ". Keep this reference for follow-up.";
      say("Request submitted. Reference: " + String(ticket.id) + ".", "success");
      void loadMyRequests();
    } catch (error) {
      say(error?.message || "We couldn't submit your request. Please try again.", "error");
    } finally {
      submitting = false;
      submit.disabled = false;
      if (!form.hidden) submit.innerHTML = submitLabel || initialSubmitLabel;
    }
  });

  requestsHost?.addEventListener("click", event => {
    if (event.target?.closest?.("[data-retry-my-requests]")) void loadMyRequests();
  });

  refreshRequestsButton?.addEventListener("click", async () => {
    if (refreshingRequests) return;
    refreshRequestsButton.disabled = true;
    const label = refreshRequestsButton.textContent;
    refreshRequestsButton.textContent = "Refreshing…";
    try {
      await loadMyRequests();
    } finally {
      refreshRequestsButton.disabled = false;
      refreshRequestsButton.textContent = label;
    }
  });

  refreshAuth();
})();