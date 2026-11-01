import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const warnings = [];
let exitCode = 0;

// Token registry to track all declarations
const tokenRegistry = new Map(); // tokenName -> { file, line, value, isReference }
const legacyRadiusTokens = new Set(["--radius-sm", "--radius", "--radius-lg"]);
const zIndexTokens = new Set(["--z-index-dropdown", "--z-index-modal", "--z-index-toast", "--z-index-overlay"]);
const referenceOnlyZIndex = new Set(["--z-index-overlay"]); // Document which are reference-only

function parseCSSFile(filePath, relPath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  
  let inRoot = false;
  let braceDepth = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;
    
    // Track :root block
    if (line.startsWith(":root") || line.startsWith("@media") && line.includes(":root")) {
      inRoot = true;
      continue;
    }
    
    if (inRoot) {
      // Count braces to know when we exit :root
      for (const char of line) {
        if (char === "{") braceDepth++;
        if (char === "}") braceDepth--;
      }
      
      if (braceDepth <= 0) {
        inRoot = false;
        braceDepth = 0;
        continue;
      }
      
      // Parse token declarations: --token-name: value;
      const tokenMatch = line.match(/^(--[\w-]+)\s*:\s*([^;]+);/);
      if (tokenMatch) {
        const [, tokenName, tokenValue] = tokenMatch;
        const trimmedValue = tokenValue.trim();
        
        // Check for empty or invalid values
        if (!trimmedValue || trimmedValue === "" || trimmedValue.startsWith("/*")) {
          errors.push({
            type: "MALFORMED_TOKEN",
            file: relPath,
            line: lineNum,
            token: tokenName,
            message: `Empty or invalid value for token '${tokenName}'`
          });
          exitCode = 1;
          continue;
        }
        
        // Check for duplicate tokens
        if (tokenRegistry.has(tokenName)) {
          const existing = tokenRegistry.get(tokenName);
          errors.push({
            type: "DUPLICATE_TOKEN",
            file: relPath,
            line: lineNum,
            token: tokenName,
            message: `Duplicate token '${tokenName}' declared in ${relPath}:${lineNum} (first declared in ${existing.file}:${existing.line})`
          });
          exitCode = 1;
          continue;
        }
        
        // Validate legacy radius tokens haven't changed
        if (legacyRadiusTokens.has(tokenName)) {
          const expectedValues = {
            "--radius-sm": "10px",
            "--radius": "15px",
            "--radius-lg": "21px"
          };
          if (trimmedValue !== expectedValues[tokenName]) {
            errors.push({
              type: "LEGACY_RADIUS_CHANGED",
              file: relPath,
              line: lineNum,
              token: tokenName,
              message: `Legacy radius token '${tokenName}' changed from '${expectedValues[tokenName]}' to '${trimmedValue}'`
            });
            exitCode = 1;
          }
        }
        
        // Track z-index tokens
        const isReference = referenceOnlyZIndex.has(tokenName);
        tokenRegistry.set(tokenName, {
          file: relPath,
          line: lineNum,
          value: trimmedValue,
          isReference
        });
      }
    }
  }
}

function validateDocumentationOnlyImports() {
  // Check that documentation-only CSS files are not imported in production entry points
  const docOnlyFiles = [
    "docs/",
    "README.md",
    "CONTRIBUTING.md",
    "SECURITY.md"
  ];
  
  const productionEntryPoints = [
    "index.html",
    "auth.html",
    "checkout.html",
    "orders.html",
    "plans.html",
    "store.html",
    "product.html",
    "provider.html",
    "admin.html",
    "notifications.html",
    "support.html",
    "legal.html",
    "offline.html"
  ];
  
  for (const entryPoint of productionEntryPoints) {
    const filePath = path.join(root, entryPoint);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      
      // Check for imports of documentation-only CSS
      for (const docFile of docOnlyFiles) {
        if (content.includes(docFile) && docFile.endsWith(".css")) {
          errors.push({
            type: "DOC_ONLY_IMPORT_IN_PRODUCTION",
            file: entryPoint,
            message: `Production entry point '${entryPoint}' imports documentation-only CSS '${docFile}'`
          });
          exitCode = 1;
        }
      }
      
      // Also check for any .css import from docs/ directory
      const docCssImportRegex = /href=["']([^"']*docs[^"']*\.css)["']/gi;
      let match;
      while ((match = docCssImportRegex.exec(content)) !== null) {
        errors.push({
          type: "DOC_ONLY_IMPORT_IN_PRODUCTION",
          file: entryPoint,
          message: `Production entry point '${entryPoint}' imports documentation-only CSS '${match[1]}'`
        });
        exitCode = 1;
      }
    }
  }
}

function validateZIndexUsage() {
  // Document which z-index tokens are reference-only vs runtime
  const zIndexDoc = {
    "--z-index-dropdown": "runtime",
    "--z-index-modal": "runtime",
    "--z-index-toast": "runtime",
    "--z-index-overlay": "reference-only"
  };
  
  console.log("\nZ-Index Token Usage:");
  for (const [token, usage] of Object.entries(zIndexDoc)) {
    const info = tokenRegistry.get(token);
    if (info) {
      console.log(`  ${token}: ${usage} (value: ${info.value}, defined in ${info.file}:${info.line})`);
    } else {
      warnings.push(`Z-index token '${token}' not found in :root declarations`);
    }
  }
  
  // Verify overlay behavior is preserved (--z-index-overlay should be highest)
  const overlayValue = tokenRegistry.get("--z-index-overlay")?.value;
  const modalValue = tokenRegistry.get("--z-index-modal")?.value;
  const toastValue = tokenRegistry.get("--z-index-toast")?.value;
  const dropdownValue = tokenRegistry.get("--z-index-dropdown")?.value;
  
  if (overlayValue && modalValue) {
    const overlayNum = parseInt(overlayValue);
    const modalNum = parseInt(modalValue);
    if (!isNaN(overlayNum) && !isNaN(modalNum) && overlayNum <= modalNum) {
      warnings.push("--z-index-overlay should be higher than --z-index-modal to preserve overlay behavior");
    }
  }
}

function runValidation() {
  console.log("🔍 Validating design tokens...\n");
  
  // Find all CSS files
  const cssFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "." || entry.name === ".." || entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".css")) cssFiles.push(full);
    }
  }
  walk(root);
  
  // Parse each CSS file
  for (const file of cssFiles) {
    const relPath = path.relative(root, file).replaceAll(path.sep, "/");
    parseCSSFile(file, relPath);
  }
  
  // Validate documentation-only imports
  validateDocumentationOnlyImports();
  
  // Validate z-index usage
  validateZIndexUsage();
  
  // Output results
  if (errors.length > 0) {
    console.error("\n❌ Design token validation failed:");
    for (const error of errors) {
      console.error(`  [${error.type}] ${error.file}${error.line ? ":" + error.line : ""} - ${error.message}`);
    }
  }
  
  if (warnings.length > 0) {
    console.warn("\n⚠️  Warnings:");
    for (const warning of warnings) {
      console.warn(`  - ${warning}`);
    }
  }
  
  if (errors.length === 0) {
    console.log("\n✅ Design token validation passed");
    console.log(`   Tokens validated: ${tokenRegistry.size}`);
    console.log(`   Legacy radius tokens preserved: ${[...legacyRadiusTokens].filter(t => tokenRegistry.has(t)).length}/${legacyRadiusTokens.size}`);
    console.log(`   Z-index tokens found: ${[...zIndexTokens].filter(t => tokenRegistry.has(t)).length}/${zIndexTokens.size}`);
  }
  
  process.exit(exitCode);
}

runValidation();