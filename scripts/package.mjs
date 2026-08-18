import { zipSync } from "fflate";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
for (const script of ["build", "validate:dist"]) {
  const result = spawnSync(npm, ["run", script], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

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
await mkdir(path.join(root, "artifacts"), { recursive: true });
const output = path.join(root, "artifacts", `not-brother-${packageJson.version}.zip`);
await writeFile(output, zipSync(await collect(path.join(root, "dist")), { level: 9 }));
console.log(`Created ${path.relative(root, output)}`);

