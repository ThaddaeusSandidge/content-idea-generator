import { cleanText, errorMessage } from "./text";
import type { Logger, NamedSource, SignalItem } from "./types";

const MAX_TOTAL_SIGNALS = 200;

export async function gatherSignals(
  sources: NamedSource[],
  logger: Logger
): Promise<SignalItem[]> {
  const results = await Promise.allSettled(
    sources.map(async (source) => ({
      name: source.name,
      items: await source.load()
    }))
  );

  const gathered: SignalItem[] = [];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const source = sources[index];
    if (result?.status === "fulfilled") {
      logger.info(
        `${result.value.name} produced ${result.value.items.length} signals`
      );
      gathered.push(...result.value.items);
    } else if (result?.status === "rejected") {
      logger.warning(
        `${source?.name ?? "unknown"} source failed: ${errorMessage(result.reason)}`
      );
    }
  }

  const seen = new Set<string>();
  const normalized = gathered
    .filter((item) => {
      const key = cleanText(item.url || item.title, 1_000).toLocaleLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_TOTAL_SIGNALS);

  if (normalized.length === 0) {
    throw new Error("All enabled signal sources failed or returned no usable data");
  }
  return normalized;
}
