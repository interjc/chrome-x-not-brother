import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const dist = path.join(process.cwd(), "dist");
const required = [
  "manifest.json",
  "service-worker.js",
  "content-script.js",
  "content-script.css",
  "sidepanel.html",
  "sidepanel.js",
  "sidepanel.css",
  "dashboard.html",
  "dashboard.js",
  "dashboard.css",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
  "_locales/en/messages.json",
  "_locales/ja/messages.json",
  "_locales/zh_CN/messages.json",
];

await Promise.all(required.map((file) => access(path.join(dist, file))));

const manifest = JSON.parse(await readFile(path.join(dist, "manifest.json"), "utf8"));
const packageJson = JSON.parse(
  await readFile(path.join(process.cwd(), "package.json"), "utf8"),
);
if (manifest.manifest_version !== 3) {
  throw new Error("dist/manifest.json must use Manifest V3");
}
if (Number(manifest.minimum_chrome_version) < 116) {
  throw new Error("Chrome 116+ is required for user-gesture sidePanel.open support");
}
if (manifest.version !== packageJson.version) {
  throw new Error("package.json and manifest.json versions must match");
}
if (manifest.default_locale !== "en") {
  throw new Error("The localized extension must use English as its fallback locale");
}
const manifestMessageFields = {
  name: "extensionName",
  short_name: "extensionShortName",
  description: "extensionDescription",
};
for (const [field, messageName] of Object.entries(manifestMessageFields)) {
  if (manifest[field] !== `__MSG_${messageName}__`) {
    throw new Error(`Manifest ${field} must reference ${messageName}`);
  }
}
if (manifest.action?.default_title !== "__MSG_actionDefaultTitle__") {
  throw new Error("Manifest toolbar title must be localized");
}
const locales = ["en", "ja", "zh_CN"];
const localeCatalogs = await Promise.all(
  locales.map(async (locale) => JSON.parse(
    await readFile(path.join(dist, "_locales", locale, "messages.json"), "utf8"),
  )),
);
const storeListing = await readFile(
  path.join(process.cwd(), "docs", "store-listing.md"),
  "utf8",
);
const expectedMessageKeys = Object.keys(localeCatalogs[0]).sort();
for (const [index, catalog] of localeCatalogs.entries()) {
  if (JSON.stringify(Object.keys(catalog).sort()) !== JSON.stringify(expectedMessageKeys)) {
    throw new Error(`Locale ${locales[index]} does not have the complete manifest message set`);
  }
  for (const key of expectedMessageKeys) {
    if (typeof catalog[key]?.message !== "string" || catalog[key].message.length === 0) {
      throw new Error(`Locale ${locales[index]} has an invalid ${key} message`);
    }
  }
  if (catalog.extensionDescription.message.length > 132) {
    throw new Error(`Locale ${locales[index]} description exceeds Chrome's 132-character limit`);
  }
  if (!storeListing.includes(`\n${catalog.extensionDescription.message}\n`)) {
    throw new Error(`Locale ${locales[index]} Store summary does not match extensionDescription`);
  }
}
for (const heading of [
  `### Version ${manifest.version} release notes`,
  `### ${manifest.version} 更新说明`,
  `### ${manifest.version} 更新内容`,
]) {
  if (!storeListing.includes(heading)) {
    throw new Error(`Store listing is missing the current release-notes heading: ${heading}`);
  }
}
if (manifest.host_permissions) {
  throw new Error("Host access must come only from the scoped x.com content script match");
}
const matches = manifest.content_scripts?.flatMap((script) => script.matches ?? []) ?? [];
if (matches.length !== 1 || matches[0] !== "https://x.com/*") {
  throw new Error("Content script access must be scoped exactly to https://x.com/*");
}
const forbidden = ["tabs", "scripting", "webRequest", "cookies"];
for (const permission of forbidden) {
  if (manifest.permissions?.includes(permission)) {
    throw new Error(`Forbidden unnecessary permission: ${permission}`);
  }
}
const expectedPermissions = ["sidePanel", "storage"];
const actualPermissions = [...(manifest.permissions ?? [])].sort();
if (JSON.stringify(actualPermissions) !== JSON.stringify(expectedPermissions)) {
  throw new Error("Manifest permissions must be exactly storage and sidePanel");
}
if (
  manifest.background?.service_worker !== "service-worker.js" ||
  manifest.background?.type !== "module"
) {
  throw new Error("Manifest must use the bundled module service worker");
}

const legalFiles = ["terms/privacy.md", "terms/terms.md"];
await Promise.all(legalFiles.map((file) => access(path.join(process.cwd(), file))));
const requiredStoreUrls = [
  "https://github.com/interjc/chrome-x-not-brother",
  "https://github.com/interjc/chrome-x-not-brother/issues",
  "https://github.com/interjc/chrome-x-not-brother/blob/main/terms/privacy.md",
  "https://github.com/interjc/chrome-x-not-brother/blob/main/terms/terms.md",
];
for (const url of requiredStoreUrls) {
  if (!storeListing.includes(url)) {
    throw new Error(`Store listing is missing the public URL: ${url}`);
  }
}
if (packageJson.homepage !== "https://github.com/interjc/chrome-x-not-brother#readme") {
  throw new Error("package.json homepage must point at the GitHub repository");
}
if (packageJson.bugs?.url !== "https://github.com/interjc/chrome-x-not-brother/issues") {
  throw new Error("package.json bugs.url must point at GitHub Issues");
}
console.log("Validated the loadable Manifest V3 extension in dist/.");
