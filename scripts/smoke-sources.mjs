import { XMLParser } from "fast-xml-parser";

const userAgent =
  "content-idea-generator-source-smoke/1.0 (+https://github.com/ThaddaeusSandidge/content-idea-generator)";

async function request(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json, application/atom+xml",
      "User-Agent": userAgent,
      ...headers
    },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response;
}

const checks = [
  {
    name: "Hacker News",
    run: async () => {
      const response = await request(
        "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=3"
      );
      const payload = await response.json();
      if (!Array.isArray(payload.hits) || payload.hits.length === 0) {
        throw new Error("no front-page hits");
      }
      return `${payload.hits.length} hits`;
    }
  },
  {
    name: "Reddit Atom",
    run: async () => {
      const response = await request(
        "https://www.reddit.com/r/programming/top/.rss?t=week"
      );
      const document = new XMLParser({
        ignoreAttributes: false,
        processEntities: true
      }).parse(await response.text());
      const entries = document.feed?.entry;
      const count = Array.isArray(entries) ? entries.length : entries ? 1 : 0;
      if (count === 0) throw new Error("no feed entries");
      return `${count} ranked entries`;
    }
  },
  {
    name: "GitHub Search",
    run: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000)
        .toISOString()
        .slice(0, 10);
      const query = encodeURIComponent(
        `created:>=${since} language:"typescript" fork:false`
      );
      const token = process.env.GITHUB_TOKEN;
      const response = await request(
        `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=3`,
        {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      );
      const payload = await response.json();
      if (!Array.isArray(payload.items) || payload.items.length === 0) {
        throw new Error("no repositories");
      }
      return `${payload.items.length} repositories`;
    }
  }
];

let failed = false;
for (const check of checks) {
  try {
    const detail = await check.run();
    console.log(`PASS ${check.name}: ${detail}`);
  } catch (error) {
    failed = true;
    console.error(
      `FAIL ${check.name}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

if (failed) process.exitCode = 1;
