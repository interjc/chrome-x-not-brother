import { context } from "esbuild";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dist = path.join(root, "dist");
const watch = process.argv.includes("--watch");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, "public"), dist, { recursive: true });

const shared = {
  bundle: true,
  sourcemap: watch,
  minify: !watch,
  target: "chrome114",
  logLevel: "info",
  assetNames: "assets/[name]-[hash]",
  loader: {
    ".woff2": "file",
  },
};

const builds = [
  {
    entryPoints: ["src/background/service-worker.ts"],
    outfile: "dist/service-worker.js",
    format: "esm",
  },
  {
    entryPoints: ["src/content/index.ts"],
    outfile: "dist/content-script.js",
    format: "iife",
  },
  {
    entryPoints: ["src/ui/sidepanel.tsx"],
    outfile: "dist/sidepanel.js",
    format: "esm",
  },
  {
    entryPoints: ["src/ui/dashboard.tsx"],
    outfile: "dist/dashboard.js",
    format: "esm",
  },
];

const contexts = await Promise.all(
  builds.map((build) => context({ ...shared, ...build })),
);

if (watch) {
  await Promise.all(contexts.map((buildContext) => buildContext.watch()));
  console.log("Watching extension sources. Reload dist/ from chrome://extensions after changes.");
} else {
  await Promise.all(contexts.map((buildContext) => buildContext.rebuild()));
  await Promise.all(contexts.map((buildContext) => buildContext.dispose()));
  const output = await readdir(dist);
  console.log(`Built ${output.length} top-level artifacts in dist/.`);
}

