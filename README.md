# Contracts Finder Tender Monitor
### Solirius Data & AI Practice

A lightweight Node.js tool that queries the **GOV.UK Contracts Finder API** to surface relevant tenders for the Solirius Data & AI team — focusing on public sector Data, AI, digital transformation, and Housing Association opportunities.

---

## Quick Start

```bash
cd contracts-finder
npm install
npm run search
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run search` | One-shot search over the last 30 days |
| `node src/search.js --days 7` | Last 7 days only |
| `node src/search.js --stages tender` | Live tenders only (no futures) |
| `node src/search.js --stages planning` | Future opportunities only |
| `node src/search.js --from 2024-10-01` | From a specific date |
| `node src/search.js --min-score 5` | High-relevance results only |
| `npm run monitor` | Run once, track new tenders in `data/seen.json` |
| `node src/monitor.js --cron` | Run daily at 08:00 (weekdays) |

---

## How Scoring Works

Each tender is scored against Solirius keyword groups:

| Group | Points | Example keywords |
|---|---|---|
| **Housing** | 5 | housing association, STAIRS, RSH, tenants, repairs |
| **AI** | 4 | Azure AI, copilot, LLM, generative AI, machine learning |
| **Data** | 3 | data platform, data strategy, ETL, data lake |
| **Consulting** | 2 | digital transformation, cloud migration, Azure |
| **Target buyer** | +3 | councils, housing providers, MHCLG, GDS |

Results are sorted by score descending. Use `--min-score 5` to see only strong matches.

---

## Customising Filters

Edit **`src/config.js`** to:

- Add/remove keywords per group
- Change `minValue` / `maxValue` thresholds (£)
- Add buyer names to `targetBuyers`
- Adjust `defaultLookbackDays`

---

## Output

Results are written to `output/`:

- `tenders_YYYY-MM-DD.csv` — importable to Excel / Sheets
- `tenders_YYYY-MM-DD.json` — structured data for downstream use

The monitor also tracks seen OCIDs in `data/seen.json` so repeat runs don't surface duplicates.

---

## API Notes

- **No authentication required** for reading published notices (OCDS endpoint)
- Rate limit: ~100 requests / 5 minutes — the tool automatically paces requests
- Data source: `https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search`
- Stages: `planning` (Future Opportunities) · `tender` (Live ITTs) · `award`

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
│   └── monitor.js     # CLI: scheduled daily monitor
├── output/            # Generated CSVs and JSON (gitignored)
├── data/              # seen.json for dedup tracking (gitignored)
├── package.json
└── README.md
```

---

*Built for Solirius Data & AI Practice — Housing Association sector focus.*
