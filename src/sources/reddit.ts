import { XMLParser } from "fast-xml-parser";
import { cleanText, errorMessage } from "../text";
import type { SignalItem, SourceContext } from "../types";

const REQUEST_SPACING_MS = 1_000;
const FALLBACK_RETRY_MS = 2_000;
const RETRY_JITTER_MS = 250;
const MAX_RETRY_MS = 10_000;

interface AtomLink {
  "@_href"?: unknown;
}

interface AtomEntry {
  title?: unknown;
  link?: AtomLink | AtomLink[];
}

interface RedditLoadOptions {
  sleep?: (milliseconds: number) => Promise<void>;
  spacingMs?: number;
  fallbackRetryMs?: number;
  retryJitterMs?: number;
  now?: () => number;
  random?: () => number;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryAfterMilliseconds(
  value: string | null,
  now: () => number
): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, MAX_RETRY_MS);
  }

  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.min(Math.max(date - now(), 0), MAX_RETRY_MS);
}

async function fetchFeed(
  context: SourceContext,
  subreddit: string,
  options: Required<RedditLoadOptions>
): Promise<Response> {
  const safeSubreddit = encodeURIComponent(subreddit);
  const url = `https://www.reddit.com/r/${safeSubreddit}/top/.rss?t=week`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await context.fetch(url, {
      headers: {
        Accept: "application/atom+xml",
        "User-Agent":
          "content-idea-generator/1.0 (+https://github.com/ThaddaeusSandidge/content-idea-generator)"
      },
      signal: AbortSignal.timeout(10_000)
    });
    if (response.ok) return response;

    if (response.status === 429 && attempt === 0) {
      const retryAfter =
        retryAfterMilliseconds(response.headers.get("retry-after"), options.now) ??
        options.fallbackRetryMs;
      const jitter = Math.floor(options.random() * options.retryJitterMs);
      const delay = Math.min(retryAfter + jitter, MAX_RETRY_MS);
      context.logger.warning(
        `Reddit rate limited r/${subreddit}; retrying in ${delay}ms`
      );
      await options.sleep(delay);
      continue;
    }

    throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
  }

  throw new Error(`Reddit retry exhausted for r/${subreddit}`);
}

function entryUrl(entry: AtomEntry): string | undefined {
  const links = Array.isArray(entry.link) ? entry.link : [entry.link];
  for (const link of links) {
    const href = cleanText(link?.["@_href"], 1_000);
    if (href) return href;
  }
  return undefined;
}

export async function loadReddit(
  context: SourceContext,
  overrides: RedditLoadOptions = {}
): Promise<SignalItem[]> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: true
  });
  const options: Required<RedditLoadOptions> = {
    sleep,
    spacingMs: REQUEST_SPACING_MS,
    fallbackRetryMs: FALLBACK_RETRY_MS,
    retryJitterMs: RETRY_JITTER_MS,
    now: Date.now,
    random: Math.random,
    ...overrides
  };
  const items: SignalItem[] = [];

  for (let index = 0; index < context.subreddits.length; index += 1) {
    const subreddit = context.subreddits[index];
    if (!subreddit) continue;
    if (index > 0) await options.sleep(options.spacingMs);

    try {
      const response = await fetchFeed(context, subreddit, options);
      const document = parser.parse(await response.text()) as {
        feed?: { entry?: AtomEntry | AtomEntry[] };
      };
      const rawEntries = document.feed?.entry;
      const entries = (
        Array.isArray(rawEntries) ? rawEntries : rawEntries ? [rawEntries] : []
      ).slice(0, 15);

      items.push(
        ...entries.flatMap((entry, entryIndex) => {
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
                rank: entryIndex + 1
              }
            }
          ];
        })
      );
    } catch (error) {
      context.logger.warning(
        `Reddit feed failed for r/${subreddit}: ${errorMessage(error)}`
      );
    }
  }

  if (items.length === 0) {
    throw new Error("Reddit returned no usable feed entries");
  }
  return items;
}
