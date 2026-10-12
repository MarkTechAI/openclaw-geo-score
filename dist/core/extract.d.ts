import type { Doc } from "./types.js";
export declare function htmlToDoc(html: string, pageUrl: string): Doc;
/** Markdown or plain-text drafts: headings, lists, tables, quotes and links are recognised. */
export declare function markdownToDoc(md: string): Doc;
