import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { AirReading, Environment } from "@/data/air-quality";
import { WORLD_CITIES } from "@/data/cities";
import { useEnvironment } from "@/hooks/useEnvironment";
import { Route } from "@/routes/index";

vi.mock("@/components/AirGlobe", () => ({ default: () => null }));
vi.mock("@/hooks/useEnvironment", () => ({ useEnvironment: vi.fn() }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function openApp() {
  const Home = Route.options.component;
  if (!Home) throw new Error("The home route has no component");
  return render(<Home />);
}

function stationConditions(timestamp: number, air: Partial<AirReading> = {}): Environment {
  return {
    air: {
      model: "cams_global",
      timestamp,
      usAqi: 216,
      pm25: 82.9,
      pm10: null,
      nitrogenDioxide: null,
      ozone: null,
      carbonMonoxide: null,
      sulphurDioxide: null,
      dust: null,
      ...air,
    },
    weather: null,
    observation: { source: "cpcb", pm25: 170, timestamp, area: "Talkatora Garden" },
  };
}

it("shows modeled US AQI on the card alongside a measured PM₂.₅ reading", () => {
  vi.mocked(useEnvironment).mockReturnValue({
    value: stationConditions(Date.now()),
    loading: false,
  });
  openApp();
  fireEvent.click(screen.getByRole("button", { name: "New Delhi" }));

  const card = within(
    screen.getByRole("complementary", { name: "Air around the selected location" }),
  );
  expect(card.getByText("216 modeled US AQI")).toBeTruthy();
  expect(card.getByText("170")).toBeTruthy();
  expect(card.getByText("CAMS global")).toBeTruthy();
  expect(card.getByText("CPCB station")).toBeTruthy();
});

it("sets Home only on explicit selection and restores the reference after reopening", () => {
  vi.mocked(useEnvironment).mockReturnValue({
    value: { air: null, weather: null },
    loading: false,
  });
  const firstVisit = openApp();
  fireEvent.click(screen.getByRole("button", { name: "New Delhi" }));
  expect(screen.getByText("Visiting", { exact: true })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Compare with Home" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: /^Explore$/ }));
  fireEvent.click(screen.getByRole("button", { name: "Tokyo Japan" }));
  fireEvent.click(screen.getByRole("button", { name: "Set as home" }));
  expect(screen.getByText("Home", { exact: true })).toBeTruthy();
  firstVisit.unmount();

  openApp();
  fireEvent.click(screen.getByRole("button", { name: "Return home" }));
  expect(screen.getByRole("heading", { name: "Tokyo" })).toBeTruthy();
  expect(screen.getByText("Home", { exact: true })).toBeTruthy();
});

it("labels delayed model data and excludes expired readings from today's plan", async () => {
  const fiveHoursAgo = Date.now() - 5 * 60 * 60_000;
  vi.mocked(useEnvironment).mockReturnValue({
    value: stationConditions(fiveHoursAgo),
    loading: false,
  });
  openApp();
  fireEvent.click(screen.getByRole("button", { name: "New Delhi" }));
  expect(screen.getByText("Estimate delayed")).toBeTruthy();
  expect(screen.getByText("82.9")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Air data details" }));
  const details = within(screen.getByRole("dialog", { name: "Air around New Delhi" }));
  expect(details.getByText("Area model estimates")).toBeTruthy();
  expect(details.queryByRole("region", { name: "Measured PM₂.₅" })).toBeNull();
  fireEvent.click(details.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Today’s plan" }));
  const plan = within(screen.getByRole("dialog", { name: "Today’s air plan" }));
  expect(await plan.findByText("Current modeled AQI unavailable")).toBeTruthy();
  expect(
    plan.getByRole("heading", { name: "Check the local advisory before outdoor activity" }),
  ).toBeTruthy();
});

it("compares modeled PM₂.₅ for the saved Home and the city being visited", () => {
  const home = WORLD_CITIES.find((city) => city.name === "Tokyo");
  if (!home) throw new Error("Missing featured city Tokyo");
  localStorage.setItem("air-around-you.home", JSON.stringify(home));
  const now = Date.now();
  const visiting = stationConditions(now);
  const homeReadings = stationConditions(now, { pm25: 12.5 });
  const read = vi.mocked(useEnvironment).mockImplementation((point) => ({
    value: point?.latitude === home.latitude ? homeReadings : visiting,
    loading: false,
  }));
  read.mockClear();
  openApp();
  fireEvent.click(screen.getByRole("button", { name: "New Delhi" }));
  expect(read).not.toHaveBeenCalledWith(home);
  fireEvent.click(screen.getByRole("button", { name: "Compare with Home" }));
  const comparison = within(screen.getByRole("dialog", { name: "Compare with home" }));
  expect(comparison.getByRole("heading", { name: "Tokyo" })).toBeTruthy();
  expect(comparison.getByRole("heading", { name: "New Delhi" })).toBeTruthy();
  expect(comparison.getByText("12.5")).toBeTruthy();
  expect(comparison.getByText("82.9")).toBeTruthy();
  expect(comparison.queryByText("170")).toBeNull();
  expect(comparison.getByText(/Same estimate time/)).toBeTruthy();
});
