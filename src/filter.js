// filter.js — Relevance scoring and keyword filtering
// Returns scored tenders sorted best-match first

import { config } from "./config.js";

const { keywords, targetBuyers, minValue, maxValue, excludeRefs } = config;
const EXCLUDED_REFS = new Set((excludeRefs ?? []).map((r) => r.toUpperCase()));

// Groups in descending point order (higher-value group wins if a keyword appears in both)
const GROUPS = [
  { name: "housing",    keywords: keywords.housing,    points: 5 },
  { name: "ai",        keywords: keywords.ai,          points: 4 },
  { name: "justice",   keywords: keywords.justice,     points: 4 },
  { name: "data",      keywords: keywords.data,        points: 3 },
  { name: "education", keywords: keywords.education,   points: 3 },
  { name: "delivery",  keywords: keywords.delivery,    points: 3 },
  { name: "consulting",keywords: keywords.consulting,  points: 2 },
];

// Compound filter: must hit at least one CORE group AND at least one SECTOR group
const CORE_GROUPS   = new Set(["data", "ai"]);
const SECTOR_GROUPS = new Set(["housing", "justice", "education", "delivery", "consulting"]);

// Only surface new opportunities — exclude amendments, updates, awards, contracts
const ALLOWED_STAGES = new Set(["planning", "tender"]);

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

function extractValue(release) {
  return release.tender?.value?.amount ?? null;
}

/**
 * Score a single release against Solirius keyword profile.
 * Returns matched keywords, group membership, and total score.
 */
export function scoreRelease(release) {
  const text = releaseText(release);
  const seenKw = new Set();
  const matchedKeywords = [];
  const matchedGroups = new Set();
  let score = 0;

  for (const { name, keywords: groupKws, points } of GROUPS) {
    for (const kw of groupKws) {
      const kwLower = kw.toLowerCase();
      if (!seenKw.has(kwLower) && text.includes(kwLower)) {
        seenKw.add(kwLower);
        matchedKeywords.push(kw);
        score += points;
        matchedGroups.add(name);
      }
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

  return { score, matchedKeywords, matchedGroups };
}

/**
 * Filter and score a batch of OCDS releases.
 * A release must match (data OR ai) AND (any sector group) to be included.
 */
export function filterAndScore(releases) {
  const results = [];

  for (const release of releases) {
    const stage = release.tag?.[0];
    if (!ALLOWED_STAGES.has(stage)) continue;

    const refText = `${release.id ?? ""} ${release.tender?.id ?? ""} ${release.tender?.title ?? ""}`.toUpperCase();
    if ([...EXCLUDED_REFS].some((ref) => refText.includes(ref))) continue;

    const { score, matchedKeywords, matchedGroups } = scoreRelease(release);
    if (score === 0) continue;

    // Compound filter: (data OR ai) AND (justice OR education OR delivery OR housing OR consulting)
    const hasCoreMatch   = [...matchedGroups].some((g) => CORE_GROUPS.has(g));
    const hasSectorMatch = [...matchedGroups].some((g) => SECTOR_GROUPS.has(g));
    if (!hasCoreMatch || !hasSectorMatch) continue;

    const value = extractValue(release);
    if (minValue && value !== null && value < minValue) continue;
    if (maxValue && value !== null && value > maxValue) continue;

    const t = release.tender ?? {};
    const deadline = t.tenderPeriod?.endDate ?? null;

    results.push({
      ocid:          release.ocid,
      id:            release.id,
      stage:         release.tag?.[0] ?? "unknown",
      title:         t.title ?? "(no title)",
      buyer:         release.buyer?.name ?? "(unknown buyer)",
      description:   (t.description ?? "").slice(0, 400).trim(),
      value,
      currency:      t.value?.currency ?? "GBP",
      deadline,
      publishedDate: release.date ?? null,
      url: `https://www.contractsfinder.service.gov.uk/Search/Results?page=1#${release.ocid?.replace(/^ocds-[a-z0-9]+-/, "") ?? ""}`,
      score,
      matchedKeywords,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
