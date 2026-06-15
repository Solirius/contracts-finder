// api.js — Contracts Finder OCDS API client
// Handles pagination, rate-limiting, and error recovery

import { config } from "./config.js";

const BASE = `${config.baseUrl}/Published/Notices/OCDS/Search`;

/**
 * Sleep for n milliseconds
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch a single page of OCDS releases.
 * @param {object} params
 * @param {string} [params.publishedFrom]  ISO 8601
 * @param {string} [params.publishedTo]    ISO 8601
 * @param {string[]} [params.stages]       e.g. ["planning","tender"]
 * @param {string} [params.cursor]         pagination cursor
 * @param {number} [params.limit]
 * @returns {Promise<{releases: any[], nextCursor: string|null}>}
 */
export async function fetchPage({ publishedFrom, publishedTo, stages, cursor, limit = config.pageSize } = {}) {
  const url = new URL(BASE);

  if (publishedFrom) url.searchParams.set("publishedFrom", publishedFrom);
  if (publishedTo)   url.searchParams.set("publishedTo",   publishedTo);
  if (stages?.length) url.searchParams.set("stages", stages.join(","));
  if (cursor)        url.searchParams.set("cursor", cursor);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (res.status === 403) {
    throw new Error("Rate limit hit — wait 5 minutes before retrying.");
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from Contracts Finder API`);
  }

  const body = await res.json();

  // Pagination cursor is in body.links.next (not body.uri)
  let nextCursor = null;
  if (body.links?.next) {
    try {
      const u = new URL(body.links.next);
      nextCursor = u.searchParams.get("cursor") || null;
    } catch (_) {
      // ignore
    }
  }

  return {
    releases: body.releases ?? [],
    nextCursor,
  };
}

/**
 * Fetch ALL pages for a given date/stage query, respecting rate limits.
 * Yields batches of releases as they arrive.
 *
 * @param {object} params  Same as fetchPage, minus cursor
 * @param {(n: number) => void} [onPage]  Called with running release count after each page
 */
export async function* fetchAll(params, onPage) {
  let cursor = null;
  let totalFetched = 0;
  let pageNum = 0;

  do {
    if (pageNum > 0) await sleep(config.rateLimit);

    const { releases, nextCursor } = await fetchPage({ ...params, cursor });
    totalFetched += releases.length;
    pageNum++;

    if (onPage) onPage(totalFetched);

    yield releases;

    cursor = nextCursor;
  } while (cursor);
}
