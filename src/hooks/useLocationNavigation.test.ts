import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useLocationNavigation } from "./useLocationNavigation";

function mockLocation() {
  const request = vi.fn<Geolocation["getCurrentPosition"]>();
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: request } });
  return request;
}
const fix = {
  coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 48 },
} as GeolocationPosition;
afterEach(() => vi.unstubAllGlobals());

it("visits the standard-accuracy fix when a precise fix times out", async () => {
  const request = mockLocation()
    .mockImplementationOnce((_, fail) => fail?.({ code: 3 } as GeolocationPositionError))
    .mockImplementationOnce((success) => success(fix));
  const { result } = renderHook(useLocationNavigation);
  await act(() => result.current.findMe());
  expect(request.mock.calls.map((call) => call[2]?.enableHighAccuracy)).toEqual([true, false]);
  expect(result.current.place).toMatchObject({
    name: "Your location",
    latitude: 12.9716,
    accuracyMeters: 48,
  });
  expect(result.current.locating).toBe(false);
});

it("explains denial and leaves the user free to retry", async () => {
  const request = mockLocation().mockImplementation((_, fail) =>
    fail?.({ code: 1 } as GeolocationPositionError),
  );
  const { result } = renderHook(useLocationNavigation);
  await act(() => result.current.findMe());
  expect(request).toHaveBeenCalledTimes(1);
  expect(result.current.geoMessage).toMatch(/Location access is blocked/);
  expect(result.current.locating).toBe(false);
});

it("keeps a selected pin if a device fix arrives later", async () => {
  const request = mockLocation();
  const { result } = renderHook(useLocationNavigation);
  let done: Promise<void>;
  act(() => {
    done = result.current.findMe();
  });
  const pin = { latitude: 0, longitude: 0 };
  act(() => result.current.pickPoint(pin));
  await act(async () => {
    request.mock.calls[0]?.[0](fix);
    await done;
  });
  expect(result.current.pin).toEqual(pin);
  expect(result.current.place).toBeNull();
});
