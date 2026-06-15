// filter.js — Relevance scoring and keyword filtering
// Returns scored tenders sorted best-match first

import { config } from "./config.js";

const { keywords, targetBuyers, minValue, maxValue } = config;

// Flatten all keyword groups into a scored map: keyword -> points
const KEYWORD_SCORES = new Map();
const addKeywords = (group, points) =>
  group.forEach((kw) => KEYWORD_SCORES.set(kw.toLowerCase(), points));

addKeywords(keywords.housing,    5);  // highest relevance for HA sector
addKeywords(keywords.ai,         4);
addKeywords(keywords.data,       3);
addKeywords(keywords.consulting, 2);

/**
 * Extract a flat text blob from an OCDS release for keyword matching.
 */
function releaseText(release) {
  const t = release.tender ?? {};
  const buyer = release.buyer ?? {};

  return [
    t.title ?? "",
    t.description ?? "",
    t.mainProcurementCategory ?? "",
    buyer.name ?? "",
    (t.items ?? []).map((i) => `${i.description ?? ""} ${i.classification?.description ?? ""}`).join(" "),
    (t.additionalProcurementCategories ?? []).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Extract contract value from an OCDS release.
 * @returns {number|null}
 */
function extractValue(release) {
  const t = release.tender ?? {};
  return t.value?.amount ?? null;
}

/**
 * Score a single release against Solirius keyword profile.
 * @returns {{ score: number, matchedKeywords: string[] }}
 */
export function scoreRelease(release) {
  const text = releaseText(release);
  const matchedKeywords = [];
  let score = 0;

  for (const [kw, pts] of KEYWORD_SCORES) {
    if (text.includes(kw)) {
      matchedKeywords.push(kw);
      score += pts;
    }
  }

  // Bonus: buyer name matches a target org
  const buyerName = (release.buyer?.name ?? "").toLowerCase();
  for (const tb of targetBuyers) {
    if (buyerName.includes(tb.toLowerCase())) {
      score += 3;
      break;
    }
  }

  return { score, matchedKeywords };
}

/**
 * Filter and score a batch of OCDS releases.
 * Returns only those with score > 0 and above min value, sorted descending.
 * @param {any[]} releases
 * @returns {ScoredRelease[]}
 */
export function filterAndScore(releases) {
  const results = [];

  for (const release of releases) {
    const { score, matchedKeywords } = scoreRelease(release);
    if (score === 0) continue;

    const value = extractValue(release);
    if (minValue && value !== null && value < minValue) continue;
    if (maxValue && value !== null && value > maxValue) continue;

    const t = release.tender ?? {};
    const deadline = t.tenderPeriod?.endDate ?? null;

    results.push({
      ocid:       release.ocid,
      id:         release.id,
      stage:      release.tag?.[0] ?? "unknown",
      title:      t.title ?? "(no title)",
      buyer:      release.buyer?.name ?? "(unknown buyer)",
      description: (t.description ?? "").slice(0, 400).trim(),
      value,
      currency:   t.value?.currency ?? "GBP",
      deadline,
      publishedDate: release.date ?? null,
      url: `https://www.contractsfinder.service.gov.uk/Notice/${release.ocid?.split("-").pop()}`,
      score,
      matchedKeywords,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
