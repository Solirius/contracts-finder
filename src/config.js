// config.js — Solirius Data & AI Practice bid filters
// Edit this file to adjust what tenders are surfaced

export const config = {
  // ── API ──────────────────────────────────────────────────────────────────
  baseUrl: "https://www.contractsfinder.service.gov.uk",
  rateLimit: 1200, // ms between requests (stay well under the 5-min ban threshold)

  // ── SEARCH DEFAULTS ──────────────────────────────────────────────────────
  defaultStages: ["planning", "tender"],      // planning = Future Opportunities
  defaultLookbackDays: 30,
  pageSize: 100,

  // ── KEYWORD FILTERS (case-insensitive, any match = include) ─────────────
  // These are tuned for Solirius Data & AI / Housing Association work
  keywords: {
    // Core capability keywords
    data: [
      "data platform",
      "data strategy",
      "data analytics",
      "data engineering",
      "data architecture",
      "data governance",
      "business intelligence",
      "BI platform",
      "reporting solution",
      "data lake",
      "data warehouse",
      "ETL",
      "data migration",
      "data quality",
    ],
    ai: [
      "artificial intelligence",
      "AI",
      "machine learning",
      "ML",
      "large language model",
      "LLM",
      "natural language processing",
      "NLP",
      "copilot",
      "generative AI",
      "GenAI",
      "cognitive services",
      "Azure AI",
      "Microsoft AI",
    ],
    consulting: [
      "digital transformation",
      "technology strategy",
      "technology consulting",
      "IT strategy",
      "solution architecture",
      "cloud migration",
      "Azure",
      "Microsoft 365",
    ],
    housing: [
      "housing association",
      "housing provider",
      "registered provider",
      "social housing",
      "housing management",
      "tenants",
      "repairs",
      "asset management",
      "housing technology",
      "STAIRS",
      "Awaab",
      "RSH",
      "MHCLG",
      "HACT",
    ],
  },

  // ── BUYER KEYWORDS (flag tenders from these organisations) ───────────────
  targetBuyers: [
    "housing",
    "council",
    "local authority",
    "MHCLG",
    "Department for Levelling Up",
    "NHS",
    "Cabinet Office",
    "GDS",
    "DLUHC",
  ],

  // ── VALUE THRESHOLDS ─────────────────────────────────────────────────────
  minValue: 50_000,   // ignore tiny tenders below this (£)
  maxValue: null,     // no upper cap

  // ── OUTPUT ───────────────────────────────────────────────────────────────
  outputDir: "./output",
  dataDir: "./data",
};
