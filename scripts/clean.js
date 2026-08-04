#!/usr/bin/env node
/**
 * scripts/clean.js — npm run clean
 * Removes only files that `publish` generated (tracked in
 * generated/.manifest.json from the last run) plus the build cache.
 * Never touches content/, partials/, css/, js/, or hand-authored pages.
 */
import fs from "fs";
import path from "path";
import { PATHS, ROOT } from "./lib/config.js";

let manifest = [];
try {
  manifest = JSON.parse(fs.readFileSync(PATHS.manifestFile, "utf8"));
} catch {
  console.log("No generated/.manifest.json found — nothing to clean (run `npm run publish` at least once first).");
  process.exit(0);
}

let removed = 0;
for (const rel of manifest) {
  if (rel.includes("(updated in place)")) continue; // index.html is edited, not deleted
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) {
    fs.rmSync(full);
    removed++;
  }
}

try {
  fs.rmSync(PATHS.cacheFile);
} catch {}
try {
  fs.rmSync(PATHS.manifestFile);
} catch {}

console.log(`\n✔ Removed ${removed} generated file(s) and the build cache.\n`);
