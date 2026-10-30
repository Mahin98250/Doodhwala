import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1];
assert.ok(root, "styles.css must expose its existing root token block");

const declarations = new Map(
  [...root.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)]
    .map(([, name, value]) => [name, value.trim()])
);

const required = [
  "--dw-color-brand", "--dw-color-brand-strong", "--dw-color-brand-soft",
  "--dw-color-bg", "--dw-color-surface", "--dw-color-surface-muted",
  "--dw-color-text", "--dw-color-text-muted", "--dw-color-text-subtle",
  "--dw-color-border", "--dw-color-border-strong", "--dw-color-accent",
  "--dw-color-success", "--dw-color-success-soft", "--dw-color-warning",
  "--dw-color-danger", "--dw-color-info", "--dw-color-info-soft",
  "--dw-font-body", "--dw-font-display",
  "--dw-font-size-xs", "--dw-font-size-sm", "--dw-font-size-base",
  "--dw-font-size-lg", "--dw-font-size-xl", "--dw-font-size-2xl",
  "--dw-font-size-3xl", "--dw-font-weight-medium",
  "--dw-font-weight-semibold", "--dw-font-weight-bold",
  "--dw-space-1", "--dw-space-2", "--dw-space-3", "--dw-space-4",
  "--dw-space-5", "--dw-space-6", "--dw-space-7", "--dw-space-8",
  "--dw-radius-xs", "--dw-radius-sm", "--dw-radius-md",
  "--dw-radius-lg", "--dw-radius-xl", "--dw-radius-full",
  "--dw-shadow-sm", "--dw-shadow-md", "--dw-shadow-lg",
  "--dw-motion-fast", "--dw-motion-normal", "--dw-motion-slow",
  "--dw-motion-ease", "--dw-z-base", "--dw-z-sticky",
  "--dw-z-drawer", "--dw-z-modal", "--dw-z-toast",
  "--dw-z-bottom-nav", "--dw-z-assistant", "--dw-z-max"
];
for (const name of required) assert.ok(declarations.has(name), `missing design token ${name}`);

const legacy = new Map([
  ["--radius-sm", "10px"], ["--radius", "15px"], ["--radius-lg", "21px"],
  ["--bg", "#f5f7f3"], ["--surface", "#ffffff"], ["--ink", "#17221a"],
  ["--muted", "#6f7c73"], ["--line", "#e2e8e1"],
  ["--green", "#17603f"], ["--green-dark", "#10482f"]
]);
for (const [name, expected] of legacy) {
  assert.equal(legacyDeclarations.get(name), expected, `legacy token ${name} must remain ${expected}`);
}
const aliases = new Map([
  ["--dw-color-brand", "var(--green)"],
  ["--dw-color-brand-strong", "var(--green-dark)"],
  ["--dw-color-brand-soft", "var(--green-soft)"],
  ["--dw-color-bg", "var(--bg)"],
  ["--dw-color-surface", "var(--surface)"],
  ["--dw-color-text", "var(--ink)"],
  ["--dw-color-text-muted", "var(--muted)"],
  ["--dw-color-border", "var(--line)"],
  ["--dw-radius-sm", "var(--radius-sm)"],
  ["--dw-radius-md", "var(--radius)"],
  ["--dw-radius-lg", "var(--radius-lg)"],
  ["--dw-shadow-sm", "var(--shadow-sm)"],
  ["--dw-shadow-md", "var(--shadow)"],
  ["--dw-shadow-lg", "var(--shadow-lg)"]
]);
for (const [name, expected] of aliases) {
  assert.equal(declarations.get(name), expected, `${name} must alias ${expected} for backwards compatibility`);
}

console.log("Customer design-token contracts passed: semantic coverage and legacy compatibility.");
