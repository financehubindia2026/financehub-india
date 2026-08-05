#!/usr/bin/env node
/**
 * inject-analytics.js
 * -------------------------------------------------------------------------
 * Injects Vercel Web Analytics script into all HTML files in the project.
 * 
 * This script adds the Vercel Analytics tracking code just before the 
 * closing </head> tag in all HTML files across the site.
 *
 * Usage:
 *   node scripts/inject-analytics.js         # inject into all HTML files
 *   node scripts/inject-analytics.js --check # dry-run: report files that
 *                                            # would change, don't write
 *
 * The script is idempotent — safe to run repeatedly. It will skip files
 * that already have the analytics script.
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

// The analytics snippet to inject
const ANALYTICS_SNIPPET = `  <!-- =====================================================================
       VERCEL WEB ANALYTICS
       Privacy-friendly, real-time traffic insights
  ===================================================================== -->
  <script>
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  </script>
  <script defer src="/_vercel/insights/script.js"></script>

`;

function hasAnalytics(content) {
  return content.includes("/_vercel/insights/script.js") || 
         content.includes("window.va = window.va");
}

function injectAnalytics(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  
  // Skip if already has analytics
  if (hasAnalytics(original)) {
    return false;
  }

  // Find the closing </head> tag and inject before it
  const headCloseRegex = /(\s*)<\/head>/;
  if (!headCloseRegex.test(original)) {
    console.warn(`  ⚠️  No </head> tag found in ${filePath} — skipped.`);
    return false;
  }

  const updated = original.replace(headCloseRegex, `\n${ANALYTICS_SNIPPET}$1</head>`);
  
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
    const changed = injectAnalytics(file);
    
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
  console.log(`Skipped (already has analytics or no </head>): ${totalSkipped}`);
  console.log(`${"=".repeat(60)}\n`);

  if (isCheckMode && totalChanged > 0) {
    console.log("Run without --check flag to apply changes.");
  } else if (totalChanged > 0) {
    console.log("✅ Vercel Analytics has been injected successfully!");
  } else {
    console.log("✅ All files already have Vercel Analytics or were skipped.");
  }
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
