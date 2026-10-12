import type { Lang } from "./types.js";
export declare const words: (t: string) => number;
export declare const clean: (t: string) => string;
export declare function detectLang(text: string, declared?: string): Lang;
export declare const isQuestion: (heading: string, lang: Lang) => boolean;
/** A passage that opens with a pronoun depends on context and extracts badly. */
export declare const startsWithPronoun: (t: string, lang: Lang) => boolean;
export declare const hasDefinition: (t: string, lang: Lang) => boolean;
export declare const countStats: (t: string) => number;
export declare const countAttributions: (t: string, lang: Lang) => number;
export declare const countQuotes: (t: string) => number;
export declare const isFaqHeading: (h: string) => boolean;
/** Avg sentence length in words; long sentences extract and summarise worse. */
export declare function avgSentenceLength(t: string): number;
