(function (window, document) {
  "use strict";

  if (!window.navigator || !("serviceWorker" in window.navigator)) return;

  function registerServiceWorker() {
    window.navigator.serviceWorker.register("/Doodhwala/sw.js", {
      scope: "/Doodhwala/"
    }).catch(function (error) {
      const detail = error && (error.name || error.message)
        ? String(error.name || "Error") + (error.message ? ": " + String(error.message).slice(0, 180) : "")
        : "Unknown registration error";
      try {
        if (window.console && typeof window.console.warn === "function") {
          window.console.warn("Doodhwala offline support could not be enabled.", detail, error);
        }
      } catch (_) {}
      try {
        if (window.DoodhwalaResilience && typeof window.DoodhwalaResilience.report === "function") {
          window.DoodhwalaResilience.report(
            "resource_error",
            "warning",
            "PWA service worker registration failed: " + detail,
            { resource: "/Doodhwala/sw.js" }
          );
        }
      } catch (_) {}
    });
  }

  if (document.readyState === "complete") registerServiceWorker();
  else window.addEventListener("load", registerServiceWorker, { once: true });
})(window, document);
