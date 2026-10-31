import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const INSTALL_URL =
  "https://github.com/interjc/chrome-x-not-brother/blob/main/README.en.md#install";
const INSTALL_URL_ZH =
  "https://github.com/interjc/chrome-x-not-brother/blob/main/README.md#%E5%AE%89%E8%A3%85";
const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/dioanbgbpklflgochbljdehpjidckgfd";

// Every file a Release carries, in the order a visitor should read them.
// GitHub compares asset names case-insensitively, so names must differ by more
// than case. The label is what the Release page shows instead of the name.
export function releaseAssets(version) {
  return [
    {
      kind: "safari-app",
      name: `not-brother-safari-app-${version}.zip`,
      label: `Safari (Mac): app, download this (not-brother-safari-app-${version}.zip)`,
      what: "Signed, notarized Mac app that installs the Safari extension (Safari 18.4+)",
      who: "**Safari users: download this one**",
    },
    {
      kind: "chrome",
      name: `not-brother-${version}.zip`,
      label: `Chrome: offline install, same package as the Chrome Web Store (not-brother-${version}.zip)`,
      what: "The Chrome extension package, identical to the Chrome Web Store upload",
      who: `Chrome users who cannot use the [Chrome Web Store](${CHROME_STORE_URL}): unzip and choose Load unpacked (see the install guide)`,
    },
    {
      kind: "safari-folder",
      name: `not-brother-safari-${version}.zip`,
      label: `Safari: unsigned extension folder for temporary loading (not-brother-safari-${version}.zip)`,
      what: "Unsigned Safari extension folder, removed when Safari quits",
      who: "Developers and testers using Safari's Add Temporary Extension",
    },
  ];
}

export function assetLabel(name) {
  const version = name.match(/-(\d+\.\d+\.\d+)\.zip$/)?.[1];
  const asset = version && releaseAssets(version).find((entry) => entry.name === name);
  if (!asset) throw new Error(`Unknown release asset: ${name}`);
  return asset.label;
}

// Pull one version's English release notes out of docs/store-listing.md.
export function extractReleaseNotes(storeListing, version) {
  const heading = `### Version ${version} release notes`;
  const start = storeListing.indexOf(heading);
  if (start === -1) throw new Error(`docs/store-listing.md is missing "${heading}"`);
  const body = storeListing.slice(start + heading.length);
  const end = body.search(/\n#{2,3} /);
  const notes = (end === -1 ? body : body.slice(0, end)).trim();
  if (!notes) throw new Error(`Release notes for ${version} are empty`);
  return notes;
}

export function releaseBody(notes, version) {
  return [
    notes,
    "",
    "## Which file do I need?",
    "",
    "| File | What it is | Who it is for |",
    "| --- | --- | --- |",
    ...releaseAssets(version).map(
      (asset) => `| \`${asset.name}\` | ${asset.what} | ${asset.who} |`,
    ),
    "",
    "The two **Source code** archives that GitHub adds below are snapshots of the repository, not installers.",
    "",
    `Install guide: [English](${INSTALL_URL}) · [简体中文](${INSTALL_URL_ZH}). Offline Chrome installs and Safari builds do not update themselves, and Safari builds do not go through App Store review. The Safari files are rebuilt on every change to main and replaced here until the next version; the Chrome package stays as first published.`,
    "",
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [flag, value] = process.argv.slice(2);
  if (flag === "--label") {
    if (!value) throw new Error("Usage: node scripts/release-notes.mjs --label <asset file name>");
    process.stdout.write(assetLabel(value));
  } else {
    const version = flag;
    if (!version) throw new Error("Usage: node scripts/release-notes.mjs <version>");
    const storeListing = await readFile(
      path.join(process.cwd(), "docs", "store-listing.md"),
      "utf8",
    );
    process.stdout.write(releaseBody(extractReleaseNotes(storeListing, version), version));
  }
}
