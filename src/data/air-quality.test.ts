import { describe, expect, it } from "vitest";

import {
  getSamplePlan,
  SAMPLE_AVERAGING_WINDOW,
  SAMPLE_LOCATIONS,
  SAMPLE_TIMESTAMP_UTC,
} from "@/data/air-quality";

describe("air quality sample fixtures", () => {
  it("provides three sample locations across multiple regions", () => {
    expect(SAMPLE_LOCATIONS).toHaveLength(3);
    expect(new Set(SAMPLE_LOCATIONS.map((place) => place.region.split(" · ")[1])).size).toBe(3);
  });

  it("keeps sample comparisons on the same timestamp and averaging window", () => {
    expect(SAMPLE_LOCATIONS.every((place) => place.timestampUtc === SAMPLE_TIMESTAMP_UTC)).toBe(
      true,
    );
    expect(
      SAMPLE_LOCATIONS.every((place) => place.averagingWindow === SAMPLE_AVERAGING_WINDOW),
    ).toBe(true);
  });

  it("changes outdoor guidance when timing is flexible", () => {
    const flexibleAction = getSamplePlan(38, true)[0];
    const fixedAction = getSamplePlan(38, false)[0];

    expect(flexibleAction?.title).not.toBe(fixedAction?.title);
  });
});
