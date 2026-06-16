# UK Public Sector Tender Monitor
### Solirius Data & AI Practice

A Node.js tool that queries **four UK government procurement portals** to surface relevant tenders for the Solirius Data & AI team — scoring opportunities against core sectors (housing tech, AI/data, digital delivery, consulting) and automatically creating Jira tickets on the GTM board.

| Source | Coverage |
|---|---|
| [Contracts Finder](https://www.contractsfinder.service.gov.uk) | England + UK-wide (below-threshold) |
| [Find a Tender](https://www.find-tender.service.gov.uk) | UK-wide (above-threshold / OJEU) |
| [Public Contracts Scotland](https://www.publiccontractsscotland.gov.uk) | Scotland |
| [Sell2Wales](https://www.sell2wales.gov.wales) | Wales |

Each source can be toggled on/off individually in `src/config.js`.

---

## Quick Start

```bash
npm install
cp .env.example .env   # fill in your Jira credentials
npm run search         # one-shot search across all sources
npm run jira           # push results to Jira
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

- Source portal (Contracts Finder, Find a Tender, PCS, Sell2Wales)
- Buyer name, contract value, tender deadline
- Relevance score and matched keywords
- Stage (planning / tender)
- Direct link to the notice

### Priority mapping

| Score | Jira priority |
|---|---|
| ★12+ | Highest |
| ★8–11 | High |
| ★5–7 | Medium |
| ★3–4 | Low |

### Credentials (`.env`)

```
JIRA_HOST=stef-deligia.atlassian.net
JIRA_EMAIL=your.email@example.com
JIRA_API_TOKEN=your_api_token_here
JIRA_PROJECT=GTM
```

Generate a token at: https://id.atlassian.com/manage-profile/security/api-tokens

Pushed OCIDs are tracked in `data/jira-pushed.json` — the tool never creates duplicate tickets.

---

## Daily Schedule

The tool runs automatically every weekday at **10:00 UK time** via macOS launchd.

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

Each tender is scored against keyword groups tuned for Solirius's core sectors:

| Group | Points | Example keywords |
|---|---|---|
| **Housing** | 5 | housing association, social housing, STAIRS, RSH, awaab |
| **AI** | 4 | LLM, generative AI, Azure AI, machine learning, NLP |
| **Data** | 3 | data platform, data science, ETL, Power BI, Databricks |
| **Consulting** | 2 | digital transformation, advisory, delivery partner, M365 |
| **Target buyer bonus** | +3 | housing association, registered provider, Homes England, MHCLG |

A notice must reach `minScore` (default **5**) to be included. Raise it with `--min-score`.

---

## Customising Filters

Edit **`src/config.js`** to adjust:

- Enable/disable individual sources (`sources.sell2wales.enabled`, etc.)
- Keyword groups and point values (`keywords`)
- Target buyer bonus terms (`targetBuyers`)
- `minScore` — minimum relevance score to surface a result
- `defaultDays` — default lookback window
- `stages` — which notice stages to fetch (`"planning"`, `"tender"`, `"award"`)
- `minValue` / `maxValue` — value filters in GBP (0 = disabled)

> **Note:** The Sell2Wales API (`api-sell2wales.klickstream.com`) occasionally returns server errors outside of Solirius's control. The tool will warn and skip it gracefully rather than crashing — check `output/` for results from the other three sources.

---

## How Each Source Is Fetched

| Source | Pagination | Notice type mapping |
|---|---|---|
| Contracts Finder | Cursor-based (`cursor` param) | `stages=planning,tender` |
| Find a Tender | Cursor-based (`cursor` param) | `stages=planning,tender` |
| Public Contracts Scotland | Month-based (`dateFrom=MM-YYYY`) | `noticeType=1` (planning), `2` (tender) |
| Sell2Wales | Month-based (`dateFrom=MM-YYYY`) | `noticeType=1` (planning), `2` (tender) |

---

## File Structure

```
contracts-finder/
├── src/
│   ├── config.js          # Sources, keywords, thresholds — edit this
│   ├── api.js             # Multi-source OCDS fetchers
│   ├── filter.js          # Keyword scoring engine
│   ├── export.js          # CSV + JSON output
│   ├── search.js          # CLI: one-shot search
│   ├── monitor.js         # CLI: scheduled CSV monitor (no Jira)
│   ├── push-to-jira.js    # CLI: manual Jira push with flags
│   ├── schedule.js        # Daily Jira push daemon (10am UK)
│   └── jira.js            # Jira REST API client
├── com.solirius.contracts-finder.plist  # macOS launchd config
├── output/                # CSVs, JSON, .seen-notices.json (gitignored)
├── data/                  # jira-pushed.json dedup cache (gitignored)
├── .env.example           # Credential template
├── package.json
└── README.md
```

---

*Built for Solirius Data & AI Practice.*
