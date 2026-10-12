import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
export const DEFAULT_UA = "Mozilla/5.0 (compatible; geo-score/0.1; +https://github.com/MarkTechAI/openclaw-geo-score)";
function isPrivate(ip) {
    if (isIP(ip) === 4) {
        const [a, b] = ip.split(".").map(Number);
        return (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224);
    }
    const v = ip.toLowerCase();
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") ||
        v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
}
/** Refuse non-http(s) schemes and hosts that resolve to private, loopback or link-local addresses (SSRF guard). */
export async function assertPublicUrl(u) {
    const url = new URL(u);
    if (url.protocol !== "http:" && url.protocol !== "https:")
        throw new Error(`Only http(s) URLs are allowed: ${u}`);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivate(a.address)))
        throw new Error(`Refusing to fetch a private address: ${host}`);
    return url;
}
/** GET with manual redirects (each hop re-checked), a timeout and a size cap. */
export async function fetchPage(u, o = {}) {
    const timeoutMs = o.timeoutMs ?? 15000;
    const maxBytes = o.maxBytes ?? 3_000_000;
    let current = u;
    for (let hop = 0; hop < 6; hop++) {
        await assertPublicUrl(current);
        const res = await fetch(current, {
            redirect: "manual",
            signal: o.signal ? AbortSignal.any([AbortSignal.timeout(timeoutMs), o.signal]) : AbortSignal.timeout(timeoutMs),
            headers: { "User-Agent": o.userAgent ?? DEFAULT_UA, Accept: "text/html,application/xhtml+xml" },
        });
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
            current = new URL(res.headers.get("location"), current).toString();
            continue;
        }
        const reader = res.body?.getReader();
        const chunks = [];
        let bytes = 0;
        if (reader) {
            for (;;) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                bytes += value.byteLength;
                if (bytes > maxBytes) {
                    await reader.cancel();
                    break;
                }
                chunks.push(value);
            }
        }
        const html = new TextDecoder("utf-8").decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
        return { html, info: { finalUrl: current, status: res.status, xRobotsTag: res.headers.get("x-robots-tag") ?? "", bytes } };
    }
    throw new Error(`Too many redirects starting at ${u}`);
}
/** Small text fetch (robots.txt) through the same checked, redirect-safe path as page fetches. */
export async function fetchText(u, o = {}) {
    const { html, info } = await fetchPage(u, { ...o, timeoutMs: o.timeoutMs ?? 10000, maxBytes: 500_000 });
    return { status: info.status, text: info.status === 200 ? html : "" };
}
