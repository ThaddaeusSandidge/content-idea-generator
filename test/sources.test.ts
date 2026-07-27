import { describe, expect, it, vi } from "vitest";
import { loadRecentCommits } from "../src/sources/commits";
import { loadGitHubNewAndRising } from "../src/sources/github-trending";
import { loadHackerNews } from "../src/sources/hackernews";
import { loadReddit } from "../src/sources/reddit";
import type { Octokit, SourceContext } from "../src/types";

function context(overrides: Partial<SourceContext> = {}): SourceContext {
  return {
    fetch: vi.fn() as unknown as typeof fetch,
    octokit: {} as Octokit,
    owner: "owner",
    repo: "repo",
    languages: ["typescript"],
    subreddits: ["programming"],
    since: new Date("2026-07-19T00:00:00Z"),
    logger: { info: vi.fn(), warning: vi.fn() },
    ...overrides
  };
}

describe("signal sources", () => {
  it("normalizes Hacker News hits and falls back to the discussion URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          hits: [
            { title: "A story", url: "https://example.com", points: 42 },
            { title: "Ask HN", objectID: "123", points: 5 },
            { title: "" }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const items = await loadHackerNews(
      context({ fetch: fetchMock as unknown as typeof fetch })
    );

    expect(items).toHaveLength(2);
    expect(items[1]?.url).toBe("https://news.ycombinator.com/item?id=123");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("tags=front_page"),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("parses Reddit Atom entries and uses feed order as rank", async () => {
    const atom = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry><title>First post</title><link href="https://reddit.com/1" /></entry>
        <entry><title>Second post</title><link href="https://reddit.com/2" /></entry>
      </feed>`;
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(atom, {
          status: 200,
          headers: { "content-type": "application/atom+xml" }
        })
      );

    const items = await loadReddit(
      context({ fetch: fetchMock as unknown as typeof fetch })
    );

    expect(items.map((item) => item.meta.rank)).toEqual([1, 2]);
    expect(items[0]?.meta.subreddit).toBe("programming");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/top/.rss?t=week"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringContaining("content-idea-generator")
        })
      })
    );
  });

  it("builds the GitHub new-and-rising query", async () => {
    const repos = vi.fn().mockResolvedValue({
      data: {
        items: [
          {
            full_name: "owner/new-repo",
            html_url: "https://github.com/owner/new-repo",
            description: "New project",
            stargazers_count: 100,
            language: "TypeScript"
          }
        ]
      }
    });
    const octokit = {
      rest: { search: { repos } }
    } as unknown as Octokit;

    const items = await loadGitHubNewAndRising(context({ octokit }));

    expect(items).toHaveLength(1);
    expect(repos).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'created:>=2026-07-19 language:"typescript" fork:false',
        sort: "stars",
        order: "desc"
      })
    );
  });

  it("normalizes recent commits from the current repository", async () => {
    const listCommits = vi.fn().mockResolvedValue({
      data: [
        {
          html_url: "https://github.com/owner/repo/commit/abc",
          commit: {
            message: "Build the thing\n\nMore detail",
            author: { date: "2026-07-25T12:00:00Z" }
          }
        }
      ]
    });
    const octokit = {
      rest: { repos: { listCommits } }
    } as unknown as Octokit;

    const items = await loadRecentCommits(context({ octokit }));

    expect(items[0]?.title).toBe("Build the thing");
    expect(listCommits).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        since: "2026-07-19T00:00:00.000Z"
      })
    );
  });
});
