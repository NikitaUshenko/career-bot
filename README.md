# Career Watch Telegram Bot

A small Node.js job monitor that scans **official company career feeds**, uses Gemini to classify roles and estimate Dutch compensation, and sends only qualifying jobs to Telegram.

It does not query LinkedIn, Indeed, Google Jobs, or another cross-company aggregator. Greenhouse, Lever, and Ashby adapters read the public feed that powers each configured company's own careers page.

## What it does

1. Fetches jobs from an explicit allowlist in `config/companies.json`.
2. Keeps Netherlands and Europe/EMEA-remote frontend, full-stack, UI/UX, and product-design roles.
3. Detects salary ranges published in the vacancy.
4. Uses Gemini to estimate annual Dutch base salary and total compensation.
5. Compares the conservative base estimate with separate engineering and design baselines.
6. Sends new strong or possible matches to Telegram.
7. Runs at 08:00 and 20:00 Europe/Amsterdam through GitHub Actions.
8. Commits `data/state.json` so previously processed jobs are not sent again.

## Requirements

- Node.js 20.12 or newer
- Gemini API key
- Telegram account
- GitHub repository for scheduled runs

There are no npm runtime dependencies.

## 1. Create a Telegram bot

1. Open `@BotFather` in Telegram.
2. Send `/newbot` and follow its prompts.
3. Copy the bot token.
4. Open the new bot and send `/start`.

## 2. Configure locally

Copy the example environment file:

```bash
cp .env.example .env
```

Fill in:

```env
GEMINI_API_KEY=your_key
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=
ENGINEERING_BASELINE_EUR=your_current_engineering_base
DESIGN_BASELINE_EUR=your_current_design_base
```

Use guaranteed annual gross **base salary** for both baselines. Be consistent about whether holiday allowance is included.

The bot's target is:

```text
baseline × (1 + DESIRED_IMPROVEMENT_PERCENT / 100)
```

For example, a €100,000 baseline and a 10% requirement produces a €110,000 target.

## 3. Find the Telegram chat ID

After sending `/start` to your bot:

```bash
npm run telegram:chat-id
```

Copy the printed numeric ID into `.env`:

```env
TELEGRAM_CHAT_ID=123456789
```

Verify Telegram delivery:

```bash
npm run telegram:test
```

## 4. Test the monitor

Run unit tests:

```bash
npm test
```

Preview all currently open matching jobs without Telegram messages or state changes:

```bash
npm run scan:dry
```

Evaluate current openings and send qualifying ones:

```bash
npm run scan:existing
```

Run the normal new-jobs-only scan:

```bash
npm run scan
```

### First normal run

The first successful `npm run scan` records all current jobs as the baseline and sends nothing. Future scans process only new or optionally changed jobs.

The baseline is aborted if any configured source fails on the first run. This prevents jobs from a temporarily unavailable source being treated as newly posted when it later recovers.

Use `npm run scan:existing` instead when you intentionally want Telegram messages for current vacancies.

## 5. Configure the companies

Edit `config/companies.json`. The starter list includes:

- Databricks
- JetBrains
- Planet
- Figma
- Cloudflare
- MongoDB
- Snyk
- Adyen
- IMC
- Manychat
- Flow Traders
- Datadog
- Reddit
- GitLab
- Elastic
- Grafana Labs
- Palantir

Set `"enabled": false` to temporarily skip a company.

### Greenhouse

```json
{
  "id": "example",
  "name": "Example",
  "careersUrl": "https://example.com/careers",
  "enabled": true,
  "source": {
    "type": "greenhouse",
    "boardToken": "example"
  }
}
```

The board token appears in company-specific Greenhouse URLs such as:

```text
https://job-boards.greenhouse.io/example/jobs/123
```

### Lever

```json
{
  "id": "example",
  "name": "Example",
  "careersUrl": "https://example.com/careers",
  "enabled": true,
  "source": {
    "type": "lever",
    "site": "example",
    "region": "eu"
  }
}
```

Use `"region": "global"` for `jobs.lever.co` and `"region": "eu"` for the EU Lever instance.

### Ashby

```json
{
  "id": "example",
  "name": "Example",
  "careersUrl": "https://example.com/careers",
  "enabled": true,
  "source": {
    "type": "ashby",
    "boardName": "Example"
  }
}
```

## 6. Gemini configuration

The inexpensive default is:

```env
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_USE_GOOGLE_SEARCH=false
```

For fresher company-specific salary research, use:

```env
GEMINI_MODEL=gemini-3.6-flash
GEMINI_USE_GOOGLE_SEARCH=true
```

Google Search grounding can increase cost and latency. The bot still treats all AI compensation output as an estimate.

The job description is explicitly marked as untrusted input in the prompt. Gemini returns structured JSON, which the code validates and normalizes before making a notification decision.

## 7. Push the project to GitHub

Create an empty repository, then run from this folder:

```bash
git init
git add .
git commit -m "Initial career watch bot"
git branch -M main
git remote add origin git@github.com:YOUR_USER/YOUR_REPO.git
git push -u origin main
```

## 8. Add GitHub Actions secrets and variables

Open:

```text
Repository → Settings → Secrets and variables → Actions
```

Add these **repository secrets**:

- `GEMINI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Add these **repository variables**:

- `ENGINEERING_BASELINE_EUR`
- `DESIGN_BASELINE_EUR`
- `DESIRED_IMPROVEMENT_PERCENT` — recommended starting value: `10`
- `MIN_MATCH_SCORE` — recommended starting value: `70`
- `INCLUDE_POSSIBLE_MATCHES` — `true` or `false`

Optional variables:

- `GEMINI_MODEL` — defaults to `gemini-3.5-flash-lite`
- `GEMINI_USE_GOOGLE_SEARCH` — defaults to `false`
- `MAX_AI_JOBS_PER_RUN` — defaults to `30`
- `SEND_SCAN_SUMMARY` — defaults to `false`
- `SEND_SOURCE_ERRORS` — defaults to `true`
- `NOTIFY_UPDATES` — defaults to `false`

## 9. Run it on schedule

The included `.github/workflows/scan.yml` runs at:

- 08:00 Europe/Amsterdam
- 20:00 Europe/Amsterdam

It can also be run manually from the repository's **Actions** tab. Enable **Evaluate currently open jobs** on the first manual run when you want immediate results.

The action commits `data/state.json` after a successful scan. Therefore:

- GitHub Actions needs `contents: write` permission.
- Branch protection must allow the Actions bot to push the state update.
- Deleting `data/state.json` resets deduplication.

## Salary decisions

- **Strong:** conservative base minimum meets the target.
- **Possible:** only the upper end of the base estimate meets the target.
- **Below:** the upper end remains below the target.
- **Unconfigured:** baseline is `0`; relevant roles can pass without a salary threshold.

A detected vacancy range overrides the AI estimate only when Gemini identifies it as a genuine **base salary** range. Ranges described as OTE or inclusive of incentives are not used as base salary.

## State and retries

- Jobs are deduplicated by company, ATS type, and official requisition ID.
- AI failures remain unprocessed and are retried on a later scan.
- Jobs skipped because of `MAX_AI_JOBS_PER_RUN` remain queued for the next scan.
- A company-source failure does not block the other companies after initial setup.
- If every source fails, the run exits with an error and does not modify state.

## Current limitations

- Built-in adapters cover Greenhouse, Lever, and Ashby.
- Miro, Booking.com, TomTom, and some other target employers use custom or Workday-style career systems and require extra adapters.
- AI salary estimates are directional, not offers or authoritative salary bands.
- The deterministic prefilter prioritizes precision and may miss unusually named roles.
- Repository state works well for a personal bot; a multi-user service should use a database.
