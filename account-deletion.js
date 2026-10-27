(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const client = () => window.Doodhwala?.supabase;
  const state = { user: null, request: null, busy: false };
  const requestSection = $("deletionRequestSection");
  const requestStatusSection = $("deletionRequestStatusSection");
  const form = $("deletionRequestForm");
  const submit = $("deletionSubmit");
  const cancel = $("deletionCancel");
  const errorBox = $("deletionError");

  function setError(message) {
    errorBox.textContent = String(message || "The request could not be completed. Please try again.");
    errorBox.hidden = false;
  }
  function clearError() {
    errorBox.textContent = "";
    errorBox.hidden = true;
  }
  function statusLabel(status) {
    return ({
      pending: "Pending review",
      under_review: "Under review",
      blocked_open_orders: "Waiting for open orders or obligations",
      cancelled: "Cancelled",
      completed: "Completed"
    })[status] || String(status || "Unknown");
  }
  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }
  function showRequestForm() {
    requestStatusSection.hidden = true;
    requestSection.hidden = false;
    $("deletionConfirm").value = "";
    $("deletionAcknowledge").checked = false;
    submit.disabled = false;
    submit.textContent = "Submit deletion request";
  }
  function renderRequest(request) {
    state.request = request || null;
    clearError();
    if (!request) {
      requestSection.hidden = false;
      requestStatusSection.hidden = true;
      $("deletionStatus").textContent = "No account deletion request is recorded for this account.";
      showRequestForm();
      return;
    }
    requestSection.hidden = true;
    requestStatusSection.hidden = false;
    $("deletionRequestId").textContent = request.id || "—";
    $("deletionRequestState").textContent = statusLabel(request.status);
    $("deletionRequestedAt").textContent = formatDate(request.requested_at);
    const status = $("deletionStatus");
    status.className = "deletion-status " + String(request.status || "");
    status.textContent = request.status === "completed"
      ? "The backend reports this request as completed. Review any confirmation provided by Doodhwala; this screen does not itself erase data."
      : request.status === "cancelled"
        ? "This request was cancelled. No account data was deleted by this request."
        : request.status === "blocked_open_orders"
          ? "The request is waiting for open orders or provider obligations to be resolved. Your account is not deleted."
          : request.status === "under_review"
            ? "The request is under review. Your account and personal data are not yet deleted."
            : "Request received. Your account and personal data are not yet deleted. Do not treat this as completed until the backend status changes to Completed.";
    $("deletionStatusNote").textContent = request.status === "pending"
      ? "You can cancel while the request is still pending. The request intake does not itself perform deletion."
      : "If you need clarification, contact support and quote the request reference above.";
    cancel.hidden = request.status !== "pending";
    cancel.disabled = false;
    cancel.textContent = "Cancel pending request";
    if (request.status === "cancelled") {
      requestSection.hidden = false;
      requestStatusSection.hidden = true;
      $("deletionStatus").textContent = "Your previous request was cancelled. You may submit a new request.";
    }
  }
  async function getSessionUser() {
    const db = client();
    if (!db) throw new Error("Account deletion is unavailable because the app backend is not configured.");
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  }
  async function loadRequest() {
    const db = client();
    const { data, error } = await db.rpc("get_my_account_deletion_request");
    if (error) throw error;
    renderRequest(data?.request || null);
  }
  async function refresh() {
    clearError();
    $("deletionAuthHint").textContent = "Checking your sign-in status…";
    try {
      state.user = await getSessionUser();
      if (!state.user) {
        $("deletionAuthHint").textContent = "Sign in is required to manage an account deletion request.";
        $("deletionSignedOut").hidden = false;
        $("deletionSignedIn").hidden = true;
        requestSection.hidden = true;
        requestStatusSection.hidden = true;
        return;
      }
      $("deletionAuthHint").textContent = "Only the signed-in account can view or submit its request.";
      $("deletionSignedOut").hidden = true;
      $("deletionSignedIn").hidden = false;
      $("deletionAccountLabel").textContent = state.user.email || "Authenticated Doodhwala account";
      await loadRequest();
    } catch (error) {
      setError(error?.message || "Could not check your account. Please refresh.");
      $("deletionAuthHint").textContent = "Account status could not be verified.";
    }
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (state.busy) return;
    clearError();
    if ($("deletionConfirm").value.trim() !== "DELETE MY ACCOUNT") {
      setError("Type DELETE MY ACCOUNT exactly to confirm the request.");
      return;
    }
    if (!$("deletionAcknowledge").checked) {
      setError("Please confirm that this submits a request and does not immediately erase your account.");
      return;
    }
    state.busy = true;
    submit.disabled = true;
    submit.textContent = "Submitting request…";
    try {
      const db = client();
      const { data, error } = await db.rpc("request_account_deletion", {
        p_confirmation: "DELETE MY ACCOUNT",
        p_reason: $("deletionReason").value.trim() || null
      });
      if (error) throw error;
      const request = data && typeof data === "object" ? data : null;
      if (!request?.id || !request?.status) throw new Error("The backend did not return a valid request reference.");
      renderRequest(request);
    } catch (error) {
      setError(error?.message || "Could not submit the request. Please try again.");
      submit.disabled = false;
      submit.textContent = "Submit deletion request";
    } finally {
      state.busy = false;
    }
  });
  cancel.addEventListener("click", async () => {
    if (state.busy || !state.request?.id || state.request.status !== "pending") return;
    if (!window.confirm("Cancel this pending account deletion request? Your account will remain active.")) return;
    state.busy = true;
    cancel.disabled = true;
    cancel.textContent = "Cancelling…";
    clearError();
    try {
      const { data, error } = await client().rpc("cancel_account_deletion_request", {
        p_request_id: state.request.id
      });
      if (error) throw error;
      renderRequest(data);
      $("deletionStatus").textContent = "The pending request was cancelled. Your account remains active.";
    } catch (error) {
      setError(error?.message || "Could not cancel the request. Please refresh.");
      cancel.disabled = false;
      cancel.textContent = "Cancel pending request";
    } finally {
      state.busy = false;
    }
  });
  $("deletionRefresh").addEventListener("click", async () => {
    if (state.busy) return;
    $("deletionRefresh").disabled = true;
    $("deletionRefresh").textContent = "Refreshing…";
    try { await refresh(); }
    finally {
      $("deletionRefresh").disabled = false;
      $("deletionRefresh").textContent = "Refresh status";
    }
  });
  window.Doodhwala?.supabase?.auth?.onAuthStateChange?.(() => {
    window.setTimeout(() => refresh(), 0);
  });
  refresh();
})();
