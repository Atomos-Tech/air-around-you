import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { planOptions } from "@/data/daily-plan";
import { generateDailyPlan } from "@/lib/generate-daily-plan";
import DailyPlan from "./DailyPlan";

vi.mock("@/lib/generate-daily-plan", () => ({ generateDailyPlan: vi.fn() }));

it("generates on demand with the chosen preferences and restores the quick plan when they change", async () => {
  const generate = vi
    .mocked(generateDailyPlan)
    .mockImplementationOnce(async (aqi, profile) =>
      planOptions(aqi, profile).map(([first]) => first),
    );
  render(<DailyPlan location="Bengaluru" loading={false} air={null} />);
  expect(generate).not.toHaveBeenCalled();
  const filter = screen.getByRole("switch", { name: "An indoor air cleaner is available" });
  fireEvent.click(filter);
  fireEvent.click(screen.getByRole("button", { name: "Generate AI plan" }));
  expect(await screen.findByRole("list", { name: "AI plan" })).toBeTruthy();
  expect(generate.mock.calls[0]?.[1]).toMatchObject({ hasFilter: true });
  fireEvent.click(filter);
  expect(screen.getByRole("list", { name: "Quick plan" })).toBeTruthy();
});

it("keeps all three quick-plan actions available when on-device generation fails", async () => {
  vi.mocked(generateDailyPlan).mockRejectedValueOnce(new Error("Model unavailable"));
  render(<DailyPlan location="Bengaluru" loading={false} air={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Generate AI plan" }));
  expect(await screen.findByText(/AI generation is unavailable/)).toBeTruthy();
  expect(screen.getByRole("list", { name: "Quick plan" }).children).toHaveLength(3);
});
