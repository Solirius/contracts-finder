// filter.js — Relevance scoring and keyword filtering
// Returns scored tenders sorted best-match first

import { config } from "./config.js";

const { keywords, targetBuyers, minValue, maxValue, excludeRefs } = config;
const EXCLUDED_REFS = new Set((excludeRefs ?? []).map((r) => r.toUpperCase()));

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Pre-compile word-boundary regexes so short acronyms don't match substrings
// (e.g. "ELT" must not match "belt", "MAT" must not match "material")
function buildGroup(name, kws, points) {
  return {
    name,
    points,
    entries: kws.map((kw) => ({
      kw,
      re: new RegExp(`\\b${escapeRe(kw)}\\b`, "i"),
    })),
  };
}

const GROUPS = [
  buildGroup("housing",    keywords.housing,    5),
  buildGroup("ai",         keywords.ai,         4),
  buildGroup("justice",    keywords.justice,    4),
  buildGroup("data",       keywords.data,       3),
  buildGroup("education",  keywords.education,  3),
  buildGroup("delivery",   keywords.delivery,   3),
  buildGroup("health",     keywords.health,     3),
  buildGroup("consulting", keywords.consulting, 2),
];

// Pre-compile target buyer regexes too
const BUYER_RES = targetBuyers.map((tb) => new RegExp(`\\b${escapeRe(tb)}\\b`, "i"));

// Compound filter: must hit at least one CORE group AND at least one SECTOR group
const CORE_GROUPS   = new Set(["data", "ai"]);
const SECTOR_GROUPS = new Set(["housing", "justice", "education", "delivery", "health", "consulting"]);

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
  ].join(" ");
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

  for (const { name, entries, points } of GROUPS) {
    for (const { kw, re } of entries) {
      const kwLower = kw.toLowerCase();
      if (!seenKw.has(kwLower) && re.test(text)) {
        seenKw.add(kwLower);
        matchedKeywords.push(kw);
        score += points;
        matchedGroups.add(name);
      }
    }
  }

  // Bonus: buyer name matches a target org (word-boundary matched)
  const buyerName = release.buyer?.name ?? "";
  for (const re of BUYER_RES) {
    if (re.test(buyerName)) {
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
      url: release.tender?.documents?.[0]?.url
        ?? `https://www.contractsfinder.service.gov.uk/Notice/${release.ocid?.replace(/^ocds-[a-z0-9]+-/, "") ?? ""}`,
      score,
      matchedKeywords,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
