export type Lang = "en" | "de";
export type BlockType = "h1" | "h2" | "h3" | "h4" | "p" | "li" | "quote" | "table" | "pre";
export interface Block {
    type: BlockType;
    text: string;
}
export interface Link {
    href: string;
    text: string;
}
/** Normalised view of a page or a draft, independent of the input format. */
export interface Doc {
    title: string;
    lang: Lang;
    blocks: Block[];
    links: Link[];
    lists: number;
    tables: number;
    words: number;
    /** Fields below are only known for fetched HTML pages. */
    metaDescription?: string;
    canonical?: string;
    robotsMeta?: string;
    schemaTypes?: string[];
    datePublished?: string;
    dateModified?: string;
    hasAuthor?: boolean;
    hasOrganization?: boolean;
    scriptBytes?: number;
}
export interface FetchInfo {
    finalUrl: string;
    status: number;
    xRobotsTag: string;
    bytes: number;
}
export interface RobotsInfo {
    checked: boolean;
    /** Retrieval / answer bots: these decide whether an engine can fetch the page to cite it. */
    retrievalAllowed: Record<string, boolean>;
    /** Training-only bots: blocking them does not stop citation. Reported for information. */
    trainingAllowed: Record<string, boolean>;
    error?: string;
}
export type Pillar = "retrieval" | "answerability" | "structure" | "evidence" | "freshness_entity";
export interface Check {
    id: string;
    pillar: Pillar;
    weight: number;
    points: number;
    status: "pass" | "partial" | "fail" | "n/a";
    detail: string;
    fix?: string;
}
export interface ScoreResult {
    source: string;
    mode: "url" | "text";
    lang: Lang;
    score: number;
    grade: "A" | "B" | "C" | "D" | "E";
    pillars: Record<Pillar, {
        points: number;
        max: number;
    }>;
    topFixes: {
        id: string;
        gain: number;
        fix: string;
    }[];
    checks: Check[];
    facts: Record<string, unknown>;
    note: string;
}
