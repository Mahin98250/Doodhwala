/* Doodhwala Direct UPI Checkout
 * Customer-facing UPI intent + QR helper. It never marks an order paid.
 * QR is generated locally in the browser; payment confirmation remains seller-attested.
 */
(function () {
  "use strict";
  let activeModal = null;
  let lastFocused = null;

  function money(value) {
    return "₹" + Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function buildUri(payment) {
    return "upi://pay?pa=" + encodeURIComponent(payment.upi_id) +
      "&pn=" + encodeURIComponent(payment.payee_name) +
      "&am=" + encodeURIComponent(Number(payment.amount).toFixed(2)) +
      "&cu=INR&tn=" + encodeURIComponent("Doodhwala order " + payment.order_id);
  }

  function button(label, className, onClick) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = className;
    el.textContent = label;
    el.addEventListener("click", onClick);
    return el;
  }

  async function copyText(value, state, successMessage) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const field = document.createElement("textarea");
        field.value = value;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        if (!copied) throw new Error("Copy unavailable");
      }
      state.textContent = successMessage;
    } catch (_) {
      state.textContent = "Copy is unavailable in this browser. You can select the UPI ID manually.";
    }
  }

  function close() {
    if (!activeModal) return;
    activeModal.remove();
    activeModal = null;
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    lastFocused = null;
    document.removeEventListener("keydown", onKeyDown);
  }

  function onKeyDown(event) {
    if (event.key === "Escape") close();
    if (event.key !== "Tab" || !activeModal) return;
    const items = Array.from(activeModal.querySelectorAll("button, a, input, [tabindex]:not([tabindex='-1'])"))
      .filter(el => !el.disabled && el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function open(payment, trigger) {
    const amount = Number(payment && payment.amount);
    const upiId = String(payment && payment.upi_id || "").trim();
    const payeeName = String(payment && payment.payee_name || "").trim();
    const orderId = String(payment && payment.order_id || "").trim();
    if (!upiId || !payeeName || !orderId || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("Seller payment details are incomplete.");
    }
    close();
    lastFocused = trigger || document.activeElement;
    const uri = buildUri({ upi_id: upiId, payee_name: payeeName, amount, order_id: orderId });

    const overlay = document.createElement("div");
    overlay.className = "dw-upi-overlay";
    overlay.innerHTML = '<section class="dw-upi-dialog" role="dialog" aria-modal="true" aria-labelledby="dw-upi-title" aria-describedby="dw-upi-warning">' +
      '<div class="dw-upi-head"><div><span class="dw-upi-kicker">DIRECT TO SELLER</span><h2 id="dw-upi-title">Pay with UPI</h2></div><button type="button" class="dw-upi-close" aria-label="Close payment window">×</button></div>' +
      '<div class="dw-upi-total"><small>Order amount</small><strong class="dw-upi-amount"></strong><span class="dw-upi-payee"></span></div>' +
      '<div class="dw-upi-qr-wrap"><canvas class="dw-upi-qr" width="220" height="220" aria-label="UPI payment QR code"></canvas><p class="dw-upi-qr-status" aria-live="polite">Preparing secure payment QR…</p></div>' +
      '<div class="dw-upi-field"><label for="dw-upi-vpa">Seller UPI ID</label><div><input id="dw-upi-vpa" readonly><button type="button" class="dw-upi-copy">Copy ID</button></div></div>' +
      '<p id="dw-upi-warning" class="dw-upi-warning">Before approving in your UPI app, check that the payee name and amount match exactly. Never share your UPI PIN or OTP with anyone.</p>' +
      '<div class="dw-upi-actions"></div><p class="dw-upi-status" role="status" aria-live="polite">After paying, return to Doodhwala. The seller must check their bank/UPI app and confirm receipt. Returning here is not proof of payment.</p>' +
      '<div class="dw-upi-foot"><span>Order ' + orderId.replace(/[&<>"]/g, "") + '</span><span>Funds go directly to the seller</span></div></section>';
    document.body.appendChild(overlay);
    activeModal = overlay;
    overlay.querySelector(".dw-upi-amount").textContent = money(amount);
    overlay.querySelector(".dw-upi-payee").textContent = "Payee: " + payeeName;
    overlay.querySelector("#dw-upi-vpa").value = upiId;
    const status = overlay.querySelector(".dw-upi-status");
    const qrStatus = overlay.querySelector(".dw-upi-qr-status");
    const actions = overlay.querySelector(".dw-upi-actions");

    overlay.querySelector(".dw-upi-close").addEventListener("click", close);
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
    overlay.querySelector(".dw-upi-copy").addEventListener("click", () => copyText(upiId, status, "Seller UPI ID copied. Confirm the payee name inside your UPI app."));
    actions.appendChild(button("Open UPI app", "dw-upi-primary", () => {
      status.textContent = "Check the payee name and exact amount in your UPI app before authorising. Payment is not confirmed by this redirect.";
      window.location.href = uri;
    }));
    actions.appendChild(button("Copy payment link", "dw-upi-secondary", () => copyText(uri, status, "UPI payment link copied. Open it on a device with a UPI app installed.")));

    if (window.QRCode && typeof window.QRCode.toCanvas === "function") {
      window.QRCode.toCanvas(overlay.querySelector(".dw-upi-qr"), uri, {
        width: 220, margin: 2, errorCorrectionLevel: "M"
      }, error => {
        qrStatus.textContent = error ? "QR could not be generated here. Use Open UPI app or copy the payment link." : "Scan with a UPI app and verify payee + amount.";
        if (error) overlay.querySelector(".dw-upi-qr").hidden = true;
      });
    } else {
      overlay.querySelector(".dw-upi-qr").hidden = true;
      qrStatus.textContent = "QR library unavailable. Use Open UPI app or copy the payment link.";
    }

    document.addEventListener("keydown", onKeyDown);
    const first = overlay.querySelector(".dw-upi-close");
    if (first) first.focus();
  }

  window.DoodhwalaDirectUpi = { open, close };
})();
