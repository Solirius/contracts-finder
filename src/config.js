// config.js — Solirius Data & AI Practice bid filters
// Edit this file to adjust what tenders are surfaced

export const config = {
  // ── Sources ───────────────────────────────────────────────────────────────
  sources: {
    contractsFinder: {
      enabled: true,
      baseUrl: "https://www.contractsfinder.service.gov.uk",
      searchPath: "/Published/Notices/OCDS/Search",
      label: "Contracts Finder",
    },
    findATender: {
      enabled: true,
      baseUrl: "https://www.find-tender.service.gov.uk",
      searchPath: "/api/1.0/ocdsReleasePackages",
      label: "Find a Tender",
    },
    sell2wales: {
      enabled: true,
      baseUrl: "https://api-sell2wales.klickstream.com",
      searchPath: "/v1/Notices",
      label: "Sell2Wales",
      locale: "2057", // en-GB
    },
    publicContractsScotland: {
      enabled: true,
      baseUrl: "https://api.publiccontractsscotland.gov.uk",
      searchPath: "/v1/Notices",
      label: "Public Contracts Scotland",
    },
    // Authenticated portal scrapers (BravoSolution / JAGGAER family)
    // Credentials come from env vars named in userEnv / passEnv.
    bravoSolutions: [
      {
        enabled: true,
        baseUrl: "https://crowncommercialservice.bravosolution.co.uk",
        label: "BravoSolution (GCA)",
        userEnv: "BRAVO_USER",
        passEnv: "BRAVO_PASS",
      },
      {
        enabled: true,
        baseUrl: "https://homeoffice.app.jaggaer.com",
        label: "JAGGAER (Home Office)",
        userEnv: "BRAVO_USER",
        passEnv: "BRAVO_PASS",
      },
      {
        enabled: true,
        baseUrl: "https://education.app.jaggaer.com",
        label: "JAGGAER (DfE)",
        userEnv: "BRAVO_USER",
        passEnv: "BRAVO_DFE_PASS",
      },
      {
        enabled: true,
        baseUrl: "https://uktrade.app.jaggaer.com",
        label: "JAGGAER (DIT/DBT)",
        userEnv: "BRAVO_USER",
        passEnv: "BRAVO_DIT_PASS",
      },
    ],
  },

  // ── Rate limiting ─────────────────────────────────────────────────────────
  rateLimit: 1500, // ms between requests per source

  // ── Search window ─────────────────────────────────────────────────────────
  defaultDays: 30,

  // ── Minimum relevance score to include in results ─────────────────────────
  minScore: 5,

  // ── Stages to fetch ───────────────────────────────────────────────────────
  // "planning" = pre-market / pipeline notices
  // "tender"   = live ITTs
  // "award"    = won contracts (useful for market intel)
  stages: ["planning", "tender"],

  // ── Keyword scoring groups ────────────────────────────────────────────────
  keywords: {
    housing: {
      score: 5,
      terms: [
        "housing association", "registered provider", "social housing",
        "STAIRS", "HHSRS", "awaab", "housing ombudsman", "RSH",
        "affordable housing", "MHCLG", "HACT", "NHF",
        "local authority housing", "council housing", "housing benefit",
        "right to repair", "damp and mould", "building safety",
      ],
    },
    ai: {
      score: 4,
      terms: [
        "artificial intelligence", "machine learning", "large language model",
        "LLM", "generative AI", "Azure AI", "Copilot", "ChatGPT",
        "AI strategy", "AI implementation", "AI advisory", "AI solution",
        "AI platform", "cognitive services", "natural language processing",
        "NLP", "computer vision", "AI foundry",
        "ai engineering", "data & ai",
      ],
    },
    data: {
      score: 3,
      terms: [
        "data platform", "data strategy", "data governance", "data engineering",
        "data science", "data analytics", "data warehouse", "data lake",
        "business intelligence", "BI", "ETL", "data pipeline",
        "data architecture", "data mesh", "Power BI", "Fabric",
        "Databricks", "Snowflake", "Azure", "cloud data",
        "data & ai",
      ],
    },
    consulting: {
      score: 2,
      terms: [
        "digital transformation", "technology consulting", "advisory",
        "consultancy", "programme management", "delivery partner",
        "technology strategy", "innovation", "cloud migration",
        "IT strategy", "Microsoft partner", "M365",
      ],
    },
  },

  // ── Bonus for specific buyer types ───────────────────────────────────────
  targetBuyers: {
    score: 3,
    terms: [
      "housing association", "registered provider",
      "MHCLG", "Department for Levelling Up", "Homes England",
      "DLUHC", "Regulator of Social Housing",
    ],
  },

  // ── Value filter (optional — set to 0 to disable) ─────────────────────────
  minValue: 0,      // GBP
  maxValue: 0,      // GBP (0 = no upper limit)
};
