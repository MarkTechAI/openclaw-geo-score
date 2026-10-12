import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlToDoc } from "../core/extract.js";
import { scoreDoc } from "../core/score.js";
import { scoreText } from "../core/index.js";
import { evaluateRobots } from "../core/robots.js";
import { assertPublicUrl } from "../core/fetch.js";

const para = (n: number, start = "Internal communication") =>
  `${start} ${Array.from({ length: n - 2 }, (_, i) => (i % 7 === 0 ? "teams" : "word")).join(" ")}.`;

const GOOD = `<!doctype html><html lang="en"><head><title>What is an employee app? | Example</title>
<meta name="description" content="An employee app is ...">
<link rel="canonical" href="https://example.com/employee-app">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","datePublished":"${new Date().toISOString()}","dateModified":"${new Date().toISOString()}","author":{"@type":"Person","name":"A. Author"},"publisher":{"@type":"Organization","name":"Example"}}</script>
</head><body><nav>menu</nav><article><h1>What is an employee app?</h1>
<p>An employee app is a mobile app that companies use to reach staff with news, documents and two-way conversation, including people without a desk or company email. It replaces scattered email chains and notice boards with one channel.</p>
<h2>How does an employee app work?</h2><p>${para(60, "An employee app works")}</p>
<h2>Why do companies use one?</h2><p>${para(70, "Companies use an employee app")} According to the survey, 61% of staff and 2.5 million users <a href="https://www.destatis.de/x">Destatis</a> <a href="https://www.gallup.com/y">Gallup</a> <a href="https://www.oecd.org/z">OECD</a>.</p>
<blockquote>"We reached every shift for the first time in a single morning," said Jane Doe, Head of Communications.</blockquote>
<ul><li>News</li><li>Chat</li></ul><table><tr><td>a</td></tr></table>
<h2>FAQ</h2><h3>Is an employee app secure?</h3><p>${para(45, "An employee app is secure when")}</p>
<h3>How long does rollout take?</h3><p>${para(45, "Rollout of an employee app")}</p>
<h3>Can staff use their own phones?</h3><p>${para(45, "Staff can use an employee app")}</p>
</article><footer>footer</footer></body></html>`;

test("a well-structured page scores high and passes retrieval", () => {
  const doc = htmlToDoc(GOOD, "https://example.com/employee-app");
  const r = scoreDoc(doc, {
    source: "x", mode: "url", fetch: { finalUrl: "https://example.com/employee-app", status: 200, xRobotsTag: "", bytes: 1 },
    robots: evaluateRobots("User-agent: *\nAllow: /", "/employee-app"),
  });
  const byId = Object.fromEntries(r.checks.map((c) => [c.id, c]));
  assert.equal(byId.indexable.status, "pass");
  assert.equal(byId.ai_crawlers.status, "pass");
  assert.equal(byId.answer_first.status, "pass");
  assert.equal(byId.faq.status, "pass");
  assert.equal(byId.citations.status, "pass");
  assert.ok(r.score >= 70, `score ${r.score}`);
});

test("noindex and blocked AI bots fail retrieval", () => {
  const html = GOOD.replace("<head>", '<head><meta name="robots" content="noindex">');
  const doc = htmlToDoc(html, "https://example.com/employee-app");
  const r = scoreDoc(doc, {
    source: "x", mode: "url", fetch: { finalUrl: "https://example.com/employee-app", status: 200, xRobotsTag: "", bytes: 1 },
    robots: evaluateRobots("User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: PerplexityBot\nDisallow: /", "/employee-app"),
  });
  const byId = Object.fromEntries(r.checks.map((c) => [c.id, c]));
  assert.equal(byId.indexable.status, "fail");
  assert.equal(byId.ai_crawlers.status, "partial");
  assert.equal(r.topFixes[0].id, "indexable");
});

test("robots.txt: training-bot blocks do not block retrieval bots", () => {
  const r = evaluateRobots("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /", "/page");
  assert.equal(r.trainingAllowed.GPTBot, false);
  assert.equal(r.retrievalAllowed["OAI-SearchBot"], true);
});

test("draft mode scores content only and marks retrieval n/a", () => {
  const md = `# Was ist ein Intranet?\n\nEin Intranet ist ein internes Netz eines Unternehmens, in dem Beschäftigte Nachrichten, Dokumente und Werkzeuge finden. Es ist nur für Mitarbeitende zugänglich und dient der internen Kommunikation im Alltag des Unternehmens.\n\n## Wie funktioniert ein Intranet?\n\n${para(50, "Ein Intranet funktioniert")}\n\n- Nachrichten\n- Dokumente\n`;
  const r = scoreText(md);
  assert.equal(r.lang, "de");
  assert.equal(r.checks.find((c) => c.id === "indexable")?.status, "n/a");
  assert.equal(r.checks.find((c) => c.id === "definition")?.status, "pass");
  assert.ok(r.score > 0 && r.score <= 100);
});

test("SSRF guard refuses private and non-http targets", async () => {
  await assert.rejects(assertPublicUrl("http://127.0.0.1/admin"));
  await assert.rejects(assertPublicUrl("http://169.254.169.254/latest/meta-data"));
  await assert.rejects(assertPublicUrl("file:///etc/passwd"));
});
