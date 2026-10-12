import { htmlToDoc, markdownToDoc } from "./extract.js";
import { fetchPage, fetchText } from "./fetch.js";
import { evaluateRobots } from "./robots.js";
import { scoreDoc } from "./score.js";
/** Fetch a public URL and score its readiness for AI answer engines. */
export async function scoreUrl(url, o = {}) {
    const { html, info } = await fetchPage(url, o);
    const doc = htmlToDoc(html, info.finalUrl);
    let robots;
    if (o.checkRobotsTxt !== false) {
        const origin = new URL(info.finalUrl);
        try {
            const r = await fetchText(`${origin.origin}/robots.txt`, o);
            robots = evaluateRobots(r.status === 200 ? r.text : "", origin.pathname);
        }
        catch (e) {
            robots = evaluateRobots(null, origin.pathname, e.message);
        }
    }
    return scoreDoc(doc, { source: url, mode: "url", fetch: info, robots, lang: o.lang });
}
/** Score a Markdown or plain-text draft before it is published. */
export function scoreText(text, o = {}) {
    return scoreDoc(markdownToDoc(text), { source: o.label ?? "draft", mode: "text", lang: o.lang });
}
/** Short human-readable summary, used by the CLI and handy for chat replies. */
export function summarize(r) {
    const p = r.pillars;
    const lines = [
        `GEO score ${r.score}/100 (grade ${r.grade}) for ${r.source}`,
        `retrieval ${p.retrieval.points}/${p.retrieval.max} · answerability ${p.answerability.points}/${p.answerability.max} · ` +
            `structure ${p.structure.points}/${p.structure.max} · evidence ${p.evidence.points}/${p.evidence.max} · ` +
            `freshness/entity ${p.freshness_entity.points}/${p.freshness_entity.max}`,
        "Top fixes:",
        ...r.topFixes.map((f, i) => `${i + 1}. (+${f.gain}) ${f.fix}`),
    ];
    return lines.join("\n");
}
