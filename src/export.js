// export.js — writes results to CSV and JSON
import { stringify } from "csv-stringify/sync";
import { writeFileSync, mkdirSync } from "fs";
import { format } from "date-fns";
import { join } from "path";

const OUTPUT_DIR = "./output";

export function writeResults(results) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const timestamp = format(new Date(), "yyyyMMdd-HHmm");

  // Sort by score desc, then by published date desc
  const sorted = [...results].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.published ?? "").localeCompare(a.published ?? "");
  });

  // JSON
  const jsonPath = join(OUTPUT_DIR, `tenders-${timestamp}.json`);
  writeFileSync(jsonPath, JSON.stringify(sorted, null, 2), "utf8");

  // CSV — flatten matched keywords
  const csvRows = sorted.map((r) => ({
    score: r.score,
    source: r.source,
    stage: r.stage,
    title: r.title,
    buyer: r.buyer,
    buyerRegion: r.buyerRegion,
    valueGBP: r.valueAmount ?? "",
    published: r.published,
    deadline: r.deadline ?? "",
    matchedKeywords: (r.matched ?? []).join("; "),
    description: r.description,
    noticeId: r.noticeId,
    url: r.url,
  }));

  const csvPath = join(OUTPUT_DIR, `tenders-${timestamp}.csv`);
  const csv = stringify(csvRows, { header: true });
  writeFileSync(csvPath, csv, "utf8");

  return { jsonPath, csvPath, count: sorted.length };
}
