#!/usr/bin/env node
// monitor.js — Scheduled daily monitor (runs via cron or node-cron)
//
// Usage:
//   node src/monitor.js            # run once immediately
//   node src/monitor.js --cron     # run every morning at 08:00 UK time
//
// Tracks seen OCIDs in data/seen.json so only new tenders are reported.

import chalk from "chalk";
import { schedule } from "node-cron";
import { subDays, format } from "date-fns";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { fetchAll } from "./api.js";
import { filterAndScore } from "./filter.js";
import { exportResults } from "./export.js";
import { config } from "./config.js";

const SEEN_FILE = join(config.dataDir, "seen.json");

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadSeen() {
  ensureDir(config.dataDir);
  if (!existsSync(SEEN_FILE)) return new Set();
  try {
    const raw = JSON.parse(readFileSync(SEEN_FILE, "utf8"));
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function saveSeen(seen) {
  writeFileSync(SEEN_FILE, JSON.stringify([...seen], null, 2), "utf8");
}

async function runCheck() {
  const seen = loadSeen();
  const now  = new Date();

  const publishedFrom = `${format(subDays(now, 2), "yyyy-MM-dd")}T00:00:00`;
  const publishedTo   = now.toISOString();

  console.log(chalk.bold.blue(`\n[${now.toISOString()}] Running tender check…`));

  let allNew = [];

  for await (const batch of fetchAll({
    publishedFrom,
    publishedTo,
    stages: config.defaultStages,
  })) {
    const scored = filterAndScore(batch).filter(
      (t) => t.score >= 3 && !seen.has(t.ocid)
    );
    allNew.push(...scored);
  }

  // Deduplicate within this run
  const byOcid = new Map(allNew.map((t) => [t.ocid, t]));
  const fresh = [...byOcid.values()].sort((a, b) => b.score - a.score);

  if (fresh.length === 0) {
    console.log(chalk.grey("  No new relevant tenders since last check."));
  } else {
    console.log(chalk.green(`  🔔 ${fresh.length} new tender(s)!\n`));

    fresh.forEach((t) => {
      console.log(`  ★${t.score}  [${t.stage}] ${chalk.bold(t.title)}`);
      console.log(`         ${t.buyer}`);
      console.log(`         ${t.url}\n`);

      seen.add(t.ocid);
    });

    const label = format(now, "yyyy-MM-dd_HHmm");
    const { csvPath } = exportResults(fresh, label);
    console.log(chalk.green(`  Saved → ${csvPath}`));
  }

  saveSeen(seen);
  console.log("");
}

// ── Entry point ───────────────────────────────────────────────────────────
const useCron = process.argv.includes("--cron");

if (useCron) {
  console.log(chalk.bold.blue("Solirius Contracts Monitor — running daily at 08:00…"));
  // Every weekday at 08:00
  schedule("0 8 * * 1-5", runCheck, { timezone: "Europe/London" });
  // Also run immediately on start
  runCheck();
} else {
  runCheck();
}
