import { expect, it } from "vitest";

import { planOptions, resolvePlan, type PlanProfile } from "./daily-plan";

const profile = {
  audience: "School",
  travel: "Walk or cycle",
  flexible: true,
  hasFilter: false,
} satisfies PlanProfile;

it("prioritizes moving school activity indoors during severe pollution and respects available equipment", () => {
  const [outdoor, indoor, travel] = planOptions(216, profile);
  expect(outdoor[0].title).toMatch(/practices and games indoors/);
  expect(indoor.map(({ title }) => title)).not.toContain(
    "Run your particle air cleaner in the room people use most",
  );
  expect(travel.map(({ title }) => title).join(" ")).not.toMatch(/walk or cycle/i);
  expect(planOptions(null, profile)[0][0].title).toMatch(/local advisory/);
});

it("accepts only one reviewed action for each section", () => {
  const options = planOptions(null, profile);
  expect(resolvePlan(options, [0, 1, 0])).toHaveLength(3);
  expect(resolvePlan(options, [1, 0, 0])).toBeNull();
  expect(resolvePlan(options, [0, "0", 0])).toBeNull();
  expect(resolvePlan(options, [0, 0])).toBeNull();
});
