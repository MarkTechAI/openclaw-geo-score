import type { Doc, FetchInfo, Lang, RobotsInfo, ScoreResult } from "./types.js";
interface Ctx {
    source: string;
    mode: "url" | "text";
    fetch?: FetchInfo;
    robots?: RobotsInfo;
    lang?: Lang | "auto";
}
export declare function scoreDoc(doc: Doc, ctx: Ctx): ScoreResult;
export {};
