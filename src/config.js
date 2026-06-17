// config.js — Solirius Reply bid filters
// Edit this file to adjust what tenders are surfaced
// Services: Java engineering, agile delivery, cyber security, cloud architecture,
// data/AI, DevOps, enterprise architecture, GDS-standard digital services,
// integration architecture, Microsoft/Azure, business design & consulting.

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
  // Raised to 7 so that a single weak keyword can no longer clear the bar alone.
  minScore: 7,

  // ── Stages to fetch ───────────────────────────────────────────────────────
  // "planning" = pre-market / pipeline notices
  // "tender"   = live ITTs
  // "award"    = won contracts (useful for market intel)
  stages: ["planning", "tender"],

  // ── Hard exclusions ───────────────────────────────────────────────────────
  // Any tender whose text matches one of these terms is dropped entirely,
  // regardless of keyword score. Use multi-word phrases to avoid false positives.
  exclusions: [
    "facilities management",
    "cleaning services", "cleaning contract", "window cleaning",
    "catering services", "catering contract", "catering provision",
    "grounds maintenance", "grounds management", "landscaping services",
    "waste management", "waste collection", "refuse collection",
    "pest control",
    "manned guarding", "security guarding", "door supervisor",
    "building maintenance", "building refurbishment",
    "planned preventative maintenance",
    "civil engineering", "construction works", "highways maintenance",
    "fleet management", "vehicle maintenance",
    "laundry services", "linen services",
    "dental services", "medical devices", "nursing staff",
  ],

  // ── Keyword scoring groups ────────────────────────────────────────────────
  // One match per group per tender — repeated keywords don't stack.
  keywords: {
    // ── Tier 1 (score 5) — core Data & AI practice ───────────────────────
    ai: {
      score: 5,
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
      score: 5,
      terms: [
        "data platform", "data strategy", "data governance", "data engineering",
        "data science", "data analytics", "data warehouse", "data lake",
        "business intelligence", "ETL", "data pipeline",
        "data architecture", "data mesh", "Power BI", "Fabric",
        "Databricks", "Snowflake", "cloud data", "data & ai",
      ],
    },

    // ── Tier 2 (score 4) — primary service lines ─────────────────────────
    delivery: {
      score: 4,
      terms: [
        "agile delivery", "delivery manager", "product delivery",
        "software delivery", "digital delivery", "programme delivery",
        "agile transformation", "agile coaching",
        "managed service", "G-Cloud", "technology delivery",
        "Scrum", "SAFe", "delivery partner",
        "programme management", "portfolio management",
      ],
    },
    security: {
      score: 4,
      terms: [
        "cyber security", "cybersecurity", "information security",
        "security architecture", "security review", "security compliance",
        "penetration testing", "pen test", "vulnerability assessment",
        "Cyber Essentials", "ISO 27001", "NCSC", "security assurance",
        "security advisory", "DAST", "SAST", "security posture",
        "threat modelling", "identity and access management", "IAM",
      ],
    },
    cloudArchitecture: {
      score: 4,
      terms: [
        "cloud adoption", "cloud migration", "cloud architecture",
        "cloud strategy", "cloud transformation", "cloud native",
        "enterprise architecture", "solution architecture", "technical architecture",
        "architectural review", "TOGAF", "well-architected",
        "AWS", "Amazon Web Services", "cloud hosting",
        "target operating model", "enterprise architect",
      ],
    },

    // ── Tier 3 (score 3) — supporting capabilities ───────────────────────
    softwareEngineering: {
      score: 3,
      terms: [
        "software engineering", "software development", "application development",
        "full stack", "full-stack", "web development", "API development",
        "microservices", "backend development", "frontend development",
        "software architect",
        "Java", "Spring Boot", "Java EE", "Java development",
        "open source development",
      ],
    },
    devops: {
      score: 3,
      terms: [
        "DevOps", "site reliability", "SRE", "infrastructure as code",
        "Kubernetes", "Docker", "containerisation", "CI/CD",
        "cloud engineering", "platform engineering", "cloud infrastructure",
        "Jenkins", "GitOps",
      ],
    },
    integration: {
      score: 3,
      terms: [
        "integration architecture", "system integration", "enterprise integration",
        "API integration", "API management", "API gateway",
        "middleware", "event-driven architecture", "integration platform",
        "message broker", "ERP integration", "CRM integration",
      ],
    },
    microsoft: {
      score: 3,
      terms: [
        "Power Platform", "Power Apps", "Power Automate",
        "SharePoint", "Dynamics 365", "Azure DevOps",
        "Microsoft Azure", "M365", "Microsoft 365",
        "SQL Server", "Microsoft partner",
      ],
    },
    governmentDigital: {
      score: 3,
      terms: [
        "GDS", "Government Digital Service", "CDDO",
        "service standard", "service assessment",
        "alpha phase", "beta phase", "discovery phase",
        "digital service standard", "government as a platform",
        "GOV.UK", "digital public service",
      ],
    },
    businessDesign: {
      score: 3,
      terms: [
        "business analysis", "business analyst", "service design",
        "user research", "user experience", "UX", "business change",
        "operating model", "organisational design", "process design",
        "transformation design", "business architecture",
        "business case development", "stakeholder management",
      ],
    },

    // ── Tier 4 (score 2) — context signals (need other hits to qualify) ───
    consulting: {
      score: 2,
      terms: [
        "digital transformation", "technology consulting",
        "technology strategy", "IT strategy",
        "technology advisory", "digital advisory",
        "business transformation", "enterprise transformation",
        "strategic consulting",
      ],
    },
  },

  // ── Bonus for high-value buyer organisations ──────────────────────────────
  targetBuyers: {
    score: 4,
    terms: [
      "Ministry of Justice", "MoJ", "HMCTS",
      "Home Office", "Department for Education", "DfE",
      "FCDO", "Ofgem",
      "MHCLG", "Homes England", "DLUHC",
      "Cabinet Office", "HMRC",
      "DVLA", "DVSA", "Companies House",
      "housing association", "registered provider",
    ],
  },

  // ── Value filter (optional — set to 0 to disable) ─────────────────────────
  minValue: 0,      // GBP
  maxValue: 0,      // GBP (0 = no upper limit)
};
