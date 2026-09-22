import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { bumpVersion } from "./bump-version.mjs";
import { runNpm } from "./run.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const skipPages = args.includes("--skip-pages");

// Find optional version bump argument (e.g., "patch", "minor", "major", "0.5.12", or "--bump patch")
let bumpKind = null;
const bumpFlagIndex = args.findIndex((arg) => arg === "--bump" || arg === "-b");
if (bumpFlagIndex !== -1 && args[bumpFlagIndex + 1]) {
  bumpKind = args[bumpFlagIndex + 1];
} else {
  const positional = args.find((arg) => !arg.startsWith("--") && !arg.startsWith("-"));
  if (positional && /^(patch|minor|major|\d+\.\d+\.\d+)$/.test(positional)) {
    bumpKind = positional;
  }
}

if (bumpKind) {
  console.log(`Bumping version (${bumpKind})...`);
  await bumpVersion(bumpKind);
  console.log("");
}

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const version = packageJson.version;
console.log(`=== Starting release pipeline for Not Brother v${version} ===`);

// Verify release notes exist in docs/store-listing.md
const storeListing = await readFile(path.join(root, "docs", "store-listing.md"), "utf8");
const headings = [
  `### Version ${version} release notes`,
  `### ${version} 更新说明`,
  `### ${version} 更新内容`,
];

for (const heading of headings) {
  if (!storeListing.includes(heading)) {
    console.error(`Error: store-listing.md is missing heading: "${heading}"`);
    console.error("Please add release notes for this version before publishing.");
    process.exit(1);
  }
}

// Check for empty release notes bullets
const emptyBulletRegex = new RegExp(`### (?:Version )?${version.replace(/\./g, "\\.")} [^\\n]+\\n\\n-\\s*\\n`);
if (emptyBulletRegex.test(storeListing)) {
  console.warn("⚠️  Warning: Release notes bullet points in docs/store-listing.md appear to be empty.");
  console.warn("   Remember to fill in actual release notes before submitting to the Chrome Web Store.");
  console.log("");
}

console.log("[1/5] Running type checks and unit tests...");
runNpm("run", "check");

console.log("\n[2/5] Checking test coverage...");
runNpm("run", "test:coverage");

console.log("\n[3/5] Validating agent skills...");
runNpm("run", "skills:validate");

console.log("\n[4/5] Building extension and packaging release ZIP...");
runNpm("run", "package");

const zipName = `not-brother-${version}.zip`;
const uploadZip = path.join(root, "artifacts", zipName);
await access(uploadZip);
const zipStat = await stat(uploadZip);
const zipKb = (zipStat.size / 1024).toFixed(1);

if (skipPages) {
  console.log("\n[5/5] Skipped GitHub Pages verification (--skip-pages).");
} else {
  console.log("\n[5/5] Verifying public legal pages on GitHub Pages...");
  runNpm("run", "verify:pages");
}

console.log("");
console.log("============================================================");
console.log(`✅ Release archive created: artifacts/${zipName} (${zipKb} KB)`);
console.log("============================================================");
console.log("Next steps for publishing:");
console.log("1. Go to the Chrome Web Store Developer Dashboard.");
console.log(`2. Under Package, upload: ${path.relative(root, uploadZip)}`);
console.log("3. Copy the release notes from docs/store-listing.md into the Store listing.");
console.log("4. Submit for review.");
console.log("");
