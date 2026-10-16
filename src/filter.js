// filter.js — keyword scoring engine
import { config } from "./config.js";

function textOf(release) {
  const t = release.tender ?? {};
  const parts = [
    t.title ?? "",
    t.description ?? "",
    ...(t.lots ?? []).map((l) => `${l.title ?? ""} ${l.description ?? ""}`),
    ...(release.parties ?? []).map((p) => p.name ?? ""),
  ];
  return parts.join(" ").toLowerCase();
}

function buyerOf(release) {
  const buyer = release.parties?.find((p) => p.roles?.includes("buyer"));
  return (buyer?.name ?? "").toLowerCase();
}

export function scoreRelease(release) {
  const text = textOf(release);
  const buyer = buyerOf(release);

  for (const term of config.exclusions) {
    if (text.includes(term.toLowerCase())) {
      return { score: 0, matched: [`[excluded] ${term}`] };
    }
  }

  const keywordResult = scoreKeywords(text);
  let score = keywordResult.score;
  const matched = keywordResult.matched;

  // Buyer bonus
  for (const term of config.targetBuyers.terms) {
    if (buyer.includes(term.toLowerCase()) || text.includes(term.toLowerCase())) {
      score += config.targetBuyers.score;
      matched.push(`[buyer] ${term}`);
      break;
    }
  }

  return { score, matched };
}

function noticeUrl(release, source) {
  // Authenticated portals (BravoSolution / JAGGAER) set _url directly
  if (release._url) return release._url;

  // OCDS sources: prefer a tenderNotice / contractNotice document URL
  const doc = (release.tender?.documents ?? [])
    .find(d => d.url && /notice/i.test(d.documentType ?? ""));
  if (doc?.url) return doc.url;

  // Find a Tender: release.id is the FTS notice number (e.g. "056764-2026")
  if (source === "Find a Tender") {
    return `https://www.find-tender.service.gov.uk/Notice/${release.id}`;
  }

  // Public Contracts Scotland: release.id is "rls-N-JUNNNNNNN" — extract the JUN ID
  if (source === "Public Contracts Scotland") {
    const pcsId = (release.id ?? "").replace(/^rls-\d+-/, "");
    return `https://www.publiccontractsscotland.gov.uk/search/show/search_view.aspx?ID=${pcsId}`;
  }

  // Contracts Finder: release.id has a trailing numeric suffix (e.g. "-902381")
  // that is not part of the notice URL
  return `https://www.contractsfinder.service.gov.uk/Notice/${release.id.replace(/-\d+$/, "")}`;
}

//Function to support scoring of individual lots
function scoreKeywords(text) {
  let score = 0;
  const matched = [];

  for (const [group, { score: points, terms }] of Object.entries(config.keywords)) {
    const term = terms.find((term) => text.includes(term.toLowerCase()));
    if (term) {
      score += points;
      matched.push(`[${group}] ${term}`);
    }
  }

  return { score, matched };
}

//Function to score individual lots
function scoreLots(release) {
  return (release.tender?.lots ?? [])
    .map((lot, index) => {
      const text = `${lot.title ?? ""} ${lot.description ?? ""}`.toLowerCase();
      const { score, matched } = scoreKeywords(text);

      return {
        id: lot.id ?? "",
        title: lot.title ?? `Untitled lot ${index + 1}`,
        score,
        matched,
      };
    })
    .filter((lot) => lot.score > 0);
}

export function extractFields(release, source) {
  const t = release.tender ?? {};
  const buyer = release.parties?.find((p) => p.roles?.includes("buyer"));
  const value = t.value?.amount ?? t.lots?.[0]?.value?.amount ?? null;
  const deadline = t.tenderPeriod?.endDate ?? t.submissionDeadline ?? null;

  return {
    source,
    ocid: release.ocid ?? "",
    noticeId: release.id ?? "",
    stage: (release.tag ?? []).join(", "),
    title: t.title ?? "(no title)",
    description: (t.description ?? "").slice(0, 300),
    buyer: buyer?.name ?? "",
    buyerRegion: buyer?.address?.region ?? "",
    totalLots: t.lots?.length ?? 0,
    lotsOfInterest: scoreLots(release),
    valueCurrency: t.value?.currency ?? "GBP",
    valueAmount: value,
    published: release.date ?? "",
    deadline,
    url: noticeUrl(release, source),
  };
}
