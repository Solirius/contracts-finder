// jira.js — Jira REST API integration
// Creates a Task in the configured Jira project for each scored tender.
// Env vars required: JIRA_EMAIL, JIRA_API_TOKEN
// Optional:         JIRA_HOST (default: stefania-deligia.atlassian.net)
//                   JIRA_PROJECT (default: KAN)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { config } from "./config.js";

const JIRA_HOST    = process.env.JIRA_HOST    ?? "stefania-deligia.atlassian.net";
const JIRA_EMAIL   = process.env.JIRA_EMAIL   ?? "";
const JIRA_TOKEN   = process.env.JIRA_API_TOKEN ?? "";
const JIRA_PROJECT = process.env.JIRA_PROJECT ?? "KAN";

const CACHE_PATH = join(config.dataDir, "jira-pushed.json");

function authHeader() {
  const encoded = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString("base64");
  return `Basic ${encoded}`;
}

function scoreToPriority(score) {
  if (score >= 12) return { id: "1" }; // Highest
  if (score >= 8)  return { id: "2" }; // High
  if (score >= 5)  return { id: "3" }; // Medium
  if (score >= 3)  return { id: "4" }; // Low
  return { id: "5" };                  // Lowest
}

function safeLabel(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function buildDescription(tender) {
  const rows = [
    ["Buyer",    tender.buyer],
    ["Stage",    tender.stage],
    ...(tender.value    ? [["Value",    `£${tender.value.toLocaleString()}`]] : []),
    ...(tender.deadline ? [["Deadline", tender.deadline.slice(0, 10)]]       : []),
    ["Score",    `${tender.score} — ${tender.matchedKeywords.join(", ")}`],
  ];

  const bulletItems = rows.map(([label, val]) => ({
    type: "listItem",
    content: [{
      type: "paragraph",
      content: [
        { type: "text", text: `${label}: `, marks: [{ type: "strong" }] },
        { type: "text", text: String(val) },
      ],
    }],
  }));

  const content = [
    { type: "bulletList", content: bulletItems },
  ];

  if (tender.description) {
    content.push({
      type: "paragraph",
      content: [{ type: "text", text: tender.description }],
    });
  }

  content.push({
    type: "paragraph",
    content: [{
      type: "text",
      text: "View on Contracts Finder →",
      marks: [{ type: "link", attrs: { href: tender.url } }],
    }],
  });

  return { version: 1, type: "doc", content };
}

export function buildJiraFields(tender) {
  const summary = tender.title.length > 255
    ? tender.title.slice(0, 252) + "…"
    : tender.title;

  const labels = [
    "contracts-finder",
    safeLabel(tender.stage),
    ...tender.matchedKeywords.slice(0, 5).map(safeLabel),
  ].filter(Boolean);

  const fields = {
    project:     { key: JIRA_PROJECT },
    issuetype:   { id: "10003" }, // Task
    summary,
    description: buildDescription(tender),
    labels,
    priority:    scoreToPriority(tender.score),
  };

  if (tender.deadline) {
    fields.duedate = tender.deadline.slice(0, 10);
  }

  return fields;
}

export async function createJiraIssue(tender) {
  if (!JIRA_EMAIL || !JIRA_TOKEN) {
    throw new Error("JIRA_EMAIL and JIRA_API_TOKEN must be set in .env");
  }

  const headers = {
    "Authorization": authHeader(),
    "Content-Type":  "application/json",
    "Accept":        "application/json",
  };

  // Create the issue
  const res = await fetch(`https://${JIRA_HOST}/rest/api/3/issue`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fields: buildJiraFields(tender) }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = JSON.stringify(err.errors ?? err.errorMessages ?? err);
    throw new Error(`Jira API ${res.status}: ${detail}`);
  }

  const { key, id } = await res.json();

  // Transition to "New Lead" column (transition id 11 → status "Idea"/New Lead)
  await fetch(`https://${JIRA_HOST}/rest/api/3/issue/${key}/transitions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ transition: { id: "11" } }),
  }).catch(() => { /* non-fatal — issue is created, column placement is best-effort */ });

  return { key, id };
}

export function loadPushedCache() {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

export function savePushedCache(cache) {
  mkdirSync(config.dataDir, { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}
