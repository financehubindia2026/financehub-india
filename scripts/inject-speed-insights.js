#!/usr/bin/env node
/**
 * inject-speed-insights.js
 * -------------------------------------------------------------------------
 * Injects Vercel Speed Insights script into all HTML files in the project.
 * 
 * This script adds the Vercel Speed Insights tracking code just before the 
 * closing </head> tag in all HTML files across the site.
 *
 * Usage:
 *   node scripts/inject-speed-insights.js         # inject into all HTML files
 *   node scripts/inject-speed-insights.js --check # dry-run: report files that
 *                                                 # would change, don't write
 *
 * The script is idempotent — safe to run repeatedly. It will skip files
 * that already have the speed insights script.
 * -------------------------------------------------------------------------
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fg from "fast-glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const isCheckMode = process.argv.includes("--check");

// The speed insights snippet to inject
const SPEED_INSIGHTS_SNIPPET = `  <!-- =====================================================================
       VERCEL SPEED INSIGHTS
       Real-time performance monitoring for Core Web Vitals
  ===================================================================== -->
  <script>
    window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
  </script>
  <script defer src="/_vercel/speed-insights/script.js"></script>

`;

function hasSpeedInsights(content) {
  return content.includes("/_vercel/speed-insights/script.js") || 
         content.includes("window.si = window.si");
}

function injectSpeedInsights(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  
  // Skip if already has speed insights
  if (hasSpeedInsights(original)) {
    return false;
  }

  // Find the closing </head> tag and inject before it
  const headCloseRegex = /(\s*)<\/head>/;
  if (!headCloseRegex.test(original)) {
    console.warn(`  ⚠️  No </head> tag found in ${filePath} — skipped.`);
    return false;
  }

  const updated = original.replace(headCloseRegex, `\n${SPEED_INSIGHTS_SNIPPET}$1</head>`);
  
  const changed = updated !== original;
  if (changed && !isCheckMode) {
    fs.writeFileSync(filePath, updated, "utf8");
  }
  return changed;
}

async function run() {
  console.log("🔍 Finding HTML files...\n");

  // Find all HTML files in the project, excluding node_modules
  const htmlFiles = await fg("**/*.html", {
    cwd: ROOT,
    ignore: ["node_modules/**", ".git/**"],
    absolute: true,
  });

  console.log(`Found ${htmlFiles.length} HTML files\n`);

  let totalChanged = 0;
  let totalSkipped = 0;

  for (const file of htmlFiles) {
    const relativePath = path.relative(ROOT, file);
    const changed = injectSpeedInsights(file);
    
    if (changed) {
      totalChanged++;
      console.log(`  ✓ ${isCheckMode ? "Would update" : "Updated"}: ${relativePath}`);
    } else {
      totalSkipped++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Total files processed: ${htmlFiles.length}`);
  console.log(`${isCheckMode ? "Would update" : "Updated"}: ${totalChanged}`);
  console.log(`Skipped (already has speed insights or no </head>): ${totalSkipped}`);
  console.log(`${"=".repeat(60)}\n`);

  if (isCheckMode && totalChanged > 0) {
    console.log("Run without --check flag to apply changes.");
  } else if (totalChanged > 0) {
    console.log("✅ Vercel Speed Insights has been injected successfully!");
  } else {
    console.log("✅ All files already have Vercel Speed Insights or were skipped.");
  }
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
