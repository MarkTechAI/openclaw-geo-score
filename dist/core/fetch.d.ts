import type { FetchInfo } from "./types.js";
export interface FetchOptions {
    userAgent?: string;
    timeoutMs?: number;
    maxBytes?: number;
    /** Cancels the fetch when the calling tool run is aborted. */
    signal?: AbortSignal;
}
export declare const DEFAULT_UA = "Mozilla/5.0 (compatible; geo-score/0.1; +https://github.com/MarkTechAI/openclaw-geo-score)";
/** Refuse non-http(s) schemes and hosts that resolve to private, loopback or link-local addresses (SSRF guard). */
export declare function assertPublicUrl(u: string): Promise<URL>;
/** GET with manual redirects (each hop re-checked), a timeout and a size cap. */
export declare function fetchPage(u: string, o?: FetchOptions): Promise<{
    html: string;
    info: FetchInfo;
}>;
/** Small text fetch (robots.txt) through the same checked, redirect-safe path as page fetches. */
export declare function fetchText(u: string, o?: FetchOptions): Promise<{
    status: number;
    text: string;
}>;
