import { zipSync } from "fflate";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runNpm } from "./run.mjs";

const root = process.cwd();
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

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const zipName = `not-brother-${packageJson.version}.zip`;
const archive = zipSync(await collect(path.join(root, "dist")), { level: 9 });
await mkdir(path.join(root, "artifacts"), { recursive: true });
await mkdir(path.join(root, "output"), { recursive: true });
const artifactPath = path.join(root, "artifacts", zipName);
const uploadPath = path.join(root, "output", zipName);
await writeFile(artifactPath, archive);
await copyFile(artifactPath, uploadPath);
console.log(`Created ${path.relative(root, artifactPath)}`);
console.log(`Upload copy ${path.relative(root, uploadPath)}`);

