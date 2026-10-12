import { type FetchOptions } from "./fetch.js";
import type { Lang, ScoreResult } from "./types.js";
export type { ScoreResult, Check, Lang } from "./types.js";
export interface ScoreUrlOptions extends FetchOptions {
    lang?: Lang | "auto";
    checkRobotsTxt?: boolean;
}
/** Fetch a public URL and score its readiness for AI answer engines. */
export declare function scoreUrl(url: string, o?: ScoreUrlOptions): Promise<ScoreResult>;
/** Score a Markdown or plain-text draft before it is published. */
export declare function scoreText(text: string, o?: {
    lang?: Lang | "auto";
    label?: string;
}): ScoreResult;
/** Short human-readable summary, used by the CLI and handy for chat replies. */
export declare function summarize(r: ScoreResult): string;
