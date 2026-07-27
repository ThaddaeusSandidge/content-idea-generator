import { describe, expect, it, vi } from "vitest";
import {
  generateIdeas,
  type OpenAIClientLike
} from "../src/llm";

const logger = {
  info: vi.fn(),
  warning: vi.fn()
};

const signals = [
  {
    source: "hackernews" as const,
    title: "A useful signal",
    url: "https://example.com",
    meta: { points: 100 }
  }
];

function idea(index: number) {
  return {
    title: `Idea ${index}`,
    hook: `Hook ${index}`,
    angle: `Angle ${index}`,
    format: "short-form 60s",
    source: "Hacker News"
  };
}

describe("generateIdeas", () => {
  it("returns an exact structured response", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: { ideas: [idea(1), idea(2)] }
    });

    const result = await generateIdeas(
      { responses: { parse } } as OpenAIClientLike,
      {
        model: "gpt-5.6-luna",
        niche: "Developer education",
        numIdeas: 2,
        signals
      },
      logger
    );

    expect(result).toHaveLength(2);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.6-luna",
        store: false,
        reasoning: { effort: "low" }
      })
    );
  });

  it("retries one contract mismatch and then succeeds", async () => {
    const parse = vi
      .fn()
      .mockResolvedValueOnce({ output_parsed: { ideas: [idea(1)] } })
      .mockResolvedValueOnce({
        output_parsed: { ideas: [idea(1), idea(2)] }
      });

    const result = await generateIdeas(
      { responses: { parse } } as OpenAIClientLike,
      {
        model: "gpt-5.6-luna",
        niche: "Developer education",
        numIdeas: 2,
        signals
      },
      logger
    );

    expect(result).toHaveLength(2);
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("does not retry an authentication error", async () => {
    const parse = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("bad key"), { status: 401 }));

    await expect(
      generateIdeas(
        { responses: { parse } } as OpenAIClientLike,
        {
          model: "gpt-5.6-luna",
          niche: "Developer education",
          numIdeas: 2,
          signals
        },
        logger
      )
    ).rejects.toThrow("after 1 attempt");
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("fails immediately on a model refusal", async () => {
    const parse = vi.fn().mockResolvedValue({
      output: [
        {
          content: [
            { type: "refusal", refusal: "I cannot complete this request." }
          ]
        }
      ]
    });

    await expect(
      generateIdeas(
        { responses: { parse } } as OpenAIClientLike,
        {
          model: "gpt-5.6-luna",
          niche: "Developer education",
          numIdeas: 2,
          signals
        },
        logger
      )
    ).rejects.toThrow("OpenAI refused the request");
    expect(parse).toHaveBeenCalledTimes(1);
  });
});
