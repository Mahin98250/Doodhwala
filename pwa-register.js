(function (window, document) {
  "use strict";

  if (!window.navigator || !("serviceWorker" in window.navigator)) return;

  function registerServiceWorker() {
    window.navigator.serviceWorker.register("/Dudh-Wallah/sw.js", {
      scope: "/Dudh-Wallah/"
    }).catch(function (error) {
      try {
        if (window.console && typeof window.console.warn === "function") {
          window.console.warn("Doodhwala offline support could not be enabled.", error);
        }
      } catch (_) {}
      try {
        if (window.DoodhwalaResilience && typeof window.DoodhwalaResilience.report === "function") {
          window.DoodhwalaResilience.report(
            "resource_error",
            "warning",
            "PWA service worker registration failed.",
            { resource: "/Dudh-Wallah/sw.js" }
          );
        }
      } catch (_) {}
    });
  }

  if (document.readyState === "complete") registerServiceWorker();
  else window.addEventListener("load", registerServiceWorker, { once: true });
})(window, document);
