import { describe, expect, it, vi } from "vitest";
import {
  createIdeasIssue,
  issueTitle,
  renderIssueBody
} from "../src/issue";
import type { Idea, Octokit } from "../src/types";

const ideas: Idea[] = [
  {
    title: "Build *safer* actions",
    hook: "Your workflow has one hidden risk",
    angle: "Show the failure and the fix.",
    format: "short-form 60s",
    source: "HN"
  },
  {
    title: "A second idea",
    hook: "Stop scrolling",
    angle: "Explain the new approach.",
    format: "thread",
    source: "your commits"
  }
];

const logger = {
  info: vi.fn(),
  warning: vi.fn()
};

describe("Issue output", () => {
  it("renders a UTC date and one checkbox per idea", () => {
    expect(issueTitle(new Date("2026-03-16T23:00:00-07:00"))).toBe(
      "🎬 This week's video ideas — Mar 17"
    );
    const body = renderIssueBody(ideas);
    expect(body.match(/- \[ \]/g)).toHaveLength(2);
    expect(body).toContain("Build \\*safer\\* actions");
    expect(body).toContain("**Format:** thread · **Source:** your commits");
  });

  it("creates a missing label and exactly one Issue", async () => {
    const getLabel = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }));
    const createLabel = vi.fn().mockResolvedValue({ data: {} });
    const create = vi.fn().mockResolvedValue({
      data: { number: 7, html_url: "https://github.com/owner/repo/issues/7" }
    });
    const octokit = {
      rest: { issues: { getLabel, createLabel, create } }
    } as unknown as Octokit;

    const result = await createIdeasIssue(
      octokit,
      {
        owner: "owner",
        repo: "repo",
        label: "content-ideas",
        ideas,
        now: new Date("2026-07-26T12:00:00Z")
      },
      logger
    );

    expect(createLabel).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ["content-ideas"] })
    );
    expect(result.number).toBe(7);
  });

  it("creates the Issue without a label if label creation fails", async () => {
    const create = vi.fn().mockResolvedValue({
      data: { number: 8, html_url: "https://github.com/owner/repo/issues/8" }
    });
    const octokit = {
      rest: {
        issues: {
          getLabel: vi
            .fn()
            .mockRejectedValue(
              Object.assign(new Error("not found"), { status: 404 })
            ),
          createLabel: vi.fn().mockRejectedValue(new Error("forbidden")),
          create
        }
      }
    } as unknown as Octokit;

    await createIdeasIssue(
      octokit,
      {
        owner: "owner",
        repo: "repo",
        label: "content-ideas",
        ideas,
        now: new Date()
      },
      logger
    );

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ labels: [] }));
    expect(logger.warning).toHaveBeenCalledWith(
      expect.stringContaining("Could not create Issue label")
    );
  });
});
