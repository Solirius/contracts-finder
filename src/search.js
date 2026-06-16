#!/usr/bin/env node
// search.js — one-shot search across all enabled sources
import chalk from "chalk";
import { fetchAllNotices } from "./api.js";
import { scoreRelease, extractFields } from "./filter.js";
import { writeResults } from "./export.js";
import { config } from "./config.js";

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const days = parseInt(getArg("--days") ?? config.defaultDays, 10);
const minScore = parseInt(getArg("--min-score") ?? config.minScore, 10);
const stagesArg = getArg("--stages");
const stages = stagesArg ? stagesArg.split(",") : config.stages;

// ── Run ───────────────────────────────────────────────────────────────────────
console.log(chalk.bold.blue("\nSolirius Data & AI — Tender Monitor"));
console.log(
  chalk.gray(
    `Sources: ${Object.values(config.sources)
      .filter((s) => s.enabled)
      .map((s) => s.label)
      .join(", ")}`
  )
);
console.log(chalk.gray(`Window: last ${days} days | Stages: ${stages.join(", ")} | Min score: ${minScore}`));

const results = [];
let total = 0;

try {
  for await (const { release, source } of fetchAllNotices({ days, stages })) {
    total++;
    const { score, matched } = scoreRelease(release);
    if (score >= minScore) {
      const fields = extractFields(release, source);
      results.push({ ...fields, score, matched });
      process.stdout.write(
        chalk.green(`  + [${source}] score=${score} — ${fields.title.slice(0, 60)}\n`)
      );
    }
  }

  console.log(chalk.gray(`\nScanned ${total} notices, ${results.length} above threshold.`));

  if (results.length === 0) {
    console.log(chalk.yellow("No results matched. Try lowering --min-score or extending --days."));
    process.exit(0);
  }

  const { csvPath, jsonPath } = writeResults(results);
  console.log(chalk.bold.green(`\nDone`));
  console.log(`   CSV  → ${csvPath}`);
  console.log(`   JSON → ${jsonPath}`);
} catch (err) {
  console.error(chalk.red(`\nError: ${err.message}`));
  process.exit(1);
}
