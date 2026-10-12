#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { scoreText, scoreUrl, summarize } from "./core/index.js";
const args = process.argv.slice(2);
const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
const json = args.includes("--json");
const lang = flag("--lang") ?? "auto";
const file = flag("--file");
const url = args.find((a) => /^https?:\/\//.test(a));
async function main() {
    if (!url && !file) {
        console.error("Usage: geo-score <url> [--lang en|de] [--json]\n       geo-score --file draft.md [--lang en|de] [--json]");
        process.exit(2);
    }
    const r = url ? await scoreUrl(url, { lang }) : scoreText(readFileSync(file, "utf8"), { lang, label: file });
    console.log(json ? JSON.stringify(r, null, 2) : summarize(r));
}
main().catch((e) => {
    console.error(`geo-score: ${e.message}`);
    process.exit(1);
});
