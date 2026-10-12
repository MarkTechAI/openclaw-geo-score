---
name: geo-score
description: Score a web page or a draft for AI-answer readiness (GEO) and turn the result into concrete fixes. Use when the user asks to "check GEO", "score this page for AI search", "will ChatGPT/Perplexity cite this", "is this page AI-ready", or wants feedback on a draft before publishing.
---

# GEO Score

Two tools are available:

- `geo_score_url` for a published page (pass the full https URL).
- `geo_score_text` for a draft in Markdown or plain text (paste the text).

## How to use the result

1. Lead with the score and grade, then the pillar breakdown (retrieval, answerability, structure, evidence,
   freshness/entity).
2. Retrieval comes first. If `indexable`, `ai_crawlers` or `server_rendered` fails, say so before anything else:
   an engine cannot cite a page it cannot fetch or index, so content fixes come second.
3. Present the `topFixes` in order, each with the specific place on the page it applies to. Quote the opening
   paragraph or the weak section when it helps.
4. Never invent statistics or sources to fix the evidence checks. Tell the user which claim needs a primary source.
5. For drafts, remind the user that retrieval, freshness and schema are checked once the page is live.

## What the score is and is not

It is a heuristic readiness score: can the page be fetched, split into self-contained passages and trusted? It does
not predict rankings or guarantee citations. Weights favour retrieval eligibility and passage quality over stylistic
tweaks, because stylistic gains reported in early generative-engine-optimisation studies have not replicated reliably.
