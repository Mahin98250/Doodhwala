import assert from "node:assert/strict";
import fs from "node:fs";
import { runInNewContext } from "node:vm";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const support = read("support.js");
const supportHtml = read("support.html");
const notifications = read("notifications.js");
const notificationsHtml = read("notifications.html");

assert.match(support, /aria-busy/, "Support request history must expose loading state to assistive technology.");
assert.match(support, /data-retry-my-requests/, "Support history failure must provide a retry action.");
assert.match(support, /We couldn't confirm that your request was recorded/, "Missing ticket identifiers must not produce a false success.");
assert.match(support, /Request submitted\. Reference:/, "Support success must include the confirmed ticket reference.");
assert.match(supportHtml, /supportStatus[^>]*aria-live="polite"/, "Support form status must remain announced accessibly.");
assert.match(notifications, /This update was marked as read, but the list couldn't refresh/, "Single mark-read write success must be distinguished from refresh failure.");
assert.match(notifications, /All notifications were marked as read, but the list couldn't refresh/, "Mark-all write success must be distinguished from refresh failure.");
assert.match(notificationsHtml, /notificationsError[^>]*role="alert"/, "Notification errors must be announced to assistive technology.");

class Element {
  constructor(id) {
    this.id = id;
    this.textContent = "";
    this.innerHTML = "";
    this.className = "";
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
  }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  querySelectorAll() { return []; }
  closest() { return null; }
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 0)); };

async function runSupport(rpcResult) {
  const ids = ["supportForm", "supportStatus", "supportSubmit", "supportTicketSuccess", "myRequestsList", "refreshMyRequests", "supportTicketMessage", "supportCategory", "supportSubject", "supportDescription", "supportOrderId"];
  const elements = new Map(ids.map(id => [id, new Element(id)]));
  elements.get("supportSubmit").innerHTML = "Submit support request";
  elements.get("supportCategory").value = "general";
  elements.get("supportSubject").value = "Delivery question";
  elements.get("supportDescription").value = "Please help with my order.";
  const user = { id: "customer-test", email: "customer@example.test" };
  const db = {
    auth: { async getSession() { return { data: { session: { user } }, error: null }; } },
    from() {
      return { select() { return this; }, eq() { return this; }, order() { return this; }, async limit() { return { data: [], error: null }; } };
    },
    async rpc() { return rpcResult; }
  };
  runInNewContext(support, {
    document: { getElementById: id => elements.get(id) },
    window: { Doodhwala: { supabase: db } },
    location: { href: "" },
    console
  });
  await tick();
  await elements.get("supportForm").listeners.submit[0]({ preventDefault() {} });
  await tick();
  return elements;
}

const validTicket = await runSupport({ data: { id: "ticket-123" }, error: null });
assert.equal(validTicket.get("supportForm").hidden, true, "A confirmed ticket response should show the success panel.");
assert.equal(validTicket.get("supportTicketSuccess").hidden, false, "Confirmed support request should expose its success panel.");
assert.match(validTicket.get("supportStatus").textContent, /Request submitted\. Reference: ticket-123/, "Confirmed success should state the reference.");

const missingTicket = await runSupport({ data: null, error: null });
assert.equal(missingTicket.get("supportForm").hidden, false, "An incomplete response must leave the form available.");
assert.equal(missingTicket.get("supportTicketSuccess").hidden, true, "An incomplete response must not show success.");
assert.match(missingTicket.get("supportStatus").textContent, /couldn't confirm that your request was recorded/i, "An incomplete response must explain that success was not confirmed.");

async function runNotifications({ writeError = null, failRefreshAfterWrite = false } = {}) {
  const ids = ["notificationsUnreadCount", "notificationsMarkAll", "notificationsLoadMore", "notificationsList", "notificationsError", "notificationsStatus", "notificationsRefresh", "notificationsSignedOut", "notificationsSignedIn", "notificationsAccountLabel"];
  const elements = new Map(ids.map(id => [id, new Element(id)]));
  let writeDone = false;
  const db = {
    auth: { async getSession() { return { data: { session: { user: { id: "customer-test", email: "customer@example.test" } } }, error: null }; } },
    async rpc(name) {
      if (name === "get_my_notifications") {
        if (failRefreshAfterWrite && writeDone) throw new Error("refresh unavailable");
        return { data: { items: [{ id: "notice-1", title: "Order update", body: "Your order changed.", created_at: new Date().toISOString(), read_at: null }], unread_count: 1 }, error: null };
      }
      if (name === "mark_all_my_notifications_read") {
        if (writeError) return { data: null, error: new Error(writeError) };
        writeDone = true;
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }
  };
  runInNewContext(notifications, {
    document: { getElementById: id => elements.get(id), visibilityState: "visible" },
    window: { Doodhwala: { supabase: db }, setTimeout },
    console,
    setTimeout
  });
  await tick();
  await elements.get("notificationsMarkAll").listeners.click[0]({});
  await tick();
  return elements;
}

const refreshFailure = await runNotifications({ failRefreshAfterWrite: true });
assert.match(refreshFailure.get("notificationsStatus").textContent, /marked as read; list refresh needed/i, "A successful write followed by failed refresh must report both facts.");
assert.match(refreshFailure.get("notificationsError").textContent, /were marked as read, but the list couldn't refresh/i, "Refresh failure must not be mislabeled as a write failure.");

const writeFailure = await runNotifications({ writeError: "permission denied" });
assert.match(writeFailure.get("notificationsError").textContent, /permission denied/i, "A failed write must remain an error.");
assert.doesNotMatch(writeFailure.get("notificationsStatus").textContent, /All notifications marked as read\./, "A failed write must not display success.");

console.log("PASS: DW-005 support success/failure truthfulness and notification write-vs-refresh failure paths.");
