import * as core from "@actions/core";
import {
  SOURCE_NAMES,
  type ActionConfig,
  type SignalSourceName
} from "./types";

const MAX_LIST_ITEMS = 10;

function parseList(value: string, name: string): string[] {
  const values = [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ];

  if (values.length === 0) {
    throw new Error(`${name} must contain at least one value`);
  }
  if (values.length > MAX_LIST_ITEMS) {
    throw new Error(`${name} supports at most ${MAX_LIST_ITEMS} values`);
  }
  return values;
}

function parseSources(value: string): SignalSourceName[] {
  const values = parseList(value, "sources");
  const unknown = values.filter(
    (value) => !SOURCE_NAMES.includes(value as SignalSourceName)
  );
  if (unknown.length > 0) {
    throw new Error(
      `Unknown source${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`
    );
  }
  return values as SignalSourceName[];
}

function requiredInput(name: string): string {
  const value = core.getInput(name).trim();
  if (!value) {
    throw new Error(`Input '${name}' is required`);
  }
  return value;
}

export function readConfig(): ActionConfig {
  const openAiApiKey = requiredInput("openai-api-key");
  core.setSecret(openAiApiKey);

  const numIdeasRaw = requiredInput("num-ideas");
  const numIdeas = Number(numIdeasRaw);
  if (!Number.isInteger(numIdeas) || numIdeas < 1 || numIdeas > 25) {
    throw new Error("num-ideas must be an integer between 1 and 25");
  }

  return {
    openAiApiKey,
    githubToken: requiredInput("github-token"),
    niche: requiredInput("niche"),
    languages: parseList(requiredInput("languages"), "languages"),
    subreddits: parseList(requiredInput("subreddits"), "subreddits"),
    numIdeas,
    issueLabel: requiredInput("issue-label"),
    sources: parseSources(requiredInput("sources")),
    model: requiredInput("model")
  };
}
