import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const bump = process.argv[2];
if (!bump) {
  console.error("Usage: node scripts/bump-version.mjs <patch|minor|major|x.y.z>");
  process.exit(1);
}

const packagePath = path.join(root, "package.json");
const manifestPath = path.join(root, "public", "manifest.json");
const listingPath = path.join(root, "docs", "store-listing.md");

const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const current = packageJson.version;
const next = nextVersion(current, bump);
if (next === current) {
  throw new Error(`Version is already ${current}`);
}

packageJson.version = next;
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.version = next;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

let listing = await readFile(listingPath, "utf8");
listing = insertReleaseNotes(listing, current, next);
await writeFile(listingPath, listing);

console.log(`Bumped ${current} → ${next}`);
console.log("Fill the new bullets in docs/store-listing.md, then run npm run release.");

function nextVersion(version, kind) {
  if (/^\d+\.\d+\.\d+$/.test(kind)) return kind;
  const [major, minor, patch] = version.split(".").map(Number);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  if (kind === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown version argument: ${kind}`);
}

function insertReleaseNotes(source, previous, version) {
  const blocks = [
    {
      next: `### Version ${version} release notes`,
      previous: `### Version ${previous} release notes\n`,
      insert: `### Version ${version} release notes\n\n- \n\n`,
    },
    {
      next: `### ${version} 更新说明`,
      previous: `### ${previous} 更新说明\n`,
      insert: `### ${version} 更新说明\n\n- \n\n`,
    },
    {
      next: `### ${version} 更新内容`,
      previous: `### ${previous} 更新内容\n`,
      insert: `### ${version} 更新内容\n\n- \n\n`,
    },
  ];
  let next = source;
  for (const block of blocks) {
    if (next.includes(block.next)) continue;
    if (!next.includes(block.previous)) {
      throw new Error(`store-listing.md is missing the previous heading: ${block.previous.trim()}`);
    }
    next = next.replace(block.previous, `${block.insert}${block.previous}`);
  }
  return next;
}
