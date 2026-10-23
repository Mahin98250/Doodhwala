// Read-only HTTP smoke test for the deployed GitHub Pages site.
// Checks every top-level HTML route and every same-origin asset referenced by those pages.
// It does not authenticate, mutate data, submit forms, or claim interactive flows are proven.
const base = "https://mahin98250.github.io/Doodhwala/";
const routes = ["", "index.html", "auth.html", "checkout.html", "orders.html", "plans.html", "store.html", "product.html", "provider.html", "admin.html", "support.html", "legal.html", "offline.html"];
const timeoutMs = 15000, failures = [], checked = new Map();
function fail(message) { failures.push(message); }
function normalized(url) { const parsed = new URL(url); parsed.hash = ""; return parsed.href; }
async function get(url) {
  const key = normalized(url);
  if (checked.has(key)) return checked.get(key);
  const promise = (async () => {
    try { const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs) }); return { response, body: await response.text() }; }
    catch (error) { return { error }; }
  })();
  checked.set(key, promise);
  return promise;
}
for (const route of routes) {
  const url = new URL(route, base).href, result = await get(url);
  if (result.error) { fail(`PAGE network error ${route || "/"}: ${result.error.message}`); continue; }
  const { response, body } = result;
  if (!response.ok) { fail(`PAGE HTTP ${response.status}: ${route || "/"}`); continue; }
  if (!/text\/html/i.test(response.headers.get("content-type") || "")) fail(`PAGE wrong content type ${route || "/"}: ${response.headers.get("content-type")}`);
  if (!/<html\b/i.test(body) || !/<title\b[^>]*>\s*[^<]+/i.test(body)) fail(`PAGE missing HTML shell/title: ${route || "/"}`);
  if (/Page not found|404 - File not found/i.test(body.slice(0, 1500))) fail(`PAGE contains a not-found shell: ${route || "/"}`);
  const referencePattern = /(?:src|href)\s*=\s*["']([^"'\s]+)["']/gi;
  for (const match of body.matchAll(referencePattern)) {
    const raw = match[1];
    if (/^(?:#|data:|mailto:|tel:|javascript:|blob:)/i.test(raw)) continue;
    let target;
    try { target = new URL(raw, url); } catch { fail(`BAD URL in ${route}: ${raw}`); continue; }
    if (target.origin !== new URL(base).origin || !target.pathname.startsWith(new URL(base).pathname)) continue;
    target.hash = "";
    const asset = await get(target.href);
    if (asset.error) { fail(`ASSET network error from ${route || "/"}: ${raw} (${asset.error.message})`); continue; }
    if (!asset.response.ok) { fail(`ASSET HTTP ${asset.response.status} from ${route || "/"}: ${raw}`); continue; }
    const path = target.pathname.toLowerCase(), type = asset.response.headers.get("content-type") || "";
    if (path.endsWith(".css") && !/text\/css/i.test(type)) fail(`ASSET wrong CSS content type: ${raw} (${type})`);
    if (/\.m?js$/.test(path) && !/(javascript|ecmascript|text\/plain)/i.test(type)) fail(`ASSET wrong JS content type: ${raw} (${type})`);
    if (/\.(?:css|m?js)$/.test(path) && /<html\b/i.test(asset.body.slice(0, 300))) fail(`ASSET returned HTML instead of source: ${raw}`);
  }
}
console.log(`Checked ${routes.length} HTML routes and ${Math.max(0, checked.size - routes.length)} unique same-origin URLs.`);
if (failures.length) { for (const failure of failures) console.error("FAIL " + failure); console.error(`${failures.length} deployed-site smoke failure(s).`); process.exitCode = 1; }
else { console.log("PASS: all checked routes and referenced same-origin assets returned expected HTTP/content types."); console.log("LIMIT: this is a network/static smoke test; it does not prove authenticated workflows or interactive panels."); }
