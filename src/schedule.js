#!/usr/bin/env node
// schedule.js — Daily 8am multi-source → Jira push daemon
//
// Usage:
//   npm run schedule           # start daemon, runs daily at 08:00 UK time
//   npm run schedule -- --now  # run once immediately (used by launchd)

import { readFileSync } from "fs";
import chalk from "chalk";
import { schedule } from "node-cron";
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

// ── Core scan + push ──────────────────────────────────────────────────────────
async function runJiraPush() {
  console.log(chalk.bold.blue(`\n[${new Date().toISOString()}] Multi-source → Jira push starting…`));

  const allScored = [];

  try {
    for await (const { release, source } of fetchAllNotices({
      days: 2,
      stages: config.stages,
    })) {
      const { score, matched } = scoreRelease(release);
      if (score >= config.minScore) {
        const fields = extractFields(release, source);
        allScored.push({ ...fields, score, matched });
      }
    }
  } catch (err) {
    console.error(chalk.red(`Error fetching notices: ${err.message}`));
    return;
  }

  allScored.sort((a, b) => b.score - a.score);

  const cache      = loadPushedCache();
  const newTenders = allScored.filter((t) => !cache[t.ocid]);

  if (newTenders.length === 0) {
    console.log(chalk.gray("  No new relevant tenders. Nothing to push.\n"));
    return;
  }

  console.log(chalk.bold(`  ${newTenders.length} new tender(s):\n`));

  let pushed = 0;
  let failed = 0;

  for (const tender of newTenders) {
    const scoreColor = tender.score >= 8 ? chalk.green : tender.score >= 5 ? chalk.yellow : chalk.gray;
    const prefix = `  ${scoreColor(`*${tender.score}`)}  [${tender.source}] ${tender.title.slice(0, 55).padEnd(55)}`;

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

  savePushedCache(cache);
  console.log("");
  if (pushed) console.log(chalk.green(`  ${pushed} issue(s) created in Jira`));
  if (failed) console.log(chalk.red(`  ${failed} issue(s) failed`));
  console.log("");
}

// ── Entry point ───────────────────────────────────────────────────────────────
if (process.argv.includes("--now")) {
  await runJiraPush();
} else {
  console.log(chalk.bold.blue("Solirius Contracts Finder — daily Jira push at 08:00 UK time"));
  console.log(chalk.gray("  Tip: run with --now to execute immediately\n"));
  await runJiraPush();
  schedule("0 10 * * 1-5", runJiraPush, { timezone: "Europe/London" });
}
