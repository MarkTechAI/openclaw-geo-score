import { avgSentenceLength, countAttributions, countQuotes, countStats, hasDefinition, isFaqHeading, isQuestion, startsWithPronoun, words, } from "./text.js";
/**
 * Weights favour retrieval eligibility and passage quality over stylistic tweaks: an answer engine can only cite a
 * page it can fetch, index and split into self-contained passages. Stylistic "GEO" gains reported in early studies
 * have not replicated reliably, so they carry little weight here. Total = 100.
 */
const W = {
    indexable: 8, aiCrawlers: 7, serverRendered: 6, canonical: 4,
    answerFirst: 8, selfContained: 9, questionHeadings: 4, definition: 4,
    headingDensity: 5, listsTables: 5, faq: 5,
    citations: 8, statistics: 6, quotes: 3, attribution: 3,
    dated: 5, fresh: 4, schema: 3, author: 3,
};
const SOCIAL = /(^|\.)(facebook|twitter|x|linkedin|instagram|youtube|tiktok|pinterest|xing|t)\.(com|co|me)$/i;
const host = (u) => {
    try {
        return new URL(u).hostname.replace(/^www\./, "");
    }
    catch {
        return "";
    }
};
const baseDomain = (h) => h.split(".").slice(-2).join(".");
export function scoreDoc(doc, ctx) {
    const lang = ctx.lang && ctx.lang !== "auto" ? ctx.lang : doc.lang;
    const checks = [];
    const add = (id, pillar, weight, ratio, detail, fix) => {
        if (ratio === null) {
            checks.push({ id, pillar, weight, points: 0, status: "n/a", detail });
            return;
        }
        const r = Math.max(0, Math.min(1, ratio));
        checks.push({
            id, pillar, weight, points: Math.round(weight * r * 10) / 10,
            status: r >= 0.999 ? "pass" : r > 0 ? "partial" : "fail", detail, fix: r < 0.999 ? fix : undefined,
        });
    };
    const isUrl = ctx.mode === "url";
    const blocks = doc.blocks;
    // Paragraphs under 8 words are usually UI labels, captions or breadcrumbs, not prose.
    const isProse = (b) => b.type === "p" && words(b.text) >= 8;
    const paras = blocks.filter(isProse);
    const headings = blocks.filter((b) => /^h[2-4]$/.test(b.type));
    const fullText = blocks.map((b) => b.text).join(" ");
    // ---------- Retrieval ----------
    if (isUrl && ctx.fetch) {
        const noindex = /noindex|none/i.test(`${doc.robotsMeta ?? ""} ${ctx.fetch.xRobotsTag}`);
        const ok = ctx.fetch.status === 200 && !noindex;
        add("indexable", "retrieval", W.indexable, ok ? 1 : 0, `HTTP ${ctx.fetch.status}; robots meta "${doc.robotsMeta || "none"}"; X-Robots-Tag "${ctx.fetch.xRobotsTag || "none"}"`, noindex ? "Remove noindex (meta robots or X-Robots-Tag header): answer engines will not cite a page search engines exclude."
            : "Serve the page with HTTP 200.");
        if (ctx.robots?.checked) {
            const vals = Object.entries(ctx.robots.retrievalAllowed);
            const allowed = vals.filter(([, v]) => v).length;
            const blocked = vals.filter(([, v]) => !v).map(([k]) => k);
            add("ai_crawlers", "retrieval", W.aiCrawlers, allowed / vals.length, `robots.txt allows ${allowed}/${vals.length} retrieval bots${blocked.length ? `; blocked: ${blocked.join(", ")}` : ""}`, `Allow the retrieval bots in robots.txt (${blocked.join(", ")}). Blocking training-only bots (GPTBot, Google-Extended, CCBot) does not stop citation.`);
        }
        else {
            add("ai_crawlers", "retrieval", W.aiCrawlers, null, `robots.txt not checked${ctx.robots?.error ? `: ${ctx.robots.error}` : ""}`);
        }
        const jsHeavy = doc.words < 150 && (doc.scriptBytes ?? 0) > 100_000;
        add("server_rendered", "retrieval", W.serverRendered, doc.words >= 300 ? 1 : doc.words >= 150 ? 0.5 : 0, `${doc.words} words in the HTML before JavaScript runs${jsHeavy ? " (page looks client-rendered)" : ""}`, "Render the main content on the server: most AI fetchers do not run JavaScript, so text injected by scripts is invisible to them.");
        const canon = doc.canonical ? host(new URL(doc.canonical, ctx.fetch.finalUrl).toString()) : "";
        add("canonical", "retrieval", W.canonical, doc.canonical ? (canon === host(ctx.fetch.finalUrl) ? 1 : 0.5) : 0, doc.canonical ? `canonical: ${doc.canonical}` : "no canonical link", doc.canonical ? "The canonical points to another host; make sure that is intended." : "Add a self-referencing canonical link.");
    }
    else {
        for (const [id, w] of [["indexable", W.indexable], ["ai_crawlers", W.aiCrawlers], ["server_rendered", W.serverRendered], ["canonical", W.canonical]]) {
            add(id, "retrieval", w, null, "not applicable to a text draft");
        }
    }
    // ---------- Answerability ----------
    const h1At = blocks.findIndex((b) => b.type === "h1");
    const firstP = (blocks.slice(h1At + 1).find(isProse) ?? paras[0])?.text ?? "";
    const fw = words(firstP);
    add("answer_first", "answerability", W.answerFirst, !firstP ? 0 : fw >= 30 && fw <= 90 ? 1 : fw < 30 ? 0.5 : fw <= 140 ? 0.5 : 0.2, firstP ? `opening paragraph: ${fw} words` : "no opening paragraph found", "Open with a 30-90 word paragraph that answers the page's main question directly; engines quote opening passages most often.");
    const sections = [];
    blocks.forEach((b, i) => {
        if (b.type === "h2" || b.type === "h3") {
            const next = blocks.slice(i + 1).find((x) => isProse(x) || /^h[1-4]$/.test(x.type));
            sections.push({ heading: b.text, first: next && next.type === "p" ? next.text : "" });
        }
    });
    const good = sections.filter((s) => {
        const n = words(s.first);
        return n >= 40 && n <= 150 && !startsWithPronoun(s.first, lang);
    });
    add("self_contained", "answerability", W.selfContained, sections.length ? good.length / sections.length : 0, sections.length ? `${good.length}/${sections.length} sections open with a 40-150 word passage that stands on its own` : "no H2/H3 sections", "Start each H2/H3 section with a 40-150 word paragraph that names its subject instead of \"this\" or \"it\"; answer engines retrieve passages, not pages.");
    const q = headings.filter((h) => isQuestion(h.text, lang)).length;
    add("question_headings", "answerability", W.questionHeadings, headings.length ? Math.min(1, q / Math.max(2, Math.ceil(headings.length * 0.25))) : 0, `${q}/${headings.length} subheadings are phrased as questions`, "Phrase some subheadings the way people ask (\"How does X work?\"); that matches how prompts are written.");
    add("definition", "answerability", W.definition, hasDefinition(firstP, lang) ? 1 : 0, hasDefinition(firstP, lang) ? "opening contains a definition-style sentence" : "no \"X is ...\" style sentence in the opening", lang === "de" ? "Add a definition sentence early (\"X ist ...\")." : "Add a definition sentence early (\"X is ...\").");
    // ---------- Structure ----------
    let gap = 0;
    let maxGap = 0;
    for (const b of blocks) {
        if (/^h[1-4]$/.test(b.type))
            gap = 0;
        else {
            gap += words(b.text);
            maxGap = Math.max(maxGap, gap);
        }
    }
    add("heading_density", "structure", W.headingDensity, maxGap <= 350 ? 1 : maxGap <= 600 ? 0.5 : 0, `longest stretch without a heading: ${maxGap} words`, "Break long stretches with descriptive subheadings at least every 300 words.");
    add("lists_tables", "structure", W.listsTables, doc.tables ? 1 : doc.lists ? 0.7 : 0, `${doc.lists} lists, ${doc.tables} tables`, "Put comparisons in a table and steps or options in a list; structured content is extracted more reliably.");
    const faqIdx = blocks.findIndex((b) => /^h[2-4]$/.test(b.type) && isFaqHeading(b.text));
    const faqQs = faqIdx >= 0 ? blocks.slice(faqIdx + 1).filter((b) => /^h[3-4]$/.test(b.type) && isQuestion(b.text, lang)).length : 0;
    const faqSchema = (doc.schemaTypes ?? []).includes("FAQPage");
    add("faq", "structure", W.faq, faqQs >= 3 || faqSchema ? 1 : faqIdx >= 0 ? 0.5 : 0, faqIdx >= 0 ? `FAQ section with ${faqQs} questions${faqSchema ? " + FAQPage schema" : ""}` : "no FAQ section", "Add an FAQ with 3+ real questions buyers ask, each answered in 40-120 words.");
    // ---------- Evidence ----------
    const own = isUrl && ctx.fetch ? baseDomain(host(ctx.fetch.finalUrl)) : "";
    const ext = new Set(doc.links.map((l) => host(l.href)).filter((h) => h && (!own || baseDomain(h) !== own) && !SOCIAL.test(h)));
    add("citations", "evidence", W.citations, Math.min(1, ext.size / 3), `${ext.size} distinct external sources linked`, "Link 3+ primary sources (studies, official data, original reports) next to the claims they support.");
    const per1k = doc.words ? (countStats(fullText) / doc.words) * 1000 : 0;
    add("statistics", "evidence", W.statistics, Math.min(1, per1k / 3), `${Math.round(per1k * 10) / 10} statistics per 1,000 words`, "Back key claims with specific, sourced numbers (with year and source).");
    const quotes = blocks.filter((b) => b.type === "quote").length + countQuotes(fullText);
    add("quotes", "evidence", W.quotes, Math.min(1, quotes), `${quotes} quotations`, "Add one attributed quote from a named expert or customer.");
    const attrib = countAttributions(fullText, lang);
    add("attribution", "evidence", W.attribution, Math.min(1, attrib / 3), `${attrib} explicit attributions ("according to", "laut")`, "Name your sources in the sentence (\"according to …\"), not only in a link.");
    // ---------- Freshness & entity ----------
    if (isUrl) {
        const d = doc.dateModified ?? doc.datePublished;
        const age = d && !isNaN(Date.parse(d)) ? Math.floor((Date.now() - Date.parse(d)) / 86_400_000) : null;
        add("dated", "freshness_entity", W.dated, d ? 1 : 0, d ? `published ${doc.datePublished ?? "?"}, modified ${doc.dateModified ?? "?"}` : "no machine-readable date", "Expose datePublished and dateModified (JSON-LD Article/BlogPosting) and show the updated date on the page.");
        add("fresh", "freshness_entity", W.fresh, age === null ? 0 : age <= 365 ? 1 : age <= 730 ? 0.5 : 0, age === null ? "age unknown" : `last change ${age} days ago`, "Refresh the content (facts, numbers, examples) and update dateModified only when you really change it.");
        const types = doc.schemaTypes ?? [];
        const article = types.some((t) => /Article|BlogPosting|WebPage|FAQPage|HowTo|Product|DefinedTerm/.test(t));
        add("schema", "freshness_entity", W.schema, (article ? 0.6 : 0) + (doc.hasOrganization ? 0.4 : 0), types.length ? `JSON-LD: ${types.slice(0, 8).join(", ")}` : "no JSON-LD", "Add JSON-LD for the page type (Article/BlogPosting, FAQPage …) and an Organization entity.");
        add("author", "freshness_entity", W.author, doc.hasAuthor ? 1 : 0, doc.hasAuthor ? "author declared" : "no author", "Name a real author with a profile page; anonymous content is weighed as less trustworthy.");
    }
    else {
        for (const [id, w] of [["dated", W.dated], ["fresh", W.fresh], ["schema", W.schema], ["author", W.author]]) {
            add(id, "freshness_entity", w, null, "not applicable to a text draft");
        }
    }
    // ---------- Totals ----------
    const applicable = checks.filter((c) => c.status !== "n/a");
    const max = applicable.reduce((a, c) => a + c.weight, 0);
    const got = applicable.reduce((a, c) => a + c.points, 0);
    const score = max ? Math.round((got / max) * 100) : 0;
    const pillars = {};
    for (const p of ["retrieval", "answerability", "structure", "evidence", "freshness_entity"]) {
        const cs = applicable.filter((c) => c.pillar === p);
        pillars[p] = { points: Math.round(cs.reduce((a, c) => a + c.points, 0) * 10) / 10, max: cs.reduce((a, c) => a + c.weight, 0) };
    }
    const topFixes = applicable
        .filter((c) => c.fix)
        .map((c) => ({ id: c.id, gain: Math.round(((c.weight - c.points) / (max || 1)) * 100), fix: c.fix }))
        .sort((a, b) => b.gain - a.gain)
        .slice(0, 5);
    const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "E";
    return {
        source: ctx.source, mode: ctx.mode, lang, score, grade, pillars, topFixes, checks,
        facts: {
            title: doc.title, words: doc.words, sections: sections.length, avgSentenceWords: avgSentenceLength(fullText),
            externalSources: [...ext].slice(0, 15), finalUrl: ctx.fetch?.finalUrl,
            trainingBotsAllowed: ctx.robots?.trainingAllowed,
        },
        note: isUrl
            ? "Heuristic readiness score for AI answer engines (0-100). It measures whether a page can be fetched, split into self-contained passages and trusted; it does not predict rankings or citations."
            : "Draft mode: retrieval, freshness and schema checks do not apply, so the score is scaled to the content checks only.",
    };
}
