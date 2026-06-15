// config.js — Solirius Data & AI Practice bid filters
// Edit this file to adjust what tenders are surfaced

export const config = {
  // ── API ──────────────────────────────────────────────────────────────────
  baseUrl: "https://www.contractsfinder.service.gov.uk",
  rateLimit: 1200, // ms between requests (stay well under the 5-min ban threshold)

  // ── SEARCH DEFAULTS ──────────────────────────────────────────────────────
  // planning = Future Opportunity + Early Market Engagement
  // tender   = Opportunity (live ITT)
  // Amendments, awards and contract notices are excluded in filter.js
  defaultStages: ["planning", "tender"],
  defaultLookbackDays: 30,
  pageSize: 100,

  // ── KEYWORD FILTERS (case-insensitive, any match = include) ─────────────
  // Tuned for Solirius's core sectors: data/AI, housing, justice tech,
  // education data, architecture & delivery — drawn from awarded contract history.
  keywords: {
    // Data engineering & analytics (core Solirius capability)
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
      "data science",
      "data transformation",
      "data collection",
      "learner data",
      "management information",
      "MI build",
      "data directorate",
    ],

    // AI & machine learning
    ai: [
      "artificial intelligence",
      "machine learning",
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

    // Justice & courts technology (Solirius's largest client sector)
    justice: [
      "HMCTS",
      "HM Courts",
      "Ministry of Justice",
      "court digitisation",
      "courts reform",
      "pre-recorded evidence",
      "CFT",
      "digital justice",
      "probation",
      "criminal justice",
    ],

    // Education & skills data (DfE, ESFA — major repeat buyer)
    education: [
      "Department for Education",
      "DfE",
      "ESFA",
      "education data",
      "learner record",
      "further education",
      "skills funding",
      "school data",
      "Ofsted",
      "apprenticeship",
    ],

    // Software delivery, architecture & technical services
    delivery: [
      "software engineering",
      "technical architecture",
      "solution architecture",
      "system integration",
      "systems integration",
      "quality assurance",
      "test centre",
      "agile development",
      "agile delivery",
      "user centred design",
      "user research",
      "service design",
      "product delivery",
      "delivery partner",
      "managed service",
      "digital delivery",
      "digital specialists",
      "digital outcomes",
      "G-Cloud",
      "RM6263",
    ],

    // Consulting & strategy
    consulting: [
      "digital transformation",
      "technology strategy",
      "technology consulting",
      "IT strategy",
      "cloud migration",
      "Azure",
      "Microsoft 365",
      "Google Cloud",
      "cloud platform",
      "BDUK",
      "Building Digital UK",
    ],

    // Housing & social sector
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
  // Drawn from Solirius's awarded contract history — these buyers have
  // procured from Solirius before and represent high-probability targets.
  targetBuyers: [
    // Justice
    "Ministry of Justice",
    "HMCTS",
    "Crown Prosecution Service",
    "probation",
    // Education & skills
    "Department for Education",
    "ESFA",
    "Education and Skills Funding",
    // Central government
    "Home Office",
    "Cabinet Office",
    "DSIT",
    "DCMS",
    "FCDO",
    "Foreign Commonwealth",
    "Planning Inspectorate",
    "Ofgem",
    "Money and Pensions",
    "Ministry of Defence",
    "GDS",
    // Housing & local government
    "housing",
    "council",
    "local authority",
    "MHCLG",
    "Department for Levelling Up",
    "DLUHC",
    "NHS",
  ],

  // ── VALUE THRESHOLDS ─────────────────────────────────────────────────────
  minValue: 50_000,   // ignore tiny tenders below this (£)
  maxValue: null,     // no upper cap

  // ── OUTPUT ───────────────────────────────────────────────────────────────
  outputDir: "./output",
  dataDir: "./data",
};
