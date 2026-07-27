import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readConfig } from "../src/config";

vi.mock("@actions/core", () => ({
  getInput: vi.fn(),
  setSecret: vi.fn()
}));

const defaults: Record<string, string> = {
  "openai-api-key": "secret-key",
  "github-token": "github-token",
  niche: "Developer education",
  languages: "typescript, swift,typescript",
  subreddits: "programming,webdev",
  "num-ideas": "10",
  "issue-label": "content-ideas",
  sources: "hackernews,github,reddit,commits",
  model: "gpt-5.6-luna"
};

describe("readConfig", () => {
  beforeEach(() => {
    vi.mocked(core.getInput).mockImplementation((name) => defaults[name] ?? "");
  });

  it("parses, trims, and deduplicates action inputs", () => {
    const config = readConfig();

    expect(config.languages).toEqual(["typescript", "swift"]);
    expect(config.numIdeas).toBe(10);
    expect(config.sources).toEqual([
      "hackernews",
      "github",
      "reddit",
      "commits"
    ]);
    expect(core.setSecret).toHaveBeenCalledWith("secret-key");
  });

  it("rejects unknown sources", () => {
    vi.mocked(core.getInput).mockImplementation((name) =>
      name === "sources" ? "hackernews,unknown" : (defaults[name] ?? "")
    );

    expect(() => readConfig()).toThrow("Unknown source: unknown");
  });

  it.each(["0", "26", "1.5", "nope"])(
    "rejects invalid num-ideas value %s",
    (value) => {
      vi.mocked(core.getInput).mockImplementation((name) =>
        name === "num-ideas" ? value : (defaults[name] ?? "")
      );

      expect(() => readConfig()).toThrow(
        "num-ideas must be an integer between 1 and 25"
      );
    }
  );

  it("does not include a secret value in a missing-input error", () => {
    vi.mocked(core.getInput).mockImplementation((name) =>
      name === "github-token" ? "" : (defaults[name] ?? "")
    );

    expect(() => readConfig()).toThrow("Input 'github-token' is required");
    expect(() => readConfig()).not.toThrow(/secret-key/);
  });
});
