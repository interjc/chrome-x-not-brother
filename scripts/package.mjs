import { zipSync } from "fflate";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { runNpm } from "./run.mjs";
import { toSafariManifest } from "./safari-manifest.mjs";

const root = process.cwd();
const artifactsDir = path.join(root, "artifacts");
const zipPattern = /^not-brother-.+\.zip$/;

runNpm("run", "build");
runNpm("run", "validate:dist");

async function collect(directory, prefix = "") {
  const entries = {};
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, item.name);
    const relative = path.posix.join(prefix, item.name);
    if (item.isDirectory()) Object.assign(entries, await collect(absolute, relative));
    else entries[relative] = new Uint8Array(await readFile(absolute));
  }
  return entries;
}

async function removeOldZips(directory) {
  let names;
  try {
    names = await readdir(directory);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
  for (const name of names) {
    if (zipPattern.test(name)) await unlink(path.join(directory, name));
  }
}

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const files = await collect(path.join(root, "dist"));
const chromeManifest = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
const safariFiles = {
  ...files,
  "manifest.json": new TextEncoder().encode(
    `${JSON.stringify(toSafariManifest(chromeManifest), null, 2)}\n`,
  ),
};
const archives = [
  [`not-brother-${packageJson.version}.zip`, files],
  [`not-brother-safari-${packageJson.version}.zip`, safariFiles],
];
await mkdir(artifactsDir, { recursive: true });
await removeOldZips(artifactsDir);
await removeOldZips(path.join(root, "output"));
for (const [zipName, entries] of archives) {
  const artifactPath = path.join(artifactsDir, zipName);
  await writeFile(artifactPath, zipSync(entries, { level: 9 }));
  console.log(`Created ${path.relative(root, artifactPath)}`);
}
