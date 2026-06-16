#!/usr/bin/env node
// push-to-jira.js — Search all sources and push new tenders to Jira KAN board
//
// Usage:
//   npm run jira                                 # last 30 days, planning + tender
//   npm run jira -- --days 7                     # last 7 days
//   npm run jira -- --stages tender              # live tenders only
//   npm run jira -- --min-score 5                # only high-relevance results
//   npm run jira -- --dry-run                    # preview without creating issues

import { readFileSync } from "fs";
import chalk from "chalk";
import { fetchAllNotices } from "./api.js";
import { scoreRelease, extractFields } from "./filter.js";
import { config } from "./config.js";
import { createJiraIssue, loadPushedCache, savePushedCache } from "./jira.js";

// ── Load .env ─────────────────────────────────────────────────────────────────
try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0 && !line.startsWith("#")) {
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key && !(key in process.env)) process.env[key] = val;
    }
  }
} catch { /* no .env — env vars must be set externally */ }

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const days      = parseInt(getArg("--days") ?? config.defaultDays, 10);
const stagesArg = getArg("--stages");
const minScore  = parseInt(getArg("--min-score") ?? config.minScore, 10);
const dryRun    = args.includes("--dry-run");

const stages = stagesArg ? stagesArg.split(",") : config.stages;

// ── Banner ────────────────────────────────────────────────────────────────────
console.log(chalk.bold.blue("\nSolirius Data & AI — Tender -> Jira Push"));
console.log(chalk.gray(`Sources: ${Object.values(config.sources).filter((s) => s.enabled).map((s) => s.label).join(", ")}`));
console.log(chalk.gray(`Window: last ${days} days | Stages: ${stages.join(", ")} | Min score: ${minScore}`));
if (dryRun) console.log(chalk.yellow("  DRY RUN — no Jira issues will be created"));
console.log("");

// ── Fetch + filter ────────────────────────────────────────────────────────────
const allScored = [];
let total = 0;

try {
  for await (const { release, source } of fetchAllNotices({ days, stages })) {
    total++;
    const { score, matched } = scoreRelease(release);
    if (score >= minScore) {
      const fields = extractFields(release, source);
      allScored.push({ ...fields, score, matched });
    }
  }
} catch (err) {
  console.error(chalk.red(`\nError fetching notices: ${err.message}`));
  process.exit(1);
}

console.log(chalk.gray(`\nScanned ${total} notices, ${allScored.length} above threshold.`));

if (allScored.length === 0) {
  console.log(chalk.yellow("  No relevant tenders found. Nothing to push."));
  process.exit(0);
}

allScored.sort((a, b) => b.score - a.score);

// ── Dedup against already-pushed cache ───────────────────────────────────────
const cache = loadPushedCache();
const newTenders = allScored.filter((t) => !cache[t.ocid]);
const skipped    = allScored.length - newTenders.length;

console.log(
  chalk.bold(`  ${allScored.length} relevant tender(s) — `) +
  chalk.green(`${newTenders.length} new`) +
  chalk.gray(`, ${skipped} already in Jira\n`)
);

if (newTenders.length === 0) {
  console.log(chalk.green("  Board is already up to date."));
  process.exit(0);
}

// ── Push to Jira ──────────────────────────────────────────────────────────────
let pushed = 0;
let failed = 0;

for (const tender of newTenders) {
  const scoreColor = tender.score >= 8 ? chalk.green : tender.score >= 5 ? chalk.yellow : chalk.gray;
  const prefix     = `  ${scoreColor(`*${tender.score}`)}  [${tender.source}] ${tender.title.slice(0, 55).padEnd(55)}`;

  if (dryRun) {
    console.log(`${prefix}  ${chalk.gray("[dry-run]")}`);
    continue;
  }

  try {
    const { key } = await createJiraIssue(tender);
    cache[tender.ocid] = key;
    pushed++;
    console.log(`${prefix}  → ${chalk.green.bold(key)}`);
  } catch (err) {
    failed++;
    console.log(`${prefix}  → ${chalk.red(`FAILED: ${err.message}`)}`);
  }
}

// ── Save cache + summary ──────────────────────────────────────────────────────
if (!dryRun) {
  savePushedCache(cache);
  console.log("");
  if (pushed)  console.log(chalk.green(`  ${pushed} issue(s) created in Jira`));
  if (failed)  console.log(chalk.red(`  ${failed} issue(s) failed`));
  if (skipped) console.log(chalk.gray(`    ${skipped} skipped (already existed)`));
}
console.log("");
