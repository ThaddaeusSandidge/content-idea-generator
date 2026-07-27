import { describe, expect, it, vi } from "vitest";
import { gatherSignals } from "../src/aggregate";

const logger = {
  info: vi.fn(),
  warning: vi.fn()
};

describe("gatherSignals", () => {
  it("keeps successful sources when another source fails", async () => {
    const result = await gatherSignals(
      [
        {
          name: "hackernews",
          load: async () => [
            {
              source: "hackernews",
              title: "Useful story",
              url: "https://example.com/story",
              meta: { points: 10 }
            }
          ]
        },
        {
          name: "reddit",
          load: async () => {
            throw new Error("unavailable");
          }
        }
      ],
      logger
    );

    expect(result).toHaveLength(1);
    expect(logger.warning).toHaveBeenCalledWith(
      "reddit source failed: unavailable"
    );
  });

  it("deduplicates signals by URL", async () => {
    const result = await gatherSignals(
      [
        {
          name: "hackernews",
          load: async () => [
            {
              source: "hackernews",
              title: "First",
              url: "https://example.com/same",
              meta: {}
            },
            {
              source: "hackernews",
              title: "Second",
              url: "https://example.com/same",
              meta: {}
            }
          ]
        }
      ],
      logger
    );

    expect(result.map((item) => item.title)).toEqual(["First"]);
  });

  it("fails when every source fails or returns no data", async () => {
    await expect(
      gatherSignals(
        [
          { name: "hackernews", load: async () => [] },
          {
            name: "reddit",
            load: async () => {
              throw new Error("down");
            }
          }
        ],
        logger
      )
    ).rejects.toThrow("All enabled signal sources failed");
  });
});
