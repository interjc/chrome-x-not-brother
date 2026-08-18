import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { readFile } from "node:fs/promises";
import { runNpm } from "./run.mjs";

const skipPages = process.argv.includes("--skip-pages");
const root = process.cwd();

runNpm("run", "check");
runNpm("run", "test:coverage");
runNpm("run", "skills:validate");
runNpm("run", "package");

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const zipName = `not-brother-${packageJson.version}.zip`;
const uploadZip = path.join(root, "output", zipName);
await access(uploadZip);

if (skipPages) {
  console.log("Skipped GitHub Pages verification.");
} else {
  runNpm("run", "verify:pages");
}

console.log("");
console.log("Release archive is ready.");
console.log(`Upload this file to the Chrome Web Store: ${path.relative(root, uploadZip)}`);
console.log("Then update the Dashboard package, listing release notes, and submit for review.");
