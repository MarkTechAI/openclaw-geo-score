# GEO Score for OpenClaw

Score how ready a web page or a draft is to be **retrieved and cited by AI answer engines** (ChatGPT, Perplexity,
Google AI Overviews, Claude), and get the fixes that matter most, ranked by impact.

Works as an [OpenClaw](https://openclaw.ai) tool plugin and as a standalone CLI. No API keys, no external services:
the page is fetched and analysed locally.

```
GEO score 78/100 (grade B) for https://en.wikipedia.org/wiki/Intranet
retrieval 25/25 · answerability 17/25 · structure 5/15 · evidence 15.8/20 · freshness/entity 15/15
Top fixes:
1. (+5) Break long stretches with descriptive subheadings at least every 300 words.
2. (+5) Add an FAQ with 3+ real questions buyers ask, each answered in 40-120 words.
3. (+4) Start each H2/H3 section with a 40-150 word paragraph that names its subject instead of "this" or "it"; answer engines retrieve passages, not pages.
4. (+4) Phrase some subheadings the way people ask ("How does X work?"); that matches how prompts are written.
5. (+4) Back key claims with specific, sourced numbers (with year and source).
```

## Install

```bash
git clone https://github.com/MarkTechAI/openclaw-geo-score.git
cd openclaw-geo-score
npm install --omit=dev
openclaw plugins install ./
```

The compiled plugin is committed in `dist/`, so no build step is needed. Requires Node 20+ for the scorer and OpenClaw
2026.5.17 or newer for the plugin.

Then ask your assistant things like *"Score https://example.com/pricing for GEO"* or *"Check this draft for AI search
before I publish it"* and paste the text.

### Tools

| Tool | Input | Use it for |
|---|---|---|
| `geo_score_url` | `url`, optional `lang` (`auto`, `en`, `de`) | A live page |
| `geo_score_text` | `text` (Markdown or plain text), optional `lang` | A draft before publishing |

A bundled skill (`skills/geo-score`) tells the assistant how to present results: retrieval problems first, fixes in
order, and never inventing statistics to satisfy an evidence check.

### Config (optional)

```json5
{
  plugins: {
    entries: {
      "geo-score": { config: { timeoutMs: 15000, checkRobotsTxt: true, userAgent: "my-bot/1.0" } }
    }
  }
}
```

## CLI

```bash
node dist/cli.js https://example.com/blog/post
node dist/cli.js --file draft.md --lang de
node dist/cli.js https://example.com --json
```

## What is scored

19 checks in five pillars, 100 points in total.

| Pillar | Points | Checks |
|---|---:|---|
| Retrieval | 25 | HTTP 200 and no `noindex` (meta or `X-Robots-Tag`); AI retrieval bots allowed in robots.txt (OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User, Claude-SearchBot, Claude-User, Googlebot, Bingbot); main content present in the HTML before JavaScript; canonical link |
| Answerability | 25 | Answer-first opening (30-90 words); sections that open with a self-contained 40-150 word passage; question-style subheadings; a definition sentence early |
| Structure | 15 | Heading density (no stretch over 350 words); lists or tables; FAQ section or FAQPage schema |
| Evidence | 20 | Distinct external sources; statistics per 1,000 words; attributed quotes; named attributions ("according to") |
| Freshness and entity | 15 | Machine-readable dates; changed within 12 months; JSON-LD for the page type plus Organization; author |

Draft mode skips retrieval, freshness and schema and scales the score to the content checks.

**Why these weights.** An answer engine can only cite a page it can fetch and index, and it retrieves passages rather
than whole pages, so retrieval eligibility and self-contained passages carry the most weight. Stylistic gains reported
in early generative-engine-optimisation studies have not replicated reliably, so style alone earns little here.
Blocking training-only crawlers (GPTBot, Google-Extended, CCBot) is reported but not penalised: it does not stop
retrieval or citation.

**What it is not.** A heuristic readiness score. It does not predict rankings and cannot guarantee citations.

## Safety

The fetcher only accepts public http(s) URLs. It refuses hosts that resolve to private, loopback or link-local
addresses (including cloud metadata endpoints), re-checks every redirect hop, and caps responses at 3 MB with a 15 s
timeout.

## Development

```bash
npm install
npm test               # builds and runs node:test
npm run plugin:build   # requires the openclaw package: regenerates manifest metadata
npm run plugin:validate
```

## About

Built and maintained by [tchop](https://tchop.io), the platform for employee apps and branded community apps. We use
it on our own pages. Issues and pull requests are welcome.

MIT licensed.
