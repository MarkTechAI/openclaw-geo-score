import type { RobotsInfo } from "./types.js";

/** Bots an AI engine uses to fetch a page when answering (these decide whether you can be cited). */
export const RETRIEVAL_BOTS = [
  "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User", "Claude-SearchBot", "Claude-User", "Googlebot", "Bingbot",
];
/** Training crawlers: blocking them does not stop retrieval or citation. */
export const TRAINING_BOTS = ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"];

interface Group {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

export function parseRobots(txt: string): Group[] {
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && cur) {
      cur.rules.push({ allow: key === "allow", path: val });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function matches(pattern: string, path: string): boolean {
  if (!pattern) return false;
  const re = new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
  return re.test(path);
}

/** Longest-match rule for the most specific group that names the agent, falling back to "*". */
export function isAllowed(groups: Group[], agent: string, path: string): boolean {
  const a = agent.toLowerCase();
  const own = groups.filter((g) => g.agents.some((x) => x !== "*" && a.includes(x)));
  const use = own.length ? own : groups.filter((g) => g.agents.includes("*"));
  let best: { allow: boolean; len: number } | null = null;
  for (const g of use) {
    for (const r of g.rules) {
      if (r.path === "" && !r.allow) continue; // "Disallow:" (empty) allows everything
      if (matches(r.path, path) && (!best || r.path.length > best.len || (r.path.length === best.len && r.allow))) {
        best = { allow: r.allow, len: r.path.length };
      }
    }
  }
  return best ? best.allow : true;
}

export function evaluateRobots(txt: string | null, path: string, error?: string): RobotsInfo {
  if (txt === null) return { checked: false, retrievalAllowed: {}, trainingAllowed: {}, error };
  const groups = parseRobots(txt);
  const pick = (bots: string[]) => Object.fromEntries(bots.map((b) => [b, isAllowed(groups, b, path)]));
  return { checked: true, retrievalAllowed: pick(RETRIEVAL_BOTS), trainingAllowed: pick(TRAINING_BOTS) };
}
