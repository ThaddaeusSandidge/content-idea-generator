import type { Fetch } from "./types";

export async function fetchOrThrow(
  fetchImpl: Fetch,
  url: string,
  init: RequestInit,
  timeoutMs = 10_000
): Promise<Response> {
  const response = await fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
  }
  return response;
}
