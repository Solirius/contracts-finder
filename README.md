# Contracts Finder Tender Monitor
### Solirius Data & AI Practice

A Node.js tool that queries the **GOV.UK Contracts Finder API** to surface relevant tenders for the Solirius Data & AI team — scoring opportunities against past winning sectors (justice tech, education data, housing, AI/data, digital delivery) and automatically creating Jira tickets on the GTM board.

---

## Quick Start

```bash
npm install
cp .env.example .env   # fill in your Jira credentials
npm run search         # one-shot search to verify it's working
npm run jira           # push results to Jira
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run search` | One-shot search, prints results to terminal |
| `npm run jira` | Search and push new tenders to Jira GTM board |
| `npm run jira -- --dry-run` | Preview what would be pushed without creating issues |
| `npm run jira -- --days 7` | Limit search to last 7 days |
| `npm run jira -- --min-score 5` | High-relevance results only |
| `npm run jira -- --stages tender` | Live opportunities only |
| `npm run schedule -- --now` | Run the daily Jira push immediately |
| `npm run schedule` | Start daemon (runs daily at 10:00 UK time, weekdays) |
| `npm run monitor` | Run once, track new tenders in `data/seen.json` |

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

- Buyer name, contract value, tender deadline
- Relevance score and matched keywords
- Stage (Future Opportunity / Live Opportunity)
- Direct link to the Contracts Finder notice

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

Each tender is scored against keyword groups drawn from Solirius's awarded contract history:

| Group | Points | Example keywords |
|---|---|---|
| **AI** | 5 | LLM, generative AI, Azure AI, machine learning |
| **Data** | 5 | data platform, data science, ETL, learner data |
| **Justice** | 4 | HMCTS, Ministry of Justice, CFT, courts reform |
| **Target buyer** | +4 | MoJ, HMCTS, Home Office, DfE, FCDO, Ofgem, councils… |
| **Education** | 3 | DfE, ESFA, learner record, skills funding |
| **Delivery** | 3 | software engineering, managed service, G-Cloud, RM6263 |
| **Housing** | 3 | housing association, STAIRS, RSH, social housing |
| **Consulting** | 2 | digital transformation, cloud migration, Azure |

Only `planning` (Future Opportunity / Early Market Engagement) and `tender` (Opportunity) stage notices are surfaced — amendments, awards and contract notices are excluded.

Results with `score >= 3` are pushed to Jira. Use `--min-score 5` to raise the bar.

---

## Customising Filters

Edit **`src/config.js`** to adjust:

- Keyword groups and point values
- `targetBuyers` list
- `minValue` / `maxValue` thresholds (£)
- `defaultLookbackDays`
- `defaultStages`

---

## File Structure

```
contracts-finder/
├── src/
│   ├── config.js      # Keywords, filters, thresholds — edit this
│   ├── api.js         # Contracts Finder OCDS API client
│   ├── filter.js      # Keyword scoring and relevance filtering
│   ├── export.js      # CSV + JSON output
│   ├── search.js      # CLI: one-shot search
│   ├── monitor.js     # CLI: scheduled CSV monitor (no Jira)
│   ├── push-to-jira.js # CLI: manual Jira push with flags
│   ├── schedule.js    # Daily Jira push daemon (10am UK)
│   └── jira.js        # Jira REST API client
├── com.solirius.contracts-finder.plist  # macOS launchd config
├── output/            # CSVs, JSON, schedule.log (gitignored)
├── data/              # jira-pushed.json dedup cache (gitignored)
├── .env.example       # Credential template
├── package.json
└── README.md
```

---

*Built for Solirius Data & AI Practice.*
