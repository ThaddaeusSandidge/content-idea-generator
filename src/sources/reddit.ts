import { XMLParser } from "fast-xml-parser";
import { fetchOrThrow } from "../http";
import { cleanText, errorMessage } from "../text";
import type { SignalItem, SourceContext } from "../types";

interface AtomLink {
  "@_href"?: unknown;
}

interface AtomEntry {
  title?: unknown;
  link?: AtomLink | AtomLink[];
}

function entryUrl(entry: AtomEntry): string | undefined {
  const links = Array.isArray(entry.link) ? entry.link : [entry.link];
  for (const link of links) {
    const href = cleanText(link?.["@_href"], 1_000);
    if (href) return href;
  }
  return undefined;
}

export async function loadReddit(context: SourceContext): Promise<SignalItem[]> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: true
  });
  const results = await Promise.allSettled(
    context.subreddits.map(async (subreddit) => {
      const safeSubreddit = encodeURIComponent(subreddit);
      const response = await fetchOrThrow(
        context.fetch,
        `https://www.reddit.com/r/${safeSubreddit}/top/.rss?t=week`,
        {
          headers: {
            Accept: "application/atom+xml",
            "User-Agent":
              "content-idea-generator/1.0 (+https://github.com/ThaddaeusSandidge/content-idea-generator)"
          }
        }
      );
      const document = parser.parse(await response.text()) as {
        feed?: { entry?: AtomEntry | AtomEntry[] };
      };
      const rawEntries = document.feed?.entry;
      const entries = (
        Array.isArray(rawEntries) ? rawEntries : rawEntries ? [rawEntries] : []
      ).slice(0, 15);

      return entries.flatMap((entry, index) => {
        const title = cleanText(entry.title, 300);
        if (!title) return [];
        const url = entryUrl(entry);
        return [
          {
            source: "reddit" as const,
            title,
            ...(url ? { url } : {}),
            meta: {
              subreddit,
              rank: index + 1
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
        `Reddit feed failed for r/${context.subreddits[index]}: ${errorMessage(result.reason)}`
      );
    }
  }
  if (items.length === 0) {
    throw new Error("Reddit returned no usable feed entries");
  }
  return items;
}
