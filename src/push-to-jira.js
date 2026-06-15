#!/usr/bin/env node
// push-to-jira.js — Search Contracts Finder and push new tenders to Jira KAN board
//
// Usage:
//   npm run jira                                 # last 30 days, planning + tender
//   npm run jira -- --days 7                     # last 7 days
//   npm run jira -- --stages tender              # live tenders only
//   npm run jira -- --min-score 5                # only high-relevance results
//   npm run jira -- --dry-run                    # preview without creating issues

import { readFileSync } from "fs";
import chalk from "chalk";
import { subDays, format } from "date-fns";
import { fetchAll } from "./api.js";
import { filterAndScore } from "./filter.js";
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
const getArg = (flag, def) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : def;
};

const days      = parseInt(getArg("--days", String(config.defaultLookbackDays)));
const fromArg   = getArg("--from", null);
const toArg     = getArg("--to", null);
const stagesArg = getArg("--stages", null);
const minScore  = parseInt(getArg("--min-score", "3"));
const dryRun    = args.includes("--dry-run");

const stages = stagesArg ? stagesArg.split(",") : config.defaultStages;
const now = new Date();
const publishedFrom = fromArg
  ? `${fromArg}T00:00:00`
  : `${format(subDays(now, days), "yyyy-MM-dd")}T00:00:00`;
const publishedTo = toArg ? `${toArg}T23:59:59` : now.toISOString();

// ── Banner ────────────────────────────────────────────────────────────────────
console.log("");
console.log(chalk.bold.blue("┌─────────────────────────────────────────────────┐"));
console.log(chalk.bold.blue("│  Solirius · Contracts Finder → Jira Push        │"));
console.log(chalk.bold.blue("└─────────────────────────────────────────────────┘"));
console.log(chalk.grey(`  From      : ${publishedFrom}`));
console.log(chalk.grey(`  To        : ${publishedTo}`));
console.log(chalk.grey(`  Stages    : ${stages.join(", ")}`));
console.log(chalk.grey(`  Min score : ${minScore}`));
if (dryRun) console.log(chalk.yellow("  DRY RUN   : no Jira issues will be created"));
console.log("");

// ── Fetch + filter ────────────────────────────────────────────────────────────
const spinner = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
let tick = 0;
let allRaw = 0;
let allScored = [];

for await (const batch of fetchAll({ publishedFrom, publishedTo, stages }, (n) => {
  process.stdout.write(
    `\r  ${chalk.cyan(spinner[tick++ % spinner.length])}  Fetched ${n} notices...`
  );
})) {
  allRaw += batch.length;
  allScored.push(...filterAndScore(batch).filter((t) => t.score >= minScore));
}
allScored.sort((a, b) => b.score - a.score);

process.stdout.write(`\r  ✓  Fetched ${allRaw} total notices.           \n\n`);

if (allScored.length === 0) {
  console.log(chalk.yellow("  No relevant tenders found. Nothing to push."));
  process.exit(0);
}

// ── Dedup against already-pushed cache ───────────────────────────────────────
const cache = loadPushedCache();
const newTenders = allScored.filter((t) => !cache[t.ocid]);
const skipped    = allScored.length - newTenders.length;

console.log(
  chalk.bold(`  ${allScored.length} relevant tender(s) — `) +
  chalk.green(`${newTenders.length} new`) +
  chalk.grey(`, ${skipped} already in Jira\n`)
);

if (newTenders.length === 0) {
  console.log(chalk.green("  Board is already up to date."));
  process.exit(0);
}

// ── Push to Jira ──────────────────────────────────────────────────────────────
let pushed = 0;
let failed = 0;

for (const tender of newTenders) {
  const scoreColor = tender.score >= 8 ? chalk.green : tender.score >= 5 ? chalk.yellow : chalk.grey;
  const prefix     = `  ${scoreColor(`★${tender.score}`)}  ${tender.title.slice(0, 65).padEnd(65)}`;

  if (dryRun) {
    console.log(`${prefix}  ${chalk.grey("[dry-run]")}`);
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
  if (pushed)  console.log(chalk.green(`  ✓ ${pushed} issue(s) created in Jira`));
  if (failed)  console.log(chalk.red(`  ✗ ${failed} issue(s) failed`));
  if (skipped) console.log(chalk.grey(`    ${skipped} skipped (already existed)`));
}
console.log("");
