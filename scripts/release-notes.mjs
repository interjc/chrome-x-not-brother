import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SAFARI_INSTALL_URL =
  "https://github.com/interjc/chrome-x-not-brother/blob/main/README.en.md#safari";

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

export function releaseBody(notes) {
  return [
    notes,
    "",
    "## Downloads",
    "",
    "- `not-brother-<version>.zip`: the Chrome package, built from the same commit as the Chrome Web Store upload.",
    "  Chrome users should install from the Chrome Web Store.",
    "- `not-brother-safari-app-<version>.zip`: signed and notarized macOS app for Safari 18.4+ (attached a few minutes later when signing is configured).",
    "- `not-brother-safari-<version>.zip`: unsigned extension folder for Safari's temporary-extension loader.",
    "",
    "The Safari packages are rebuilt on every change to main and replaced here until the next version; the Chrome package stays as first published.",
    "",
    `Safari builds are a community channel without App Store review or auto-update. See [Safari install guide](${SAFARI_INSTALL_URL}).`,
    "",
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!version) throw new Error("Usage: node scripts/release-notes.mjs <version>");
  const storeListing = await readFile(
    path.join(process.cwd(), "docs", "store-listing.md"),
    "utf8",
  );
  process.stdout.write(
    releaseBody(extractReleaseNotes(storeListing, version)).replaceAll("<version>", version),
  );
}
