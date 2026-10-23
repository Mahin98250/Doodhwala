/* Accessible connection feedback shared by Doodhwala routes.
   This reports browser connectivity only; it does not promise offline checkout or order submission. */
(function (window, document) {
  "use strict";
  if (!window || !document || !document.body) return;
  if (document.getElementById("doodhwalaNetworkStatus")) return;

  var online = !window.navigator || window.navigator.onLine !== false;
  var timer = null;
  var banner = document.createElement("aside");
  banner.id = "doodhwalaNetworkStatus";
  banner.className = "dw-network-status";
  banner.hidden = true;
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");
  banner.setAttribute("aria-atomic", "true");

  var message = document.createElement("span");
  message.className = "dw-network-message";
  var dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "dw-network-dismiss";
  dismiss.setAttribute("aria-label", "Dismiss connection message");
  dismiss.textContent = "Dismiss";
  banner.append(message, dismiss);

  var style = document.createElement("style");
  style.id = "doodhwalaNetworkStatusStyles";
  style.textContent = [
    ".dw-network-status{position:fixed;z-index:30000;top:calc(10px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);width:min(620px,calc(100% - 24px));display:flex;align-items:center;gap:14px;padding:12px 14px;border:1px solid #e8c98b;border-radius:14px;background:rgba(255,249,235,.97);color:#6f4a0d;box-shadow:0 12px 35px rgba(34,38,24,.17);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);font:600 12px/1.5 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
    ".dw-network-status[hidden]{display:none!important}",
    ".dw-network-message{flex:1;min-width:0}",
    ".dw-network-dismiss{flex:0 0 auto;min-height:34px;padding:7px 9px;border:1px solid rgba(111,74,13,.2);border-radius:9px;background:rgba(255,255,255,.72);color:inherit;font:700 10px/1.2 inherit;cursor:pointer}",
    ".dw-network-status.is-online{border-color:#b7d9c0;background:rgba(240,250,242,.97);color:#185a36}",
    ".dw-network-status.is-online .dw-network-dismiss{border-color:rgba(24,90,54,.2)}",
    ".dw-network-dismiss:focus-visible{outline:3px solid rgba(35,119,73,.35);outline-offset:2px}",
    "@media(max-width:480px){.dw-network-status{top:calc(7px + env(safe-area-inset-top,0px));gap:9px;padding:10px 11px;border-radius:12px;font-size:11px}.dw-network-dismiss{min-height:36px}}",
    "@media(prefers-reduced-motion:no-preference){.dw-network-status:not([hidden]){animation:dw-network-enter .18s ease-out both}@keyframes dw-network-enter{from{opacity:0;translate:0 -5px}to{opacity:1;translate:0 0}}}"
  ].join("");
  document.head.appendChild(style);
  document.body.appendChild(banner);

  function hide() {
    banner.hidden = true;
    if (timer) window.clearTimeout(timer);
    timer = null;
  }

  function showOffline() {
    if (timer) window.clearTimeout(timer);
    timer = null;
    banner.classList.remove("is-online");
    message.textContent = "You're offline. Some cached pages may remain available, but checkout, account actions and live order updates need a connection.";
    dismiss.hidden = false;
    banner.hidden = false;
  }

  function showOnlineRestored() {
    if (timer) window.clearTimeout(timer);
    banner.classList.add("is-online");
    message.textContent = "Connection restored. Refresh if any information looks out of date.";
    dismiss.hidden = false;
    banner.hidden = false;
    timer = window.setTimeout(hide, 5000);
  }

  dismiss.addEventListener("click", hide);
  window.addEventListener("offline", function () {
    online = false;
    showOffline();
  });
  window.addEventListener("online", function () {
    var wasOffline = !online;
    online = true;
    if (wasOffline) showOnlineRestored();
  });

  if (!online) showOffline();
})(window, document);
