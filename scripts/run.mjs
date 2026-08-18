import { spawnSync } from "node:child_process";
import process from "node:process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

export function runNpm(...args) {
  const result = spawnSync(npm, args, { cwd: process.cwd(), stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
