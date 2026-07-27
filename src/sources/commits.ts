import { cleanText } from "../text";
import type { SignalItem, SourceContext } from "../types";

export async function loadRecentCommits(
  context: SourceContext
): Promise<SignalItem[]> {
  const response = await context.octokit.rest.repos.listCommits({
    owner: context.owner,
    repo: context.repo,
    since: context.since.toISOString(),
    per_page: 30
  });

  return response.data.flatMap((commit) => {
    const title = cleanText(commit.commit.message.split("\n")[0], 300);
    if (!title) return [];

    return [
      {
        source: "commits" as const,
        title,
        url: commit.html_url,
        meta: {
          date: cleanText(commit.commit.author?.date, 100)
        }
      }
    ];
  });
}
