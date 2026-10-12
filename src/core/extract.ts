import { parse, HTMLElement } from "node-html-parser";
import type { Block, BlockType, Doc, Link } from "./types.js";
import { clean, detectLang, words } from "./text.js";

const MAIN_SELECTORS = ["article", "main", "[role=main]", ".entry-content", ".post-content", ".article-body", "#content"];
const STRIP = "script,style,noscript,template,svg,nav,header,footer,aside,form,iframe,button";
const BLOCK_TAGS = new Set(["h1", "h2", "h3", "h4", "p", "li", "blockquote", "table", "pre"]);

function walk(el: HTMLElement, out: Block[]): void {
  for (const child of el.childNodes) {
    if (!(child instanceof HTMLElement)) continue;
    const tag = child.rawTagName?.toLowerCase();
    if (tag && BLOCK_TAGS.has(tag)) {
      const text = clean(child.text);
      if (text) {
        const type: BlockType = tag === "blockquote" ? "quote" : (tag as BlockType);
        out.push({ type, text });
      }
      // Lists and quotes can contain paragraphs; tables are kept as one block.
      if (tag === "blockquote") continue;
      if (tag === "li" || tag === "table" || tag === "pre" || /^h[1-4]$/.test(tag) || tag === "p") continue;
    }
    walk(child, out);
  }
}

function pickRoot(body: HTMLElement): HTMLElement {
  let best: HTMLElement | null = null;
  let bestWords = 0;
  for (const sel of MAIN_SELECTORS) {
    for (const el of body.querySelectorAll(sel)) {
      const w = words(el.text);
      if (w > bestWords) {
        best = el;
        bestWords = w;
      }
    }
    if (best && bestWords >= 200) return best;
  }
  return best && bestWords >= 200 ? best : body;
}

function jsonLd(root: HTMLElement) {
  const types = new Set<string>();
  let datePublished: string | undefined;
  let dateModified: string | undefined;
  let hasAuthor = false;
  let hasOrganization = false;
  const visit = (o: unknown): void => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(visit);
    const obj = o as Record<string, unknown>;
    const t = obj["@type"];
    for (const x of ([] as unknown[]).concat(t ?? [])) {
      if (typeof x === "string") {
        types.add(x);
        if (x === "Organization" || x === "Corporation") hasOrganization = true;
      }
    }
    if (typeof obj.datePublished === "string") datePublished ??= obj.datePublished;
    if (typeof obj.dateModified === "string") dateModified ??= obj.dateModified;
    if (obj.author) hasAuthor = true;
    for (const v of Object.values(obj)) if (v && typeof v === "object") visit(v);
  };
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      visit(JSON.parse(s.text));
    } catch {
      /* invalid JSON-LD is reported as missing schema */
    }
  }
  return { types: [...types], datePublished, dateModified, hasAuthor, hasOrganization };
}

const meta = (root: HTMLElement, key: string): string | undefined =>
  root.querySelector(`meta[name="${key}"]`)?.getAttribute("content") ??
  root.querySelector(`meta[property="${key}"]`)?.getAttribute("content") ??
  undefined;

export function htmlToDoc(html: string, pageUrl: string): Doc {
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true, pre: true } });
  const ld = jsonLd(root);
  const scriptBytes = root.querySelectorAll("script").reduce((a, s) => a + s.rawText.length, 0);
  const body = (root.querySelector("body") ?? root) as HTMLElement;
  const main = pickRoot(body).clone() as HTMLElement;
  main.querySelectorAll(STRIP).forEach((e) => e.remove());

  let blocks: Block[] = [];
  walk(main, blocks);
  // Page builders (Framer, Webflow) often render navigation as plain <p> elements outside <nav>.
  // Treat everything before the first H1 as page chrome.
  const h1Index = blocks.findIndex((b) => b.type === "h1");
  if (h1Index > 0) blocks = blocks.slice(h1Index);
  const links: Link[] = [];
  for (const a of main.querySelectorAll("a[href]")) {
    const raw = a.getAttribute("href") || "";
    try {
      const href = new URL(raw, pageUrl).toString();
      if (/^https?:/.test(href)) links.push({ href, text: clean(a.text).slice(0, 80) });
    } catch {
      /* ignore malformed hrefs */
    }
  }
  const mainText = clean(main.text);
  const blockWords = blocks.reduce((a, b) => a + words(b.text), 0);
  // Prefer the block-based count (chrome removed) unless much of the text lives outside block elements.
  const text = blockWords >= words(mainText) * 0.5 ? blocks.map((b) => b.text).join(" ") : mainText;
  const h1 = root.querySelector("h1");
  return {
    title: clean(root.querySelector("title")?.text || h1?.text || ""),
    lang: detectLang(text, root.querySelector("html")?.getAttribute("lang") ?? undefined),
    blocks,
    links,
    lists: main.querySelectorAll("ul,ol").filter((l) => l.querySelectorAll("li").length >= 2).length,
    tables: main.querySelectorAll("table").length,
    words: words(text),
    metaDescription: meta(root, "description"),
    canonical: root.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? undefined,
    robotsMeta: [meta(root, "robots"), meta(root, "googlebot")].filter(Boolean).join(", "),
    schemaTypes: ld.types,
    datePublished: ld.datePublished ?? meta(root, "article:published_time"),
    dateModified: ld.dateModified ?? meta(root, "article:modified_time"),
    hasAuthor: ld.hasAuthor || !!meta(root, "author"),
    hasOrganization: ld.hasOrganization,
    scriptBytes,
  };
}

/** Markdown or plain-text drafts: headings, lists, tables, quotes and links are recognised. */
export function markdownToDoc(md: string): Doc {
  const blocks: Block[] = [];
  const links: Link[] = [];
  let lists = 0;
  let tables = 0;
  let inList = false;
  let inTable = false;
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "p", text: clean(para.join(" ")) });
    para = [];
  };
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    for (const m of line.matchAll(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g)) links.push({ href: m[2], text: m[1] });
    const plain = line.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`]/g, "");
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (!line) {
      flush();
      inList = false;
      inTable = false;
      continue;
    }
    if (h) {
      flush();
      blocks.push({ type: (`h${h[1].length}` as BlockType), text: clean(h[2].replace(/[*_`]/g, "")) });
      inList = inTable = false;
    } else if (/^([-*+]|\d+[.)])\s+/.test(line)) {
      flush();
      if (!inList) lists++;
      inList = true;
      blocks.push({ type: "li", text: clean(plain.replace(/^([-*+]|\d+[.)])\s+/, "")) });
    } else if (/^\|.*\|$/.test(line)) {
      flush();
      if (!inTable) {
        tables++;
        blocks.push({ type: "table", text: "" });
      }
      inTable = true;
      if (!/^\|[\s:|-]+\|$/.test(line)) blocks[blocks.length - 1].text += " " + clean(plain.replace(/\|/g, " "));
    } else if (/^>/.test(line)) {
      flush();
      blocks.push({ type: "quote", text: clean(plain.replace(/^>\s?/, "")) });
    } else {
      para.push(plain);
    }
  }
  flush();
  const text = blocks.map((b) => b.text).join(" ");
  const h1 = blocks.find((b) => b.type === "h1");
  return { title: h1?.text ?? "", lang: detectLang(text), blocks, links, lists, tables, words: words(text) };
}
