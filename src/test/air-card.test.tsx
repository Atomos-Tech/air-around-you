import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { Environment } from "@/data/air-quality";
import { useEnvironment } from "@/hooks/useEnvironment";
import { Route } from "@/routes/index";

vi.mock("@/components/AirGlobe", () => ({ default: () => null }));
vi.mock("@/hooks/useEnvironment", () => ({ useEnvironment: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

it("shows modeled US AQI on the card alongside a measured PM₂.₅ reading", () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const timestamp = Date.now();
  const value: Environment = {
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
    },
    weather: null,
    observation: { source: "cpcb", pm25: 170, timestamp, area: "Talkatora Garden" },
  };
  vi.mocked(useEnvironment).mockReturnValue({ value, loading: false });

  const Home = Route.options.component;
  if (!Home) throw new Error("The home route has no component");
  render(<Home />);
  fireEvent.click(screen.getByRole("button", { name: "New Delhi" }));

  const card = within(
    screen.getByRole("complementary", { name: "Air around the selected location" }),
  );
  expect(card.getByText("216 modeled US AQI")).toBeTruthy();
  expect(card.getByText("170")).toBeTruthy();
  expect(card.getByText("CAMS global")).toBeTruthy();
  expect(card.getByText("CPCB station")).toBeTruthy();
});
