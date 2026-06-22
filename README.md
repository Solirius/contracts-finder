# UK Public Sector Tender Monitor
### Solirius Data & AI Practice

A Node.js tool that monitors **eight UK procurement sources** to surface relevant tenders for the Solirius Data & AI team — scoring opportunities against core sectors (housing tech, AI/data, digital delivery, consulting) and automatically creating Jira tickets on the GTM board.

### Open OCDS APIs (no login required)

| Source | Coverage |
|---|---|
| [Contracts Finder](https://www.contractsfinder.service.gov.uk) | England + UK-wide (below-threshold) |
| [Find a Tender](https://www.find-tender.service.gov.uk) | UK-wide (above-threshold / OJEU) |
| [Public Contracts Scotland](https://www.publiccontractsscotland.gov.uk) | Scotland |
| [Sell2Wales](https://www.sell2wales.gov.wales) | Wales |

### Authenticated portals (Playwright headless browser)

| Portal | Platform | Buyers covered |
|---|---|---|
| [Crown Commercial Service](https://crowncommercialservice.bravosolution.co.uk) | BravoSolution | GCA / Cabinet Office framework lots |
| [Home Office](https://homeoffice.app.jaggaer.com) | JAGGAER | Home Office |
| [Department for Education](https://education.app.jaggaer.com) | JAGGAER | DfE |
| [Department for Business & Trade](https://uktrade.app.jaggaer.com) | JAGGAER | DIT / DBT |

Each source can be toggled on/off individually in `src/config.js`.

---

## Quick Start

```bash
npm install
npx playwright install chromium   # required for authenticated portals
cp .env.example .env              # fill in Jira + portal credentials
npm run search                    # one-shot search across all sources
npm run jira                      # push results to Jira
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run search` | One-shot search across all enabled sources |
| `npm run search -- --days 7` | Limit to last 7 days |
| `npm run search -- --min-score 5` | High-relevance results only |
| `npm run search -- --stages tender` | Live opportunities only |
| `npm run jira` | Search and push new tenders to Jira GTM board |
| `npm run jira -- --dry-run` | Preview what would be pushed without creating issues |
| `npm run jira -- --days 7` | Limit search to last 7 days |
| `npm run jira -- --min-score 5` | High-relevance results only |
| `npm run schedule -- --now` | Run the daily Jira push immediately |
| `npm run schedule` | Start daemon (runs daily at 10:00 UK time, weekdays) |
| `npm run monitor` | Run once, track new tenders in `output/.seen-notices.json` |

---

## Jira Integration

New tenders are created as **Tasks** on the [GTM board](https://stef-deligia.atlassian.net/jira/software/projects/GTM/boards/1) and land in the **New Lead** column automatically.

### Board columns

| Column | Meaning |
|---|---|
| **Triage** | Default entry point for new issues |
| **New Lead** | Opportunity identified by the scanner |
| **Bid Writing** | Actively working on a bid |
| **Submitted** | Bid submitted, awaiting outcome |
| **Closed** | Won / lost / no bid |

### Each Jira ticket includes

- Source portal name
- Buyer name, contract value, tender deadline
- Relevance score and matched keywords
- Stage (planning / tender)
- Direct link to the notice or ITT

### Priority mapping

| Score | Jira priority |
|---|---|
| ★12+ | Highest |
| ★8–11 | High |
| ★7 | Medium |

With `minScore` set to 7, only Medium and above reach Jira.

### Deduplication

Pushed OCIDs (and ITT codes for authenticated portals) are tracked in `data/jira-pushed.json` — the tool never creates duplicate tickets.

### Credentials (`.env`)

```
JIRA_HOST=stef-deligia.atlassian.net
JIRA_EMAIL=your.email@example.com
JIRA_API_TOKEN=your_api_token_here
JIRA_PROJECT=GTM

# Authenticated portal credentials
BRAVO_USER=bidteam@solirius.com
BRAVO_PASS=<GCA / Home Office password>
BRAVO_DFE_PASS=<DfE password>
BRAVO_DIT_PASS=<DIT/DBT password>
```

Generate a Jira token at: https://id.atlassian.com/manage-profile/security/api-tokens

---

## Daily Schedule

| Schedule | Time | Sources covered | How it runs |
|---|---|---|---|
| **Google Apps Script** (primary) | 08:00 UK time, every day | 4 open OCDS sources | Google's cloud — no Mac required |
| **macOS launchd** (secondary) | 10:00 UK time, weekdays only | All 8 sources (OCDS + authenticated portals) | Requires the Mac to be on |

The Apps Script trigger is installed by running `setupTrigger()` once in the Apps Script editor (see [Google Apps Script Integration](#google-apps-script-integration) above).

### macOS launchd

```bash
# Check it's installed
launchctl list | grep solirius

# Trigger manually
npm run schedule -- --now

# View logs
cat output/schedule.log
```

The plist is at `com.solirius.contracts-finder.plist`. To reinstall after changes:

```bash
launchctl unload ~/Library/LaunchAgents/com.solirius.contracts-finder.plist
cp com.solirius.contracts-finder.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.solirius.contracts-finder.plist
```

---

## How Scoring Works

Each tender is scored against keyword groups tuned for Solirius's core sectors. **One match per group per tender** — repeated keywords don't stack.

### Tier 1 — core Data & AI practice (+5)

| Group | Points | Example keywords |
|---|---|---|
| **AI** | +5 | artificial intelligence, machine learning, large language model, LLM, generative AI, Azure AI, Copilot, ChatGPT, AI strategy, AI platform, cognitive services, NLP, computer vision, AI foundry, ai engineering, data & ai |
| **Data** | +5 | data platform, data strategy, data governance, data engineering, data science, data analytics, data warehouse, data lake, business intelligence, ETL, data pipeline, data architecture, data mesh, Power BI, Fabric, Databricks, Snowflake |

### Tier 2 — primary service lines (+4)

| Group | Points | Example keywords |
|---|---|---|
| **Delivery** | +4 | agile delivery, delivery manager, product delivery, digital delivery, programme delivery, agile transformation, agile coaching, G-Cloud, Scrum, SAFe, managed service, programme management, portfolio management |
| **Security** | +4 | cyber security, cybersecurity, information security, security architecture, penetration testing, vulnerability assessment, Cyber Essentials, ISO 27001, NCSC, security assurance, DAST, SAST, threat modelling, IAM |
| **Cloud Architecture** | +4 | cloud adoption, cloud migration, cloud architecture, cloud strategy, cloud native, enterprise architecture, solution architecture, technical architecture, TOGAF, well-architected, AWS, target operating model |

### Tier 3 — supporting capabilities (+3)

| Group | Points | Example keywords |
|---|---|---|
| **Software Engineering** | +3 | software engineering, software development, application development, full stack, microservices, API development, Java, Spring Boot, backend development, frontend development, software architect |
| **DevOps** | +3 | DevOps, site reliability, SRE, infrastructure as code, Kubernetes, Docker, containerisation, CI/CD, GitOps, platform engineering, cloud infrastructure, Jenkins |
| **Integration** | +3 | integration architecture, system integration, enterprise integration, API integration, API management, API gateway, middleware, event-driven architecture, integration platform, ERP integration |
| **Microsoft** | +3 | Power Platform, Power Apps, Power Automate, SharePoint, Dynamics 365, Azure DevOps, Microsoft Azure, M365, Microsoft 365, SQL Server, Microsoft partner |
| **Government Digital** | +3 | GDS, Government Digital Service, CDDO, service standard, service assessment, alpha phase, beta phase, discovery phase, digital service standard, GOV.UK, digital public service |
| **Business Design** | +3 | business analysis, business analyst, service design, user research, user experience, UX, operating model, business change, organisational design, process design, business architecture, stakeholder management |

### Tier 4 — context signals (+2)

| Group | Points | Example keywords |
|---|---|---|
| **Consulting** | +2 | digital transformation, technology consulting, technology strategy, IT strategy, technology advisory, digital advisory, business transformation, enterprise transformation, strategic consulting |

### Target buyer bonus (+4)

| Group | Points | Example buyers |
|---|---|---|
| **Target buyers** | +4 | MoJ, HMCTS, Home Office, DfE, FCDO, Ofgem, MHCLG, Homes England, DLUHC, Cabinet Office, HMRC, DVLA, DVSA, Companies House, housing association, registered provider |

A notice must reach `minScore` (default **7**) to be included. Raise it with `--min-score`.

### Hard exclusions

Any tender whose title or description matches one of the exclusion phrases is dropped entirely, regardless of score — no Jira ticket is created. Current exclusions cover non-digital categories such as facilities management, cleaning, catering, grounds maintenance, civil engineering, and medical staffing.

The full lists are in `src/config.js` under `keywords`, `targetBuyers`, and `exclusions`.

---

## Customising Filters

Edit **`src/config.js`** to adjust:

- Enable/disable individual OCDS sources (`sources.sell2wales.enabled`, etc.)
- Enable/disable individual authenticated portals (each entry in `sources.bravoSolutions`)
- Keyword groups and point values (`keywords`)
- Target buyer bonus terms (`targetBuyers`)
- Hard-exclusion phrases (`exclusions`) — tenders matching any phrase are dropped before scoring
- `minScore` — minimum relevance score to surface a result (default **7**)
- `defaultDays` — default lookback window
- `stages` — which notice stages to fetch (`"planning"`, `"tender"`, `"award"`)
- `minValue` / `maxValue` — value filters in GBP (0 = disabled)

> **Note on Sell2Wales:** The Sell2Wales API (`api-sell2wales.klickstream.com`) occasionally returns server errors outside of Solirius's control. The tool warns and skips it gracefully rather than crashing.

---

## How Each Source Is Fetched

| Source | Method | Notes |
|---|---|---|
| Contracts Finder | REST / OCDS | Cursor-based pagination |
| Find a Tender | REST / OCDS | Cursor-based pagination |
| Public Contracts Scotland | REST / OCDS | Month-based (`dateFrom=MM-YYYY`). Requires `sectigo-intermediate.pem` for TLS |
| Sell2Wales | REST / OCDS | Month-based (`dateFrom=MM-YYYY`) |
| BravoSolution / JAGGAER portals | Playwright (headless Chromium) | Logs in, navigates to My ITTs, scrapes running opportunities |

### Authenticated portal details

`src/portals.js` implements the BravoSolution/JAGGAER scraper. All portals in the family share the same `/web/login.html` login page and ITT list structure — only the base URL and credentials differ. Each entry in `sources.bravoSolutions` in `config.js` specifies:

```js
{
  enabled: true,
  baseUrl: "https://example.app.jaggaer.com",
  label: "JAGGAER (Example Dept)",
  userEnv: "BRAVO_USER",          // env var name for the username
  passEnv: "BRAVO_EXAMPLE_PASS",  // env var name for the password
}
```

To add a new portal, append an entry to the array and add the corresponding env vars to `.env`.

---

## Google Apps Script Integration

The scoring and Jira push logic lives in `appscript/Code.gs` and runs as a **Google Apps Script** triggered daily at **08:00 UK time** — this is the **primary schedule**. Because it runs in Google's cloud it doesn't depend on the Mac being online or awake.

The Apps Script version covers the four open OCDS sources only (authenticated portal scraping requires Playwright, which can't run in Apps Script). For the authenticated portals (BravoSolution / JAGGAER) the macOS launchd job still runs as a secondary pass at 10:00 on weekdays.

### One-time trigger setup

Run this once in the Apps Script editor to install the daily trigger:

```
setupTrigger()   // creates a daily 08:00 Europe/London trigger for runJiraPush
```

Credentials must be set in **Project Settings → Script Properties**:

```
JIRA_EMAIL        your Atlassian account email
JIRA_API_TOKEN    your Jira API token
JIRA_HOST         e.g. stef-deligia.atlassian.net  (optional)
JIRA_PROJECT      e.g. GTM  (optional)
```

The deduplication cache is stored in a Google Sheet created automatically on first run — its ID is saved in Script Properties under `CACHE_SPREADSHEET_ID`.

### Keeping both versions in sync

The repo is linked to the Apps Script project via [clasp](https://developers.google.com/apps-script/guides/clasp). Any change to keywords, scoring values, or Jira logic **must** be applied to both files:

- `src/config.js` / `src/*.js` — Node.js version
- `appscript/Code.gs` — Apps Script version

A post-push hook in `.claude/settings.json` runs `clasp push` automatically after every `git push`.

### Manual sync

```bash
clasp push   # push local appscript/ to Google Apps Script
clasp pull   # pull current Apps Script back (rarely needed)
```

---

## File Structure

```
contracts-finder/
├── src/
│   ├── config.js          # Sources, keywords, thresholds — edit this
│   ├── api.js             # Multi-source OCDS fetchers + portal orchestration
│   ├── portals.js         # Playwright scrapers for BravoSolution / JAGGAER
│   ├── filter.js          # Keyword scoring engine
│   ├── export.js          # CSV + JSON output
│   ├── search.js          # CLI: one-shot search
│   ├── monitor.js         # CLI: scheduled CSV monitor (no Jira)
│   ├── push-to-jira.js    # CLI: manual Jira push with flags
│   ├── schedule.js        # Daily Jira push daemon (10am UK)
│   └── jira.js            # Jira REST API client
├── appscript/
│   ├── Code.gs            # Google Apps Script mirror (OCDS sources only)
│   └── appsscript.json    # Apps Script manifest
├── .clasp.json            # Links repo to Apps Script project (clasp)
├── sectigo-intermediate.pem  # Intermediate CA cert for PCS TLS
├── com.solirius.contracts-finder.plist  # macOS launchd config
├── output/                # CSVs, JSON, .seen-notices.json (gitignored)
├── data/                  # jira-pushed.json dedup cache (gitignored)
├── .env.example           # Credential template
├── package.json
└── README.md
```

---

*Built for Solirius Data & AI Practice.*
