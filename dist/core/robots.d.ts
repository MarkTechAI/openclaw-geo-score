import type { RobotsInfo } from "./types.js";
/** Bots an AI engine uses to fetch a page when answering (these decide whether you can be cited). */
export declare const RETRIEVAL_BOTS: string[];
/** Training crawlers: blocking them does not stop retrieval or citation. */
export declare const TRAINING_BOTS: string[];
interface Group {
    agents: string[];
    rules: {
        allow: boolean;
        path: string;
    }[];
}
export declare function parseRobots(txt: string): Group[];
/** Longest-match rule for the most specific group that names the agent, falling back to "*". */
export declare function isAllowed(groups: Group[], agent: string, path: string): boolean;
export declare function evaluateRobots(txt: string | null, path: string, error?: string): RobotsInfo;
export {};
