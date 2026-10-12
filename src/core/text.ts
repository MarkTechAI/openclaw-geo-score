import type { Lang } from "./types.js";

export const words = (t: string): number => (t.trim() ? t.trim().split(/\s+/).length : 0);

export const clean = (t: string): string => t.replace(/\s+/g, " ").trim();

const DE_HINTS = /\b(und|der|die|das|nicht|mit|für|ist|sind|eine|auf|auch|werden|wir|sie)\b/gi;
const EN_HINTS = /\b(and|the|not|with|for|is|are|this|that|have|from|which|you|they)\b/gi;

export function detectLang(text: string, declared?: string): Lang {
  const d = (declared || "").toLowerCase();
  if (d.startsWith("de")) return "de";
  if (d.startsWith("en")) return "en";
  const de = (text.match(DE_HINTS) || []).length;
  const en = (text.match(EN_HINTS) || []).length;
  return de > en ? "de" : "en";
}

const QUESTION_START: Record<Lang, RegExp> = {
  en: /^(what|how|why|when|where|which|who|can|is|are|does|do|should|will)\b/i,
  de: /^(was|wie|warum|wieso|weshalb|wann|wo|welche[rsmn]?|wer|kann|können|ist|sind|braucht|lohnt|muss|sollte)\b/i,
};

export const isQuestion = (heading: string, lang: Lang): boolean =>
  /\?\s*$/.test(heading.trim()) || QUESTION_START[lang].test(heading.trim());

const PRONOUN_START: Record<Lang, RegExp> = {
  en: /^(this|it|they|these|those|that|here|such)\b/i,
  de: /^(dies|diese[rsmn]?|es|sie|das|hier|dabei|damit|dazu|solche)\b/i,
};

/** A passage that opens with a pronoun depends on context and extracts badly. */
export const startsWithPronoun = (t: string, lang: Lang): boolean => PRONOUN_START[lang].test(t.trim());

const DEFINITION: Record<Lang, RegExp> = {
  en: /\b(is|are|refers to|means|describes|stands for)\b/i,
  de: /\b(ist|sind|bezeichnet|bedeutet|beschreibt|steht für|meint)\b/i,
};

export const hasDefinition = (t: string, lang: Lang): boolean =>
  DEFINITION[lang].test(t.split(/\s+/).slice(0, 25).join(" "));

const STAT = /(\b\d+([.,]\d+)?\s?(%|percent|per cent|prozent|million|mio\.?|billion|bn|mrd\.?|milliarden|x)\b|\b\d+([.,]\d+)?\s?%)/gi;
export const countStats = (t: string): number => (t.match(STAT) || []).length;

const ATTRIBUTION: Record<Lang, RegExp> = {
  en: /\b(according to|said|says|reports?|found that|survey|study|source:)\b/gi,
  de: /\b(laut|zufolge|sagt|sagte|berichtet|ergab|studie|umfrage|quelle:)\b/gi,
};
export const countAttributions = (t: string, lang: Lang): number => (t.match(ATTRIBUTION[lang]) || []).length;

const QUOTE = /[“"„«]([^”"“»]{25,400})[”"“»]/g;
export const countQuotes = (t: string): number => (t.match(QUOTE) || []).length;

const FAQ_HEADING = /\b(faq|frequently asked|common questions|häufig gestellte|häufige fragen|fragen und antworten)\b/i;
export const isFaqHeading = (h: string): boolean => FAQ_HEADING.test(h);

/** Avg sentence length in words; long sentences extract and summarise worse. */
export function avgSentenceLength(t: string): number {
  const s = t.split(/(?<=[.!?])\s+/).filter((x) => words(x) > 2);
  if (!s.length) return 0;
  return Math.round((s.reduce((a, x) => a + words(x), 0) / s.length) * 10) / 10;
}
