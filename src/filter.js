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
    url: `https://www.contractsfinder.service.gov.uk/Notice/${release.id}`,
  };
}
