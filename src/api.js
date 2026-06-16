// api.js — fetches OCDS releases from Contracts Finder, Find a Tender,
//           Public Contracts Scotland, Sell2Wales, and BravoSolution (GCA)
import { config } from "./config.js";
import { subDays, formatISO, format } from "date-fns";
import { fetchBravoSolution } from "./portals.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Contracts Finder ──────────────────────────────────────────────────────────
// Cursor-based pagination; params: publishedFrom, stages, size
async function* fetchContractsFinder({ days, stages }) {
  const src = config.sources.contractsFinder;
  const publishedFrom = formatISO(subDays(new Date(), days), {
    representation: "complete",
  }).slice(0, 19);

  const stageParam = stages.join(",");
  let cursor = null;
  let page = 0;

  while (true) {
    const params = new URLSearchParams({
      publishedFrom,
      stages: stageParam,
      size: "100",
    });
    if (cursor) params.set("cursor", cursor);

    const url = `${src.baseUrl}${src.searchPath}?${params}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (!res.ok) {
      if (res.status === 429) {
        const retry = parseInt(res.headers.get("Retry-After") || "10", 10);
        console.warn(`[CF] Rate limited — waiting ${retry}s`);
        await sleep(retry * 1000);
        continue;
      }
      throw new Error(`[CF] HTTP ${res.status} on page ${page}`);
    }

    const data = await res.json();
    const releases = data.releases ?? data.releasePackage?.releases ?? [];

    if (releases.length === 0) break;
    page++;
    for (const r of releases) yield { release: r, source: src.label };

    cursor = data.cursor ?? data.nextCursor ?? null;
    if (!cursor) break;
    await sleep(config.rateLimit);
  }
}

// ── Find a Tender ─────────────────────────────────────────────────────────────
// Cursor-based pagination; params: updatedFrom, stages, limit
async function* fetchFindATender({ days, stages }) {
  const src = config.sources.findATender;
  const updatedFrom = formatISO(subDays(new Date(), days), {
    representation: "complete",
  }).slice(0, 19);

  const stageParam = stages.join(",");
  let cursor = null;
  let page = 0;

  while (true) {
    const params = new URLSearchParams({
      updatedFrom,
      stages: stageParam,
      limit: "100",
    });
    if (cursor) params.set("cursor", cursor);

    const url = `${src.baseUrl}${src.searchPath}?${params}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (!res.ok) {
      if (res.status === 429) {
        const retry = parseInt(res.headers.get("Retry-After") || "10", 10);
        console.warn(`[FTS] Rate limited — waiting ${retry}s`);
        await sleep(retry * 1000);
        continue;
      }
      throw new Error(`[FTS] HTTP ${res.status} on page ${page}`);
    }

    const data = await res.json();
    const releases = data.releases ?? [];

    if (releases.length === 0) break;
    page++;
    for (const r of releases) yield { release: r, source: src.label };

    cursor = data.cursor ?? data.nextCursor ?? null;
    if (!cursor) break;
    await sleep(config.rateLimit);
  }
}

// ── Month-based sources (PCS + Sell2Wales) ────────────────────────────────────
// These APIs return all notices for a given month by noticeType.
// stages map to: planning→1 (PIN), tender→2 (contract notice), award→3
const STAGE_NOTICE_TYPE = { planning: 1, tender: 2, award: 3 };

// Returns ["MM-YYYY", ...] for each month that overlaps the lookback window
function monthRange(days) {
  const now = new Date();
  const cutoff = subDays(now, days);
  const months = [];
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed

  while (true) {
    months.push(format(new Date(year, month, 1), "MM-yyyy"));
    // Stop once we've included the month that contains the cutoff date
    if (new Date(year, month, 1) <= cutoff) break;
    month--;
    if (month < 0) { month = 11; year--; }
  }
  return months;
}

async function* fetchMonthBased(src, { days, stages }) {
  const cutoff = subDays(new Date(), days);

  for (const month of monthRange(days)) {
    for (const stage of stages) {
      const noticeType = STAGE_NOTICE_TYPE[stage];
      if (noticeType === undefined) continue;

      const params = new URLSearchParams({
        dateFrom: month,
        noticeType: String(noticeType),
        outputType: "0",
      });
      if (src.locale) params.set("locale", src.locale);

      const url = `${src.baseUrl}${src.searchPath}?${params}`;

      let res;
      try {
        res = await fetch(url, { headers: { Accept: "application/json" } });
      } catch (err) {
        console.warn(`[${src.label}] Network error: ${err.message}`);
        continue;
      }

      if (!res.ok) {
        if (res.status === 429) {
          const retry = parseInt(res.headers.get("Retry-After") || "10", 10);
          console.warn(`[${src.label}] Rate limited — waiting ${retry}s`);
          await sleep(retry * 1000);
          continue;
        }
        console.warn(`[${src.label}] HTTP ${res.status} for ${stage}/${month} — skipping`);
        continue;
      }

      let data;
      try {
        data = await res.json();
      } catch {
        console.warn(`[${src.label}] Invalid response for ${stage}/${month} — skipping`);
        continue;
      }

      const releases = data.releases ?? [];
      for (const r of releases) {
        if (r.date && new Date(r.date) < cutoff) continue;
        yield { release: r, source: src.label };
      }

      await sleep(config.rateLimit);
    }
  }
}

// ── Combined generator ────────────────────────────────────────────────────────
export async function* fetchAllNotices({ days, stages }) {
  const { contractsFinder, findATender, sell2wales, publicContractsScotland, bravoSolution } = config.sources;

  if (contractsFinder.enabled) {
    console.log(`\nFetching from ${contractsFinder.label}...`);
    yield* fetchContractsFinder({ days, stages });
  }

  if (findATender.enabled) {
    console.log(`\nFetching from ${findATender.label}...`);
    yield* fetchFindATender({ days, stages });
  }

  if (sell2wales.enabled) {
    console.log(`\nFetching from ${sell2wales.label}...`);
    yield* fetchMonthBased(sell2wales, { days, stages });
  }

  if (publicContractsScotland.enabled) {
    console.log(`\nFetching from ${publicContractsScotland.label}...`);
    yield* fetchMonthBased(publicContractsScotland, { days, stages });
  }

  if (bravoSolution.enabled) {
    console.log(`\nFetching from ${bravoSolution.label}...`);
    yield* fetchBravoSolution(bravoSolution);
  }
}
