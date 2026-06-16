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
  let score = 0;
  const matched = [];

  for (const [group, { score: pts, terms }] of Object.entries(config.keywords)) {
    for (const term of terms) {
      if (text.includes(term.toLowerCase())) {
        score += pts;
        matched.push(`[${group}] ${term}`);
        break; // one match per group per term set — avoid double-counting
      }
    }
  }

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
    valueCurrency: t.value?.currency ?? "GBP",
    valueAmount: value,
    published: release.date ?? "",
    deadline,
    url: noticeUrl(release, source),
  };
}
