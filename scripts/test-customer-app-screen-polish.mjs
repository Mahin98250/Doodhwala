import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const css = fs.readFileSync(new URL("doodhwala-ui-system.css", root), "utf8");
const pages = {
  profile: ["profile/index.html", ["profile-account", "profile-grid", "profile-panel", "profile-link"]],
  personalDetails: ["profile/details/index.html", ["personalDetailsForm", "fullName", "phone", "addressFields", "saveProfile"]],
  auth: ["auth/index.html", ["authForm", "googleAuth", "phoneForm", "passwordResetForm"]],
  plans: ["plans/index.html", ["planForm", "schedulePreview", "planError"]],
  orders: ["orders/index.html", ["ordersList", "ordersState"]],
  checkout: ["checkout/index.html", ["addressForm", "checkoutItems", "placeOrder"]],
  notifications: ["notifications/index.html", ["notificationsList", "notificationsStatus"]],
  support: ["support/index.html", ["supportForm", "faqList", "supportSubmit"]],
  legal: ["legal/index.html", ["privacy", "terms", "cancellations"]]
};
for (const [name, [path, hooks]] of Object.entries(pages)) {
  const html = fs.readFileSync(new URL(path, root), "utf8");
  assert.ok(html.includes("doodhwala-ui-system.css"), `${name} must load the shared customer design system`);
  for (const hook of hooks) assert.ok(html.includes(hook), `${name} must retain existing hook ${hook}`);
}

const visualScopes = [
  "body.profile-page .profile-shell",
  ".details-page .details-shell",
  ".auth-page .auth-card",
  ".plans-page .plans-card",
  ".orders-page .orders-card",
  ".checkout-page .checkout-card",
  ".notifications-page .notifications-panel",
  ".support-page .support-card",
  ".legal-page .legal-section"
];
for (const selector of visualScopes) {
  assert.ok(css.includes(selector), `missing shared screen refinement for ${selector}`);
}
assert.match(css, /@media\s*\(max-width:760px\)/, "screen refinements must include a mobile layout");
assert.match(css, /prefers-reduced-motion\s*:\s*reduce/, "screen refinements must retain reduced-motion handling");

const reducedMotionBlock = css.match(/@media\\s*\\(prefers-reduced-motion:\\s*reduce\\)\\s*\\{([\\s\\S]*?)\\n\\}/)?.[1] || "";
for (const route of [".home-page", ".profile-page", ".details-page", ".legal-page"]) {
  assert.ok(reducedMotionBlock.includes(route), `${route} must explicitly respect reduced-motion preferences`);
}

console.log("Customer screen polish contracts passed: nine routes, preserved hooks and shared responsive styling.");
