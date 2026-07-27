import { cleanText, dateOnly, errorMessage } from "../text";
import type { SignalItem, SourceContext } from "../types";

export async function loadGitHubNewAndRising(
  context: SourceContext
): Promise<SignalItem[]> {
  const results = await Promise.allSettled(
    context.languages.map(async (language) => {
      const response = await context.octokit.rest.search.repos({
        q: `created:>=${dateOnly(context.since)} language:"${language}" fork:false`,
        sort: "stars",
        order: "desc",
        per_page: 10
      });

      return response.data.items.flatMap((repository) => {
        const title = cleanText(repository.full_name, 300);
        if (!title) return [];

        return [
          {
            source: "github" as const,
            title,
            url: repository.html_url,
            meta: {
              description: cleanText(repository.description, 500),
              stars: repository.stargazers_count,
              language: cleanText(repository.language ?? language, 100)
            }
          }
        ];
      });
    })
  );

  const items: SignalItem[] = [];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (result?.status === "fulfilled") {
      items.push(...result.value);
    } else if (result?.status === "rejected") {
      context.logger.warning(
        `GitHub search failed for ${context.languages[index]}: ${errorMessage(result.reason)}`
      );
    }
  }
  if (items.length === 0) {
    throw new Error("GitHub returned no usable repositories");
  }
  return items;
}
