/* Shared customer account controls: local-session sign-out on every customer route. */
(function () {
  "use strict";

  const BASE = "/Dudh-Wallah/";
  const auth = window.Doodhwala && window.Doodhwala.supabase && window.Doodhwala.supabase.auth;
  if (!auth) return;

  let currentSession = null;
  let logoutBusy = false;
  let toastTimer = null;

  function installStyles() {
    if (document.getElementById("doodhwalaSessionControlsStyles")) return;
    const style = document.createElement("style");
    style.id = "doodhwalaSessionControlsStyles";
    style.textContent = `
      .doodhwala-session-signout{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:8px 12px;border:1px solid #d8e4da;border-radius:11px;background:#fff;color:#24583a;font:700 11px/1.2 "DM Sans",system-ui,sans-serif;white-space:nowrap;cursor:pointer;transition:background .16s,border-color .16s,transform .16s}
      .doodhwala-session-signout:hover{background:#f1f8f2;border-color:#b9d1bf}
      .doodhwala-session-signout:active{transform:scale(.98)}
      .doodhwala-session-signout:disabled{opacity:.65;cursor:wait}
      .doodhwala-session-signout[hidden]{display:none!important}
      .auth-brand .doodhwala-session-signout{margin-left:auto;flex:0 0 auto}
      .doodhwala-session-toast{position:fixed;left:16px;right:16px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:20000;max-width:480px;margin:auto;padding:12px 14px;border-radius:12px;background:#163e2b;color:#fff;box-shadow:0 12px 30px rgba(20,45,29,.2);font:600 12px/1.45 "DM Sans",system-ui,sans-serif}
      .doodhwala-session-toast[hidden]{display:none!important}
      @media(min-width:761px){.doodhwala-session-toast{bottom:24px}}
      @media(max-width:760px){.doodhwala-session-signout{min-height:32px;padding:7px 9px;font-size:10px}.orders-top .doodhwala-session-signout,.plans-top .doodhwala-session-signout,.checkout-top .doodhwala-session-signout,.market-top .doodhwala-session-signout{margin-left:auto;margin-right:8px}}
      @media(prefers-reduced-motion:reduce){.doodhwala-session-signout{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function toast(message) {
    let node = document.getElementById("doodhwalaSessionToast");
    if (!node) {
      node = document.createElement("div");
      node.id = "doodhwalaSessionToast";
      node.className = "doodhwala-session-toast";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      node.hidden = true;
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.hidden = false;
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { node.hidden = true; }, 4500);
  }

  async function signOut(button) {
    if (logoutBusy) return;
    logoutBusy = true;
    if (button) {
      button.disabled = true;
      button.textContent = "Signing out…";
    }
    try {
      // Local scope ends this browser/PWA session without signing out other devices.
      const result = await auth.signOut({ scope: "local" });
      if (result && result.error) throw result.error;
      currentSession = null;
      window.dispatchEvent(new CustomEvent("doodhwala:session-signed-out"));
      window.location.replace(BASE + "?signedout=1");
    } catch (error) {
      console.warn("Doodhwala sign-out failed", error);
      toast("Could not sign out. Check your connection and try again.");
      if (button) {
        button.disabled = false;
        button.textContent = "Sign out";
      }
      logoutBusy = false;
    }
  }

  function makeButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "doodhwala-session-signout";
    button.textContent = "Sign out";
    button.hidden = true;
    button.addEventListener("click", () => signOut(button));
    return button;
  }

  function mountHomeControl() {
    const link = document.getElementById("authLink");
    if (!link) return null;
    link.dataset.doodhwalaSessionControl = "1";
    link.addEventListener("click", event => {
      if (!currentSession || !currentSession.user) return;
      event.preventDefault();
      signOut(link);
    });
    return {
      render(session) {
        const signedIn = Boolean(session && session.user);
        link.textContent = signedIn ? "Sign out" : "Sign in";
        link.href = signedIn ? "#sign-out" : BASE + "auth.html";
        link.setAttribute("aria-label", signedIn ? "Sign out of Doodhwala" : "Sign in to Doodhwala");
        link.title = signedIn ? "Sign out of your account on this device" : "Sign in to Doodhwala";
        link.classList.toggle("is-signed-in", signedIn);
      }
    };
  }

  function mountHeaderControl() {
    const header = document.querySelector(".orders-top,.plans-top,.checkout-top,.market-top");
    if (!header) return null;
    let button = header.querySelector(".doodhwala-session-signout");
    if (!button) {
      button = makeButton();
      const back = header.querySelector(".back-shop,.market-back");
      if (back) header.insertBefore(button, back);
      else header.appendChild(button);
    }
    return { render(session) { button.hidden = !(session && session.user); } };
  }

  function mountAuthControl() {
    if (!document.body.classList.contains("auth-page")) return null;
    const brand = document.querySelector(".auth-brand");
    if (!brand) return null;
    let button = brand.querySelector(".doodhwala-session-signout");
    if (!button) {
      button = makeButton();
      brand.appendChild(button);
    }
    return { render(session) { button.hidden = !(session && session.user); } };
  }

  installStyles();
  const controls = [mountHomeControl(), mountHeaderControl(), mountAuthControl()].filter(Boolean);
  if (!controls.length) return;

  function render(session) {
    currentSession = session && session.user ? session : null;
    controls.forEach(control => control.render(currentSession));
  }

  auth.getSession().then(({ data, error }) => {
    if (error) {
      console.warn("Could not read Doodhwala session state", error);
      return;
    }
    render(data && data.session);
  }).catch(error => console.warn("Could not read Doodhwala session state", error));

  auth.onAuthStateChange((_event, session) => {
    render(session);
  });

  window.DoodhwalaSessionControls = {
    signOut: () => signOut(null),
    isSignedIn: () => Boolean(currentSession && currentSession.user)
  };
})();