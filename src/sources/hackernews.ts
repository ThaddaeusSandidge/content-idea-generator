import { fetchOrThrow } from "../http";
import { cleanText } from "../text";
import type { SignalItem, SourceContext } from "../types";

interface HackerNewsHit {
  title?: unknown;
  url?: unknown;
  points?: unknown;
  objectID?: unknown;
}

export async function loadHackerNews(
  context: SourceContext
): Promise<SignalItem[]> {
  const response = await fetchOrThrow(
    context.fetch,
    "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30",
    {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "content-idea-generator/1.0 (+https://github.com/ThaddaeusSandidge/content-idea-generator)"
      }
    }
  );
  const payload = (await response.json()) as { hits?: HackerNewsHit[] };

  return (payload.hits ?? []).flatMap((hit) => {
    const title = cleanText(hit.title, 300);
    if (!title) return [];

    const objectId = cleanText(hit.objectID, 100);
    const suppliedUrl = cleanText(hit.url, 1_000);
    const url =
      suppliedUrl ||
      (objectId ? `https://news.ycombinator.com/item?id=${objectId}` : undefined);
    const points = Number(hit.points);

    return [
      {
        source: "hackernews" as const,
        title,
        ...(url ? { url } : {}),
        meta: {
          ...(Number.isFinite(points) ? { points } : {})
        }
      }
    ];
  });
}
