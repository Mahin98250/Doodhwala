import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
let passed = 0;
let failed = 0;

function runTest(name, testFn) {
  try {
    testFn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    failed++;
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function runValidationScript(args = []) {
  return spawnSync("node", ["scripts/validate-design-tokens.mjs", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test" }
  });
}

// Test 1: Valid tokens should pass
runTest("Valid tokens pass validation", () => {
  const result = runValidationScript();
  assert(result.status === 0, `Expected exit code 0, got ${result.status}. Output: ${result.stdout} ${result.stderr}`);
  assert(result.stdout.includes("Design token validation passed"), "Should report validation passed");
});

// Test 2: Missing required token should fail
runTest("Missing required token fails validation", () => {
  // Temporarily modify a CSS file to remove a required token
  const cssFile = path.join(root, "styles.css");
  const original = fs.readFileSync(cssFile, "utf8");
  const modified = original.replace("--radius:15px;", "/* --radius:15px; */");
  fs.writeFileSync(cssFile, modified);
  
  try {
    const result = runValidationScript();
    assert(result.status !== 0, "Should fail with non-zero exit code");
    assert(result.stderr.includes("LEGACY_RADIUS_CHANGED") || result.stdout.includes("LEGACY_RADIUS_CHANGED"), "Should detect missing legacy radius token");
  } finally {
    fs.writeFileSync(cssFile, original);
  }
});

// Test 3: Duplicate token should fail
runTest("Duplicate token fails validation", () => {
  const cssFile = path.join(root, "styles.css");
  const original = fs.readFileSync(cssFile, "utf8");
  // Add a duplicate --radius declaration
  const modified = original.replace(":root{", ":root{\n  --radius:99px;");
  fs.writeFileSync(cssFile, modified);
  
  try {
    const result = runValidationScript();
    assert(result.status !== 0, "Should fail with non-zero exit code");
    const output = result.stdout + result.stderr;
    assert(output.includes("DUPLICATE_TOKEN"), "Should detect duplicate token");
    assert(output.includes("--radius"), "Should identify the duplicated token");
    assert(output.includes("styles.css"), "Should identify source file");
  } finally {
    fs.writeFileSync(cssFile, original);
  }
});

// Test 4: Malformed token should fail
runTest("Malformed token fails validation", () => {
  const cssFile = path.join(root, "styles.css");
  const original = fs.readFileSync(cssFile, "utf8");
  // Add a malformed token (empty value)
  const modified = original.replace(":root{", ":root{\n  --bad-token: ;");
  fs.writeFileSync(cssFile, modified);
  
  try {
    const result = runValidationScript();
    assert(result.status !== 0, "Should fail with non-zero exit code");
    const output = result.stdout + result.stderr;
    assert(output.includes("MALFORMED_TOKEN"), "Should detect malformed token");
    assert(output.includes("--bad-token"), "Should identify the malformed token");
  } finally {
    fs.writeFileSync(cssFile, original);
  }
});

// Test 5: Legacy radius value change should fail
runTest("Legacy radius value change fails validation", () => {
  const cssFile = path.join(root, "styles.css");
  const original = fs.readFileSync(cssFile, "utf8");
  // Change a legacy radius value
  const modified = original.replace("--radius:15px;", "--radius:99px;");
  fs.writeFileSync(cssFile, modified);
  
  try {
    const result = runValidationScript();
    assert(result.status !== 0, "Should fail with non-zero exit code");
    const output = result.stdout + result.stderr;
    assert(output.includes("LEGACY_RADIUS_CHANGED"), "Should detect legacy radius change");
    assert(output.includes("--radius"), "Should identify the changed token");
  } finally {
    fs.writeFileSync(cssFile, original);
  }
});

// Test 6: Documentation-only CSS import in production should fail
runTest("Documentation-only CSS import in production fails validation", () => {
  const htmlFile = path.join(root, "index.html");
  const original = fs.readFileSync(htmlFile, "utf8");
  // Add a documentation-only CSS import
  const modified = original.replace("</head>", `<link rel="stylesheet" href="/docs/some-doc.css">\n</head>`);
  fs.writeFileSync(htmlFile, modified);
  
  try {
    const result = runValidationScript();
    assert(result.status !== 0, "Should fail with non-zero exit code");
    const output = result.stdout + result.stderr;
    assert(output.includes("DOC_ONLY_IMPORT_IN_PRODUCTION"), "Should detect documentation-only import");
    assert(output.includes("index.html"), "Should identify the production entry point");
  } finally {
    fs.writeFileSync(htmlFile, original);
  }
});

// Test 7: Z-index tokens documented
runTest("Z-index tokens documented with usage", () => {
  const result = runValidationScript();
  assert(result.status === 0, "Should pass with valid tokens");
  const output = result.stdout + result.stderr;
  assert(output.includes("Z-Index Token Usage:"), "Should document z-index token usage");
  assert(output.includes("reference-only"), "Should mark reference-only tokens");
  assert(output.includes("runtime"), "Should mark runtime tokens");
});

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("\n✅ All negative tests passed");