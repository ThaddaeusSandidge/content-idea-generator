import type { getOctokit } from "@actions/github";

export const SOURCE_NAMES = [
  "hackernews",
  "github",
  "reddit",
  "commits"
] as const;

export type SignalSourceName = (typeof SOURCE_NAMES)[number];

export interface SignalItem {
  source: SignalSourceName;
  title: string;
  url?: string;
  meta: Record<string, string | number>;
}

export interface Idea {
  title: string;
  hook: string;
  angle: string;
  format: string;
  source: string;
}

export interface ActionConfig {
  openAiApiKey: string;
  githubToken: string;
  niche: string;
  languages: string[];
  subreddits: string[];
  numIdeas: number;
  issueLabel: string;
  sources: SignalSourceName[];
  model: string;
}

export interface Logger {
  info(message: string): void;
  warning(message: string): void;
}

export type Octokit = ReturnType<typeof getOctokit>;
export type Fetch = typeof fetch;

export interface SourceContext {
  fetch: Fetch;
  octokit: Octokit;
  owner: string;
  repo: string;
  languages: string[];
  subreddits: string[];
  since: Date;
  logger: Logger;
}

export interface NamedSource {
  name: SignalSourceName;
  load: () => Promise<SignalItem[]>;
}
