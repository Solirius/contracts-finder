#!/usr/bin/env node
// monitor.js — daily cron job, alerts on new notices only
import cron from "node-cron";
import chalk from "chalk";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fetchAllNotices } from "./api.js";
import { scoreRelease, extractFields } from "./filter.js";
import { writeResults } from "./export.js";
import { config } from "./config.js";

const SEEN_FILE = "./output/.seen-notices.json";

function loadSeen() {
  if (!existsSync(SEEN_FILE)) return new Set();
  return new Set(JSON.parse(readFileSync(SEEN_FILE, "utf8")));
}

function saveSeen(seen) {
  writeFileSync(SEEN_FILE, JSON.stringify([...seen]), "utf8");
}

async function runCheck() {
  console.log(chalk.bold(`\n[${new Date().toISOString()}] Running daily tender check...`));
  const seen = loadSeen();
  const newResults = [];
  let total = 0;

  for await (const { release, source } of fetchAllNotices({
    days: 2, // only look back 2 days in monitor mode
    stages: config.stages,
  })) {
    total++;
    const key = `${source}::${release.id ?? release.ocid}`;
    if (seen.has(key)) continue;

    const { score, matched } = scoreRelease(release);
    if (score >= config.minScore) {
      const fields = extractFields(release, source);
      newResults.push({ ...fields, score, matched });
      seen.add(key);
    }
  }

  saveSeen(seen);

  if (newResults.length === 0) {
    console.log(chalk.gray(`Scanned ${total} notices. Nothing new above threshold.`));
    return;
  }

  const { csvPath } = writeResults(newResults);
  console.log(chalk.bold.green(`\n${newResults.length} new tender(s) found!`));
  newResults.forEach((r) =>
    console.log(
      `  ${chalk.cyan(`[${r.source}]`)} score=${r.score} — ${r.title.slice(0, 70)}`
    )
  );
  console.log(`\n  → ${csvPath}`);
}

const args = process.argv.slice(2);

if (args.includes("--cron")) {
  // Run at 08:00 every weekday
  console.log(chalk.blue("Monitor started — will run at 08:00 Mon-Fri"));
  cron.schedule("0 8 * * 1-5", runCheck);
} else {
  // Run once immediately
  await runCheck();
}
