import type { Idea, Logger, Octokit } from "./types";
import { cleanText, errorMessage } from "./text";

function markdownText(value: string, maxLength: number): string {
  return cleanText(value, maxLength).replace(/([\\`*_[\]])/g, "\\$1");
}

export function issueTitle(date: Date): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(date);
  return `🎬 This week's video ideas — ${formatted}`;
}

export function renderIssueBody(ideas: Idea[]): string {
  const sections = ideas.map(
    (idea, index) =>
      [
        `- [ ] **${index + 1}. ${markdownText(idea.title, 300)}**`,
        `  - **Hook:** ${markdownText(idea.hook, 500)}`,
        `  - **Angle:** ${markdownText(idea.angle, 1_000)}`,
        `  - **Format:** ${markdownText(idea.format, 100)} · **Source:** ${markdownText(idea.source, 200)}`
      ].join("\n")
  );
  return ["## This week's content ideas", "", ...sections].join("\n\n");
}

async function labelIfAvailable(
  octokit: Octokit,
  owner: string,
  repo: string,
  label: string,
  logger: Logger
): Promise<string[]> {
  try {
    await octokit.rest.issues.getLabel({ owner, repo, name: label });
    return [label];
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: unknown }).status)
        : undefined;
    if (status !== 404) {
      logger.warning(`Could not inspect Issue label: ${errorMessage(error)}`);
      return [];
    }
  }

  try {
    await octokit.rest.issues.createLabel({
      owner,
      repo,
      name: label,
      color: "8250df",
      description: "Weekly content ideas generated from current signals"
    });
    return [label];
  } catch (error) {
    logger.warning(`Could not create Issue label: ${errorMessage(error)}`);
    return [];
  }
}

export async function createIdeasIssue(
  octokit: Octokit,
  options: {
    owner: string;
    repo: string;
    label: string;
    ideas: Idea[];
    now: Date;
  },
  logger: Logger
): Promise<{ number: number; url: string }> {
  const labels = await labelIfAvailable(
    octokit,
    options.owner,
    options.repo,
    options.label,
    logger
  );
  const response = await octokit.rest.issues.create({
    owner: options.owner,
    repo: options.repo,
    title: issueTitle(options.now),
    body: renderIssueBody(options.ideas),
    labels
  });
  return {
    number: response.data.number,
    url: response.data.html_url
  };
}
