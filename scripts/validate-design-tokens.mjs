import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const stylesPath = path.join(root, "styles.css");
const uiSystemPath = path.join(root, "doodhwala-ui-system.css");

const requiredTokens = [
  "--dw-radius",
  "--dw-radius-lg",
  "--dw-radius-xl",
  "--dw-radius-full",
  "--dw-radius-legacy",
  "--dw-radius-lg-legacy",
  "--dw-z-base",
  "--dw-z-dropdown",
  "--dw-z-sticky",
  "--dw-z-header",
  "--dw-z-drawer",
  "--dw-z-backdrop",
  "--dw-z-modal",
  "--dw-z-toast",
  "--dw-z-floating-assistant",
  "--dw-z-max"
];

const legacyAliases = {
  "--dw-radius-legacy": "var(--radius)",
  "--dw-radius-lg-legacy": "var(--radius-lg)"
};

function readCss(filePath) {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function extractDeclarations(css) {
  const decls = new Map();
  const rootBlockRe = /:root\s*\{([^}]+)\}/g;
  let match;
  while ((match = rootBlockRe.exec(css)) !== null) {
    const block = match[1];
    const propRe = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let propMatch;
    while ((propMatch = propRe.exec(block)) !== null) {
      const name = propMatch[1].trim();
      const value = propMatch[2].trim();
      if (decls.has(name)) {
        console.warn(`Duplicate token declaration: ${name}`);
      }
      decls.set(name, value);
    }
  }
  return decls;
}

function validate() {
  const stylesCss = readCss(stylesPath);
  const uiSystemCss = readCss(uiSystemPath);
  const allCss = stylesCss + "\n" + uiSystemCss;
  const tokens = extractDeclarations(allCss);

  let errors = [];
  let warnings = [];

  // 1. Required tokens exist
  for (const token of requiredTokens) {
    if (!tokens.has(token)) {
      errors.push(`Missing required token: ${token}`);
    }
  }

  // 2. Legacy aliases present and point to correct values
  for (const [alias, expected] of Object.entries(legacyAliases)) {
    if (!tokens.has(alias)) {
      errors.push(`Missing legacy alias: ${alias}`);
    } else if (tokens.get(alias) !== expected) {
      errors.push(`Legacy alias ${alias} has unexpected value: got "${tokens.get(alias)}", expected "${expected}"`);
    }
  }

  // 3. No duplicate or malformed declarations (warned during extraction)

  // 4. Documentation-only files not imported into production CSS
  // Check that doodhwala-ui-system.css doesn't import styles.css or vice versa in a way that duplicates
  if (stylesCss.includes("@import") && stylesCss.includes("doodhwala-ui-system")) {
    warnings.push("styles.css imports doodhwala-ui-system.css — verify this is intentional");
  }
  if (uiSystemCss.includes("@import") && uiSystemCss.includes("styles")) {
    warnings.push("doodhwala-ui-system.css imports styles.css — verify this is intentional");
  }

  // 5. Verify legacy radius values unchanged
  const legacyRadius = tokens.get("--radius");
  const legacyRadiusLg = tokens.get("--radius-lg");
  if (legacyRadius !== "15px") {
    errors.push(`Legacy --radius changed: expected "15px", got "${legacyRadius}"`);
  }
  if (legacyRadiusLg !== "21px") {
    errors.push(`Legacy --radius-lg changed: expected "21px", got "${legacyRadiusLg}"`);
  }

  // 6. Verify new design tokens have expected values
  const newRadius = tokens.get("--dw-radius");
  const newRadiusLg = tokens.get("--dw-radius-lg");
  if (newRadius !== "16px") {
    warnings.push(`New --dw-radius is "${newRadius}", expected "16px"`);
  }
  if (newRadiusLg !== "22px") {
    warnings.push(`New --dw-radius-lg is "${newRadiusLg}", expected "22px"`);
  }

  if (warnings.length) {
    console.warn("Design token validation warnings:");
    for (const w of warnings) console.warn(" - " + w);
  }

  if (errors.length) {
    console.error("Design token validation failed:");
    for (const e of errors) console.error(" - " + e);
    process.exit(1);
  }

  console.log("Design token validation passed: " + requiredTokens.length + " required tokens verified, legacy aliases intact.");
}

validate();
