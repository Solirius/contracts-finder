// export.js — Write results to CSV and JSON

import { stringify } from "csv-stringify/sync";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { config } from "./config.js";

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Write scored tenders to CSV and JSON.
 * @param {ScoredRelease[]} tenders
 * @param {string} [label]  e.g. "2024-11-15"
 * @returns {{ csvPath: string, jsonPath: string }}
 */
export function exportResults(tenders, label) {
  ensureDir(config.outputDir);

  const slug = label ?? new Date().toISOString().slice(0, 10);
  const csvPath  = join(config.outputDir, `tenders_${slug}.csv`);
  const jsonPath = join(config.outputDir, `tenders_${slug}.json`);

  // ── JSON ─────────────────────────────────────────────────────────────────
  writeFileSync(jsonPath, JSON.stringify(tenders, null, 2), "utf8");

  // ── CSV ──────────────────────────────────────────────────────────────────
  const rows = tenders.map((t) => ({
    Score:            t.score,
    Stage:            t.stage,
    Title:            t.title,
    Buyer:            t.buyer,
    Value:            t.value != null ? `${t.currency} ${t.value.toLocaleString()}` : "",
    Deadline:         t.deadline ?? "",
    Published:        t.publishedDate ?? "",
    Keywords:         t.matchedKeywords.join("; "),
    Description:      t.description,
    URL:              t.url,
    OCID:             t.ocid,
  }));

  const csv = stringify(rows, { header: true });
  writeFileSync(csvPath, csv, "utf8");

  return { csvPath, jsonPath };
}
