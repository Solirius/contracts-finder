#!/usr/bin/env node
// search.js — One-shot Contracts Finder tender search
//
// Usage:
//   node src/search.js                         # last 30 days, planning + tender
//   node src/search.js --days 7                # last 7 days
//   node src/search.js --from 2024-10-01       # from a specific date
//   node src/search.js --stages tender         # live tenders only
//   node src/search.js --min-score 5           # only high-relevance results

import chalk from "chalk";
import { subDays, format, parseISO } from "date-fns";
import { fetchAll } from "./api.js";
import { filterAndScore } from "./filter.js";
import { exportResults } from "./export.js";
import { config } from "./config.js";

// ── Parse CLI args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag, def) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : def;
};

const days      = parseInt(getArg("--days", config.defaultLookbackDays));
const fromArg   = getArg("--from", null);
const toArg     = getArg("--to",   null);
const stagesArg = getArg("--stages", null);
const minScore  = parseInt(getArg("--min-score", "1"));
const quiet     = args.includes("--quiet");

const stages = stagesArg ? stagesArg.split(",") : config.defaultStages;

const now = new Date();
const publishedFrom = fromArg
  ? `${fromArg}T00:00:00`
  : `${format(subDays(now, days), "yyyy-MM-dd")}T00:00:00`;
const publishedTo = toArg ? `${toArg}T23:59:59` : now.toISOString();

// ── Banner ────────────────────────────────────────────────────────────────
if (!quiet) {
  console.log("");
  console.log(chalk.bold.blue("┌─────────────────────────────────────────────────┐"));
  console.log(chalk.bold.blue("│  Solirius · Contracts Finder Tender Monitor      │"));
  console.log(chalk.bold.blue("└─────────────────────────────────────────────────┘"));
  console.log(chalk.grey(`  From   : ${publishedFrom}`));
  console.log(chalk.grey(`  To     : ${publishedTo}`));
  console.log(chalk.grey(`  Stages : ${stages.join(", ")}`));
  console.log(chalk.grey(`  Filter : score ≥ ${minScore}`));
  console.log("");
}

// ── Fetch + filter ────────────────────────────────────────────────────────
let allRaw = 0;
let allScored = [];

const spinner = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
let tick = 0;

for await (const batch of fetchAll({ publishedFrom, publishedTo, stages }, (n) => {
  if (!quiet) {
    process.stdout.write(`\r  ${chalk.cyan(spinner[tick++ % spinner.length])}  Fetched ${n} notices...`);
  }
})) {
  allRaw += batch.length;
  const scored = filterAndScore(batch).filter((t) => t.score >= minScore);
  allScored.push(...scored);
}

// Re-sort across all pages
allScored.sort((a, b) => b.score - a.score);

if (!quiet) {
  process.stdout.write(`\r  ✓  Fetched ${allRaw} total notices.           \n\n`);
}

// ── Print results ─────────────────────────────────────────────────────────
if (allScored.length === 0) {
  console.log(chalk.yellow("  No relevant tenders found for this period."));
} else {
  console.log(chalk.bold(`  ${allScored.length} relevant tender(s) found:\n`));

  allScored.forEach((t, i) => {
    const scoreColor = t.score >= 8 ? chalk.green : t.score >= 5 ? chalk.yellow : chalk.grey;
    const stageTag = t.stage === "planning"
      ? chalk.blue("[FUTURE]")
      : t.stage === "tender"
      ? chalk.magenta("[LIVE]  ")
      : chalk.grey(`[${t.stage.toUpperCase()}]`);

    console.log(
      `  ${chalk.bold(`${i + 1}.`)} ${stageTag} ${scoreColor(`★${t.score}`)}  ${chalk.bold(t.title)}`
    );
    console.log(`     ${chalk.cyan("Buyer    :")} ${t.buyer}`);
    if (t.value) {
      console.log(`     ${chalk.cyan("Value    :")} ${t.currency} ${t.value.toLocaleString()}`);
    }
    if (t.deadline) {
      console.log(`     ${chalk.cyan("Deadline :")} ${t.deadline.slice(0, 10)}`);
    }
    console.log(`     ${chalk.cyan("Keywords :")} ${t.matchedKeywords.slice(0, 6).join(", ")}`);
    console.log(`     ${chalk.cyan("URL      :")} ${t.url}`);
    if (t.description) {
      const snippet = t.description.length > 120
        ? t.description.slice(0, 120) + "…"
        : t.description;
      console.log(`     ${chalk.grey(snippet)}`);
    }
    console.log("");
  });
}

// ── Export ────────────────────────────────────────────────────────────────
if (allScored.length > 0) {
  const label = format(now, "yyyy-MM-dd");
  const { csvPath, jsonPath } = exportResults(allScored, label);
  console.log(chalk.bold.green(`  ✓ Saved to:`));
  console.log(`    CSV  → ${csvPath}`);
  console.log(`    JSON → ${jsonPath}`);
  console.log("");
}
