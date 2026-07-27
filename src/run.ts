import * as core from "@actions/core";
import * as github from "@actions/github";
import { gatherSignals } from "./aggregate";
import { readConfig } from "./config";
import { createIdeasIssue } from "./issue";
import { createOpenAIClient, generateIdeas } from "./llm";
import { loadRecentCommits } from "./sources/commits";
import { loadGitHubNewAndRising } from "./sources/github-trending";
import { loadHackerNews } from "./sources/hackernews";
import { loadReddit } from "./sources/reddit";
import type {
  ActionConfig,
  Fetch,
  Idea,
  Logger,
  NamedSource,
  Octokit,
  SignalItem,
  SourceContext
} from "./types";

export interface RunDependencies {
  fetch: Fetch;
  now: () => Date;
  readConfig: () => ActionConfig;
  getOctokit: (token: string) => Octokit;
  repository: { owner: string; repo: string };
  logger: Logger;
  generate: (
    config: ActionConfig,
    signals: SignalItem[],
    logger: Logger
  ) => Promise<Idea[]>;
  createIssue: (
    octokit: Octokit,
    options: {
      owner: string;
      repo: string;
      label: string;
      ideas: Idea[];
      now: Date;
    },
    logger: Logger
  ) => Promise<{ number: number; url: string }>;
  outputs: {
    set(name: string, value: string | number): void;
  };
}

export async function executeAction(
  dependencies: RunDependencies = {
    fetch: globalThis.fetch,
    now: () => new Date(),
    readConfig,
    getOctokit: github.getOctokit,
    repository: github.context.repo,
    logger: {
      info: core.info,
      warning: core.warning
    },
    generate: (config, signals, logger) =>
      generateIdeas(
        createOpenAIClient(config.openAiApiKey),
        {
          model: config.model,
          niche: config.niche,
          numIdeas: config.numIdeas,
          signals
        },
        logger
      ),
    createIssue: createIdeasIssue,
    outputs: {
      set: core.setOutput
    }
  }
): Promise<void> {
  const config = dependencies.readConfig();
  const octokit = dependencies.getOctokit(config.githubToken);
  const now = dependencies.now();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000);
  const context: SourceContext = {
    fetch: dependencies.fetch,
    octokit,
    owner: dependencies.repository.owner,
    repo: dependencies.repository.repo,
    languages: config.languages,
    subreddits: config.subreddits,
    since,
    logger: dependencies.logger
  };

  const availableSources: Record<string, NamedSource> = {
    hackernews: {
      name: "hackernews",
      load: () => loadHackerNews(context)
    },
    github: {
      name: "github",
      load: () => loadGitHubNewAndRising(context)
    },
    reddit: {
      name: "reddit",
      load: () => loadReddit(context)
    },
    commits: {
      name: "commits",
      load: () => loadRecentCommits(context)
    }
  };
  const enabledSources = config.sources.map((source) => availableSources[source]!);
  const signals = await gatherSignals(enabledSources, dependencies.logger);
  const ideas = await dependencies.generate(
    config,
    signals,
    dependencies.logger
  );
  const issue = await dependencies.createIssue(
    octokit,
    {
      owner: dependencies.repository.owner,
      repo: dependencies.repository.repo,
      label: config.issueLabel,
      ideas,
      now
    },
    dependencies.logger
  );

  dependencies.outputs.set("issue-number", issue.number);
  dependencies.outputs.set("issue-url", issue.url);
  dependencies.outputs.set("ideas-count", ideas.length);
  dependencies.logger.info(`Created Issue #${issue.number}: ${issue.url}`);
}
