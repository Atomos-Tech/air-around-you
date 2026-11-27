import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import * as provider from "@/data/air-quality";
import { useEnvironment } from "./useEnvironment";

const empty: provider.Environment = { air: null, weather: null };
const weather: provider.WeatherReading = {
  timestamp: 0,
  windSpeed: 0,
  windFrom: null,
  cloudCover: 0,
  visibility: null,
  code: null,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("cancels a previous city and ignores late results even if the provider resolves after cancellation", async () => {
  let firstResponse!: (readings: provider.Environment) => void;
  const request = vi
    .spyOn(provider, "fetchEnvironment")
    .mockReturnValueOnce(
      new Promise((resolve) => {
        firstResponse = resolve;
      }),
    )
    .mockResolvedValue({ ...empty, weather });
  const { result, rerender, unmount } = renderHook(useEnvironment, {
    initialProps: { latitude: -32, longitude: 116 },
  });
  const oldSignal = request.mock.calls[0]?.[1];
  rerender({ latitude: -33, longitude: 115 });
  await act(async () => firstResponse(empty));
  expect(oldSignal?.aborted).toBe(true);
  expect(result.current.value.weather).toEqual(weather);
  unmount();
  expect(request.mock.calls[1]?.[1].aborted).toBe(true);
});

it("shares a model grid between nearby points, retries a partial reading, and stops on unmount", async () => {
  vi.useFakeTimers();
  const at = Date.now();
  const air: provider.AirReading = {
    model: "cams_global",
    timestamp: at,
    usAqi: 44,
    pm25: 8,
    pm10: null,
    nitrogenDioxide: null,
    ozone: null,
    carbonMonoxide: null,
    sulphurDioxide: null,
    dust: null,
  };
  const request = vi
    .spyOn(provider, "fetchEnvironment")
    .mockResolvedValueOnce({ air, weather: null })
    .mockResolvedValue({ ...empty, weather });
  const { result, rerender, unmount } = renderHook(useEnvironment, {
    initialProps: { latitude: 35.661, longitude: 139.723 },
  });
  await act(async () => {});
  expect(result.current.value.air).toEqual(air);
  rerender({ latitude: 35.669, longitude: 139.722 });
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(60_000));
  expect(request).toHaveBeenCalledTimes(2);
  expect(result.current.value).toMatchObject({ air, weather });
  unmount();
  await vi.advanceTimersByTimeAsync(5 * 60_000);
  expect(request).toHaveBeenCalledTimes(2);
});
