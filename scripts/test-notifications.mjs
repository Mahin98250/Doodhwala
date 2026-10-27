import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261027110000_doodhwala_in_app_order_notifications.sql");
const html = read("notifications.html");
const css = read("notifications.css");
const client = read("notifications.js");
const home = read("index.html");
const orders = read("orders.html");
const provider = read("provider.html");

assert.match(migration, /create table if not exists public\.user_notifications/i, "notification ledger must exist");
assert.match(migration, /enable row level security/i, "notification ledger must enable RLS");
assert.match(migration, /revoke all on table public\.user_notifications from public, anon, authenticated/i, "browser roles must not access notification rows directly");
assert.match(migration, /unique \(user_id, source_event_id\)/i, "one notification per user per status event must be enforced");
assert.match(migration, /create trigger order_status_events_notify/i, "order status events must create notifications");
assert.match(migration, /new\.to_status = 'placed'/i, "providers should be alerted for new orders");
assert.match(migration, /get_my_notifications/i, "authenticated users need a notification list RPC");
assert.match(migration, /mark_my_notification_read/i, "users need a scoped mark-read RPC");
assert.match(migration, /mark_all_my_notifications_read/i, "users need a mark-all-read RPC");
assert.match(migration, /n\.user_id = v_uid/i, "read actions must be scoped to the current user");
assert.match(migration, /revoke all on function public\.get_my_notifications\(integer, timestamptz\) from public, anon, authenticated/i, "notification list RPC must reset grants");
assert.match(migration, /grant execute on function public\.get_my_notifications\(integer, timestamptz\) to authenticated/i, "authenticated role must be explicitly allowed to call list RPC");
assert.match(migration, /Push delivery is not configured/i, "database documentation must not imply push delivery exists");

assert.match(html, /id="notificationsList"/i, "notification list container must exist");
assert.match(home, /href="\/Doodhwala\/notifications\.html"/i, "customer header must link to order notifications");
assert.match(orders, /href="\/Doodhwala\/notifications\.html"/i, "order history must link to order notifications");
assert.match(provider, /href="\/Doodhwala\/notifications\.html"/i, "provider dashboard must link to order notifications");
assert.match(html, /id="notificationsMarkAll"/i, "mark-all-read control must exist");
assert.match(html, /id="notificationsLoadMore"/i, "pagination control must exist");
assert.match(html, /Sign in to view updates/i, "signed-out state must be explained");
assert.match(html, /Push notifications are not configured/i, "page must be honest about push support");
assert.match(html, /pwa-register\.js/i, "notification route must register the PWA");
assert.match(css, /@media\s*\(max-width:\s*560px\)/i, "notification page must support mobile layouts");
assert.match(css, /prefers-reduced-motion/i, "notification page must respect reduced motion");

assert.match(client, /rpc\("get_my_notifications"/i, "client must fetch through the authenticated list RPC");
assert.match(client, /rpc\("mark_my_notification_read"/i, "client must mark a single notification read through RPC");
assert.match(client, /rpc\("mark_all_my_notifications_read"/i, "client must mark all notifications read through RPC");
assert.doesNotMatch(client, /\.from\(["']user_notifications/i, "client must not read the notification table directly");
assert.doesNotMatch(client, /innerHTML\s*=\s*[^;]*item\.(title|body)/i, "untrusted notification text must not be inserted without escaping");

console.log("In-app notification contracts passed: private ledger, order-event alerts, user scoping, explicit grants, honest push status and responsive UI.");
