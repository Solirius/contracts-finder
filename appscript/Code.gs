// ============================================================
// Solirius Data & AI — Contracts Finder (Google Apps Script)
// ============================================================
// SETUP (one-time):
//   1. Paste this file into your Apps Script project
//   2. Add credentials in Project Settings → Script Properties:
//        JIRA_EMAIL        your Atlassian account email
//        JIRA_API_TOKEN    your Jira API token
//        JIRA_HOST         e.g. stef-deligia.atlassian.net  (optional)
//        JIRA_PROJECT      e.g. KAN  (optional)
//   3. Run setupTrigger() once to install the daily 8am trigger
// ============================================================

// ── Configuration ─────────────────────────────────────────────────────────────
// Services: Java engineering, agile delivery, cyber security, cloud architecture,
// data/AI, DevOps, enterprise architecture, GDS-standard digital services,
// integration architecture, Microsoft/Azure, business design & consulting.
var CONFIG = {
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
      locale: "2057",
    },
    publicContractsScotland: {
      enabled: true,
      baseUrl: "https://api.publiccontractsscotland.gov.uk",
      searchPath: "/v1/Notices",
      label: "Public Contracts Scotland",
    },
  },

  rateLimit: 1500,   // ms between paginated requests
  defaultDays: 2,    // look back 2 days on each run
  // Raised to 7 so that a single weak keyword can no longer clear the bar alone.
  minScore: 7,
  stages: ["planning", "tender"],

  // Any tender whose text matches one of these phrases is dropped entirely.
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

  minValue: 0,  // GBP (0 = no lower limit)
  maxValue: 0,  // GBP (0 = no upper limit)
};

// ── Date helpers (replaces date-fns) ──────────────────────────────────────────
function subDays(date, days) {
  var d = new Date(date.getTime());
  d.setDate(d.getDate() - days);
  return d;
}

function formatISO(date) {
  return date.toISOString().slice(0, 19);
}

function formatMonthYear(date) {
  var mm = String(date.getMonth() + 1).padStart(2, "0");
  return mm + "-" + date.getFullYear();
}

function monthRange(days) {
  var now = new Date();
  var cutoff = subDays(now, days);
  var months = [];
  var year = now.getFullYear();
  var month = now.getMonth();

  while (true) {
    months.push(formatMonthYear(new Date(year, month, 1)));
    if (new Date(year, month, 1) <= cutoff) break;
    month--;
    if (month < 0) { month = 11; year--; }
  }
  return months;
}

// ── Scoring engine ────────────────────────────────────────────────────────────
function textOf(release) {
  var t = release.tender || {};
  var parts = [t.title || "", t.description || ""];
  (t.lots || []).forEach(function(l) {
    parts.push((l.title || "") + " " + (l.description || ""));
  });
  (release.parties || []).forEach(function(p) { parts.push(p.name || ""); });
  return parts.join(" ").toLowerCase();
}

function buyerOf(release) {
  var buyer = (release.parties || []).filter(function(p) {
    return (p.roles || []).indexOf("buyer") !== -1;
  })[0];
  return ((buyer && buyer.name) || "").toLowerCase();
}

function scoreRelease(release) {
  var text = textOf(release);
  var buyer = buyerOf(release);

  for (var e = 0; e < CONFIG.exclusions.length; e++) {
    if (text.indexOf(CONFIG.exclusions[e].toLowerCase()) !== -1) {
      return { score: 0, matched: ["[excluded] " + CONFIG.exclusions[e]] };
    }
  }

  var score = 0;
  var matched = [];

  Object.keys(CONFIG.keywords).forEach(function(group) {
    var kw = CONFIG.keywords[group];
    for (var i = 0; i < kw.terms.length; i++) {
      if (text.indexOf(kw.terms[i].toLowerCase()) !== -1) {
        score += kw.score;
        matched.push("[" + group + "] " + kw.terms[i]);
        break; // one match per group
      }
    }
  });

  for (var k = 0; k < CONFIG.targetBuyers.terms.length; k++) {
    var term = CONFIG.targetBuyers.terms[k].toLowerCase();
    if (buyer.indexOf(term) !== -1 || text.indexOf(term) !== -1) {
      score += CONFIG.targetBuyers.score;
      matched.push("[buyer] " + CONFIG.targetBuyers.terms[k]);
      break;
    }
  }

  return { score: score, matched: matched };
}

function noticeUrl(release, source) {
  if (release._url) return release._url;
  var docs = (release.tender && release.tender.documents) || [];
  for (var i = 0; i < docs.length; i++) {
    if (docs[i].url && /notice/i.test(docs[i].documentType || "")) return docs[i].url;
  }
  if (source === "Find a Tender") {
    return "https://www.find-tender.service.gov.uk/Notice/" + (release.id || "");
  }
  if (source === "Public Contracts Scotland") {
    var pcsId = (release.id || "").replace(/^rls-\d+-/, "");
    return "https://www.publiccontractsscotland.gov.uk/search/show/search_view.aspx?ID=" + pcsId;
  }
  return "https://www.contractsfinder.service.gov.uk/Notice/" + (release.id || "").replace(/-\d+$/, "");
}

function extractFields(release, source) {
  var t = release.tender || {};
  var buyer = (release.parties || []).filter(function(p) {
    return (p.roles || []).indexOf("buyer") !== -1;
  })[0];
  var value = (t.value && t.value.amount) ||
              (t.lots && t.lots[0] && t.lots[0].value && t.lots[0].value.amount) ||
              null;
  var deadline = (t.tenderPeriod && t.tenderPeriod.endDate) || t.submissionDeadline || null;

  return {
    source:        source,
    ocid:          release.ocid || "",
    noticeId:      release.id || "",
    stage:         (release.tag || []).join(", "),
    title:         t.title || "(no title)",
    description:   (t.description || "").slice(0, 300),
    buyer:         (buyer && buyer.name) || "",
    buyerRegion:   (buyer && buyer.address && buyer.address.region) || "",
    valueCurrency: (t.value && t.value.currency) || "GBP",
    valueAmount:   value,
    published:     release.date || "",
    deadline:      deadline,
    url:           noticeUrl(release, source),
  };
}

// ── API fetchers (synchronous UrlFetchApp) ────────────────────────────────────
function fetchContractsFinder(releases, days, stages) {
  var src = CONFIG.sources.contractsFinder;
  var publishedFrom = formatISO(subDays(new Date(), days));
  var cursor = null;
  var page = 0;

  while (true) {
    var params = "publishedFrom=" + encodeURIComponent(publishedFrom) +
                 "&stages=" + encodeURIComponent(stages.join(",")) +
                 "&size=100";
    if (cursor) params += "&cursor=" + encodeURIComponent(cursor);

    var res = UrlFetchApp.fetch(src.baseUrl + src.searchPath + "?" + params, {
      headers: { Accept: "application/json" },
      muteHttpExceptions: true,
    });

    if (res.getResponseCode() === 429) { Utilities.sleep(10000); continue; }
    if (res.getResponseCode() !== 200) {
      Logger.log("[CF] HTTP " + res.getResponseCode() + " — stopping");
      break;
    }

    var data = JSON.parse(res.getContentText());
    var batch = data.releases || (data.releasePackage && data.releasePackage.releases) || [];
    if (batch.length === 0) break;

    page++;
    batch.forEach(function(r) { releases.push({ release: r, source: src.label }); });

    cursor = data.cursor || data.nextCursor || null;
    if (!cursor) break;
    Utilities.sleep(CONFIG.rateLimit);
  }
  Logger.log("[CF] " + page + " page(s), " + releases.length + " total so far");
}

function fetchFindATender(releases, days, stages) {
  var src = CONFIG.sources.findATender;
  var updatedFrom = formatISO(subDays(new Date(), days));
  var cursor = null;
  var page = 0;
  var before = releases.length;

  while (true) {
    var params = "updatedFrom=" + encodeURIComponent(updatedFrom) +
                 "&stages=" + encodeURIComponent(stages.join(",")) +
                 "&limit=100";
    if (cursor) params += "&cursor=" + encodeURIComponent(cursor);

    var res = UrlFetchApp.fetch(src.baseUrl + src.searchPath + "?" + params, {
      headers: { Accept: "application/json" },
      muteHttpExceptions: true,
    });

    if (res.getResponseCode() === 429) { Utilities.sleep(10000); continue; }
    if (res.getResponseCode() !== 200) {
      Logger.log("[FTS] HTTP " + res.getResponseCode() + " — stopping");
      break;
    }

    var data = JSON.parse(res.getContentText());
    var batch = data.releases || [];
    if (batch.length === 0) break;

    page++;
    batch.forEach(function(r) { releases.push({ release: r, source: src.label }); });

    cursor = data.cursor || data.nextCursor || null;
    if (!cursor) break;
    Utilities.sleep(CONFIG.rateLimit);
  }
  Logger.log("[FTS] " + page + " page(s), +" + (releases.length - before) + " releases");
}

var STAGE_NOTICE_TYPE = { planning: 1, tender: 2, award: 3 };

function fetchMonthBased(src, releases, days, stages) {
  var cutoff = subDays(new Date(), days);
  var before = releases.length;

  monthRange(days).forEach(function(month) {
    stages.forEach(function(stage) {
      var noticeType = STAGE_NOTICE_TYPE[stage];
      if (!noticeType) return;

      var params = "dateFrom=" + encodeURIComponent(month) +
                   "&noticeType=" + noticeType +
                   "&outputType=0";
      if (src.locale) params += "&locale=" + src.locale;

      var res;
      try {
        res = UrlFetchApp.fetch(src.baseUrl + src.searchPath + "?" + params, {
          headers: { Accept: "application/json" },
          muteHttpExceptions: true,
        });
      } catch (e) {
        Logger.log("[" + src.label + "] Network error: " + e.message);
        return;
      }

      if (res.getResponseCode() === 429) { Utilities.sleep(10000); return; }
      if (res.getResponseCode() !== 200) {
        Logger.log("[" + src.label + "] HTTP " + res.getResponseCode() + " for " + stage + "/" + month);
        return;
      }

      var data;
      try { data = JSON.parse(res.getContentText()); } catch (e) {
        Logger.log("[" + src.label + "] Bad JSON for " + stage + "/" + month);
        return;
      }

      (data.releases || []).forEach(function(r) {
        if (r.date && new Date(r.date) < cutoff) return;
        releases.push({ release: r, source: src.label });
      });

      Utilities.sleep(CONFIG.rateLimit);
    });
  });

  Logger.log("[" + src.label + "] +" + (releases.length - before) + " releases");
}

// ── Pushed-cache (stored in a Google Sheet) ───────────────────────────────────
// The spreadsheet is created automatically on first run; its ID is stored in
// Script Properties under CACHE_SPREADSHEET_ID so it persists across runs.
// Each row: [ocid, jira_key]. Only new rows are appended on each save.

var _loadedOcids = {}; // tracks what existed at load time to avoid re-appending

function getPushedSheet() {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty("CACHE_SPREADSHEET_ID");
  var ss;

  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); } catch (e) { ssId = null; }
  }

  if (!ssId) {
    ss = SpreadsheetApp.create("Contracts Finder — Pushed Cache");
    props.setProperty("CACHE_SPREADSHEET_ID", ss.getId());
    Logger.log("Created cache spreadsheet: " + ss.getUrl());
  }

  var sheet = ss.getSheetByName("PushedCache");
  if (!sheet) {
    sheet = ss.insertSheet("PushedCache");
    sheet.appendRow(["ocid", "jira_key"]);
  }
  return sheet;
}

function loadPushedCache() {
  var cache = {};
  _loadedOcids = {};
  var sheet = getPushedSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return cache; // empty or header-only

  sheet.getRange(2, 1, lastRow - 1, 2).getValues().forEach(function(row) {
    if (row[0]) {
      cache[row[0]] = row[1];
      _loadedOcids[row[0]] = true;
    }
  });
  return cache;
}

function savePushedCache(cache) {
  var sheet = getPushedSheet();
  var newRows = Object.keys(cache)
    .filter(function(ocid) { return !_loadedOcids[ocid]; })
    .map(function(ocid) { return [ocid, cache[ocid]]; });

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 2).setValues(newRows);
  }
}

// ── Jira integration ──────────────────────────────────────────────────────────
function getJiraEnv() {
  var p = PropertiesService.getScriptProperties();
  return {
    host:    p.getProperty("JIRA_HOST")      || "stef-deligia.atlassian.net",
    email:   p.getProperty("JIRA_EMAIL")     || "",
    token:   p.getProperty("JIRA_API_TOKEN") || "",
    project: p.getProperty("JIRA_PROJECT")   || "KAN",
  };
}

function authHeader() {
  var env = getJiraEnv();
  return "Basic " + Utilities.base64Encode(env.email + ":" + env.token);
}

function scoreToPriority(score) {
  if (score >= 12) return { id: "1" };
  if (score >= 8)  return { id: "2" };
  if (score >= 5)  return { id: "3" };
  if (score >= 3)  return { id: "4" };
  return { id: "5" };
}

function safeLabel(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function buildDescription(tender) {
  var rows = [["Buyer", tender.buyer], ["Stage", tender.stage]];
  if (tender.valueAmount) rows.push(["Value", "£" + tender.valueAmount.toLocaleString()]);
  if (tender.deadline)    rows.push(["Deadline", tender.deadline.slice(0, 10)]);
  rows.push(["Score", tender.score + " — " + tender.matched.join(", ")]);

  var bulletItems = rows.map(function(row) {
    return {
      type: "listItem",
      content: [{ type: "paragraph", content: [
        { type: "text", text: row[0] + ": ", marks: [{ type: "strong" }] },
        { type: "text", text: String(row[1] || "") },
      ]}],
    };
  });

  var content = [{ type: "bulletList", content: bulletItems }];

  if (tender.description) {
    content.push({ type: "paragraph", content: [{ type: "text", text: tender.description }] });
  }

  content.push({ type: "paragraph", content: [{
    type: "text",
    text: "View opportunity →",
    marks: [{ type: "link", attrs: { href: tender.url } }],
  }]});

  return { version: 1, type: "doc", content: content };
}

function createJiraIssue(tender) {
  var env = getJiraEnv();
  if (!env.email || !env.token) {
    throw new Error("JIRA_EMAIL and JIRA_API_TOKEN must be set in Script Properties");
  }

  var summary = tender.title.length > 255 ? tender.title.slice(0, 252) + "…" : tender.title;
  var labels = ["contracts-finder", safeLabel(tender.stage)]
    .concat(tender.matched.slice(0, 5).map(safeLabel))
    .filter(Boolean);

  var fields = {
    project:     { key: env.project },
    issuetype:   { id: "10001" },
    summary:     summary,
    description: buildDescription(tender),
    labels:      labels,
    priority:    scoreToPriority(tender.score),
  };
  if (tender.deadline) fields.duedate = tender.deadline.slice(0, 10);

  var headers = {
    "Authorization": authHeader(),
    "Content-Type":  "application/json",
    "Accept":        "application/json",
  };

  var res = UrlFetchApp.fetch("https://" + env.host + "/rest/api/3/issue", {
    method: "post",
    headers: headers,
    payload: JSON.stringify({ fields: fields }),
    muteHttpExceptions: true,
  });

  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    var err = JSON.parse(res.getContentText() || "{}");
    throw new Error("Jira " + code + ": " + JSON.stringify(err.errors || err.errorMessages || err));
  }

  var result = JSON.parse(res.getContentText());

  // Transition to "New Lead" column — non-fatal if it fails
  try {
    UrlFetchApp.fetch("https://" + env.host + "/rest/api/3/issue/" + result.key + "/transitions", {
      method: "post",
      headers: headers,
      payload: JSON.stringify({ transition: { id: "3" } }),
      muteHttpExceptions: true,
    });
  } catch (e) { /* best-effort */ }

  return { key: result.key, id: result.id };
}

// ── Main function (called by trigger) ─────────────────────────────────────────
function runJiraPush() {
  Logger.log("=== Contracts Finder run: " + new Date().toISOString() + " ===");

  var allReleases = [];
  var src = CONFIG.sources;

  if (src.contractsFinder.enabled)        fetchContractsFinder(allReleases, CONFIG.defaultDays, CONFIG.stages);
  if (src.findATender.enabled)            fetchFindATender(allReleases, CONFIG.defaultDays, CONFIG.stages);
  if (src.sell2wales.enabled)             fetchMonthBased(src.sell2wales, allReleases, CONFIG.defaultDays, CONFIG.stages);
  if (src.publicContractsScotland.enabled) fetchMonthBased(src.publicContractsScotland, allReleases, CONFIG.defaultDays, CONFIG.stages);

  Logger.log("Total releases fetched: " + allReleases.length);

  // Score and filter
  var allScored = [];
  allReleases.forEach(function(item) {
    var result = scoreRelease(item.release);
    if (result.score >= CONFIG.minScore) {
      var fields = extractFields(item.release, item.source);
      allScored.push(Object.assign({}, fields, { score: result.score, matched: result.matched }));
    }
  });

  allScored.sort(function(a, b) { return b.score - a.score; });
  Logger.log("Above threshold (score >= " + CONFIG.minScore + "): " + allScored.length);

  // Deduplicate against pushed cache
  var cache = loadPushedCache();
  var newTenders = allScored.filter(function(t) { return !cache[t.ocid]; });
  Logger.log("New (not yet in Jira): " + newTenders.length);

  if (newTenders.length === 0) {
    Logger.log("Nothing to push.");
    return;
  }

  var pushed = 0, failed = 0;
  newTenders.forEach(function(tender) {
    try {
      var r = createJiraIssue(tender);
      cache[tender.ocid] = r.key;
      pushed++;
      Logger.log("  Created " + r.key + " [score=" + tender.score + "] " + tender.title.slice(0, 60));
    } catch (e) {
      failed++;
      Logger.log("  FAILED: " + tender.title.slice(0, 50) + " — " + e.message);
    }
  });

  savePushedCache(cache);
  Logger.log("Done. Created: " + pushed + "  Failed: " + failed);
}

// ── Trigger setup (run once manually) ────────────────────────────────────────
function setupTrigger() {
  // Remove any existing triggers for runJiraPush to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "runJiraPush") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Daily at 08:00 UK time (Europe/London)
  ScriptApp.newTrigger("runJiraPush")
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .inTimezone("Europe/London")
    .create();

  Logger.log("Trigger created: runJiraPush daily at 08:00 Europe/London");
}
