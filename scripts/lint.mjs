#!/usr/bin/env node
// Dependency-free lint pass:
//   - server/api/*.js : `node --check` (ESM syntax + parse validation)
//   - client/**/*.jsx : esbuild transform (JSX syntax validation)
// Exits non-zero when any file fails to parse.

import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { transform } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));

function walk(dir, exts) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      out.push(...walk(full, exts));
    } else if (exts.includes(entry.name.slice(entry.name.lastIndexOf(".")))) {
      out.push(full);
    }
  }
  return out;
}

const errors = [];

const serverFiles = [
  ...walk(join(root, "server", "src"), [".js"]),
  ...walk(join(root, "server", "test"), [".js"]),
  ...walk(join(root, "api"), [".js"]),
  ...walk(join(root, "scripts"), [".mjs"]),
];

for (const file of serverFiles) {
  const res = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (res.status !== 0) {
    errors.push({ file: relative(root, file), detail: (res.stderr || res.stdout || "").trim() });
  }
}

const clientFiles = [
  ...walk(join(root, "client", "src"), [".js", ".jsx"]),
  join(root, "client", "vite.config.js"),
].filter((f) => !f.endsWith("undefined"));

for (const file of clientFiles) {
  try {
    await transform(readFileSync(file, "utf8"), {
      loader: file.endsWith(".jsx") ? "jsx" : "js",
      jsx: "automatic",
      sourcefile: file,
    });
  } catch (err) {
    errors.push({ file: relative(root, file), detail: String(err.message || err).trim() });
  }
}

const checked = serverFiles.length + clientFiles.length;

if (errors.length) {
  for (const e of errors) {
    console.error(`\n✖ ${e.file}\n${e.detail}`);
  }
  console.error(`\nlint failed: ${errors.length}/${checked} files with syntax errors`);
  process.exit(1);
}

console.log(`lint passed: ${checked} files checked`);
