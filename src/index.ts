import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { scoreText, scoreUrl, summarize } from "./core/index.js";

const Lang = Type.Optional(
  Type.Union([Type.Literal("auto"), Type.Literal("en"), Type.Literal("de")], {
    description: "Content language for the language-aware checks. Default: auto-detect.",
  }),
);

export default defineToolPlugin({
  id: "geo-score",
  name: "GEO Score",
  description:
    "Scores how ready a web page or a draft is to be retrieved and cited by AI answer engines (ChatGPT, Perplexity, Google AI Overviews), with ranked fixes.",
  configSchema: Type.Object({
    userAgent: Type.Optional(Type.String({ description: "User-Agent for page fetches." })),
    timeoutMs: Type.Optional(Type.Number({ minimum: 1000, maximum: 60000, description: "Fetch timeout in ms (default 15000)." })),
    checkRobotsTxt: Type.Optional(Type.Boolean({ description: "Check robots.txt for AI retrieval bots (default true)." })),
  }),
  tools: (tool) => [
    tool({
      name: "geo_score_url",
      description:
        "Fetch a public URL and score its AI-answer readiness from 0 to 100: retrieval eligibility (indexable, AI bots allowed, server-rendered), answerability (answer-first opening, self-contained sections), structure, evidence and freshness. Returns a summary, pillar scores, every check and the top fixes.",
      parameters: Type.Object({
        url: Type.String({ description: "Public http(s) URL of the page to score." }),
        lang: Lang,
      }),
      execute: async ({ url, lang }, config, context) => {
        const r = await scoreUrl(url, {
          lang: lang ?? "auto",
          userAgent: config.userAgent,
          timeoutMs: config.timeoutMs,
          checkRobotsTxt: config.checkRobotsTxt,
          signal: context?.signal,
        });
        return { summary: summarize(r), ...r };
      },
    }),
    tool({
      name: "geo_score_text",
      description:
        "Score a Markdown or plain-text draft before publishing: answer-first opening, self-contained sections, question headings, lists and tables, FAQ, sources, statistics and quotes. Retrieval and freshness checks do not apply to drafts.",
      parameters: Type.Object({
        text: Type.String({ description: "The draft in Markdown or plain text." }),
        lang: Lang,
      }),
      execute: ({ text, lang }) => {
        const r = scoreText(text, { lang: lang ?? "auto" });
        return { summary: summarize(r), ...r };
      },
    }),
  ],
});
