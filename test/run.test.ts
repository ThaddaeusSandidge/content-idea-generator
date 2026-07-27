import { describe, expect, it, vi } from "vitest";
import { executeAction, type RunDependencies } from "../src/run";
import type { ActionConfig, Octokit } from "../src/types";

const config: ActionConfig = {
  openAiApiKey: "secret",
  githubToken: "token",
  niche: "Developer education",
  languages: ["typescript"],
  subreddits: ["programming"],
  numIdeas: 1,
  issueLabel: "content-ideas",
  sources: ["hackernews"],
  model: "gpt-5.6-luna"
};

describe("executeAction", () => {
  it("runs the pipeline and publishes action outputs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          hits: [
            {
              title: "Signal",
              url: "https://example.com",
              points: 10
            }
          ]
        }),
        { status: 200 }
      )
    );
    const outputs = { set: vi.fn() };
    const generate = vi.fn().mockResolvedValue([
      {
        title: "Idea",
        hook: "Hook",
        angle: "Angle",
        format: "short-form 60s",
        source: "HN"
      }
    ]);
    const createIssue = vi.fn().mockResolvedValue({
      number: 12,
      url: "https://github.com/owner/repo/issues/12"
    });
    const dependencies: RunDependencies = {
      fetch: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-07-26T12:00:00Z"),
      readConfig: () => config,
      getOctokit: vi.fn().mockReturnValue({} as Octokit),
      repository: { owner: "owner", repo: "repo" },
      logger: { info: vi.fn(), warning: vi.fn() },
      generate,
      createIssue,
      outputs
    };

    await executeAction(dependencies);

    expect(generate).toHaveBeenCalledWith(
      config,
      [expect.objectContaining({ source: "hackernews", title: "Signal" })],
      dependencies.logger
    );
    expect(createIssue).toHaveBeenCalledTimes(1);
    expect(outputs.set).toHaveBeenCalledWith("issue-number", 12);
    expect(outputs.set).toHaveBeenCalledWith(
      "issue-url",
      "https://github.com/owner/repo/issues/12"
    );
    expect(outputs.set).toHaveBeenCalledWith("ideas-count", 1);
  });

  it("does not call OpenAI or GitHub Issues when all sources fail", async () => {
    const dependencies: RunDependencies = {
      fetch: vi.fn().mockResolvedValue(new Response("down", { status: 503 })),
      now: () => new Date(),
      readConfig: () => config,
      getOctokit: vi.fn().mockReturnValue({} as Octokit),
      repository: { owner: "owner", repo: "repo" },
      logger: { info: vi.fn(), warning: vi.fn() },
      generate: vi.fn(),
      createIssue: vi.fn(),
      outputs: { set: vi.fn() }
    };

    await expect(executeAction(dependencies)).rejects.toThrow(
      "All enabled signal sources failed"
    );
    expect(dependencies.generate).not.toHaveBeenCalled();
    expect(dependencies.createIssue).not.toHaveBeenCalled();
  });
});
