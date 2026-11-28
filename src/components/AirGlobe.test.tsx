import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WORLD_CITIES } from "@/data/cities";
import AirGlobe from "./AirGlobe";

const { map, constructMap } = vi.hoisted(() => {
  const map = {
    on: vi.fn<(event: string, listener: () => void) => void>(),
    addControl: vi.fn(),
    setProjection: vi.fn(),
    setLight: vi.fn(),
    setSky: vi.fn(),
    setTerrain: vi.fn(),
    getStyle: vi.fn(() => ({ sources: { openmaptiles: {} }, layers: [] })),
    getLayer: vi.fn(),
    addImage: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    flyTo: vi.fn(),
    remove: vi.fn(),
  };

  return {
    map,
    constructMap: vi.fn(function () {
      return map;
    }),
  };
});

vi.mock("maplibre-gl", () => ({
  Map: constructMap,
  AttributionControl: class {},
  NavigationControl: class {},
  Marker: class {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  },
  setWorkerUrl: vi.fn(),
}));

vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/map-worker.js",
}));

vi.mock("./avatar-scene", () => ({
  mountAvatar: () => ({ setPaused: vi.fn(), destroy: vi.fn() }),
}));

const emptyConditions = { air: null, weather: null };

describe("AirGlobe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the camera in place when breathing is paused", () => {
    const props = {
      place: WORLD_CITIES[0] ?? null,
      pendingPoint: null,
      onMapPick: vi.fn(),
      onMapError: vi.fn(),
    };
    const { rerender } = render(
      <AirGlobe {...props} view="street" conditions={emptyConditions} paused={false} />,
    );
    const listeners = new Map(map.on.mock.calls);
    const styleLoad = listeners.get("style.load");
    const load = listeners.get("load");
    if (!styleLoad || !load) throw new Error("Map load handlers were not registered");
    act(() => {
      styleLoad();
      load();
    });

    rerender(<AirGlobe {...props} view="street" conditions={emptyConditions} paused />);

    expect(constructMap).toHaveBeenCalledTimes(1);
    expect(map.setProjection).toHaveBeenCalledWith({ type: "globe" });
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "blue-marble" }),
      undefined,
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "mapped-buildings" }),
      undefined,
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "surface-ripples", "source-layer": "water" }),
      undefined,
    );
    expect(map.flyTo).toHaveBeenCalledTimes(1);
    expect(props.onMapError).toHaveBeenCalledWith(false);
  });

  it("updates daylight while the globe is open and stops the timer on unmount", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-20T12:00:00Z"));
      const { unmount } = render(
        <AirGlobe
          place={null}
          pendingPoint={null}
          view="globe"
          conditions={emptyConditions}
          paused
          onMapPick={vi.fn()}
          onMapError={vi.fn()}
        />,
      );
      const listeners = new Map(map.on.mock.calls);
      act(() => {
        listeners.get("style.load")?.();
        listeners.get("load")?.();
      });
      act(() => vi.advanceTimersByTime(60_000));
      expect(map.setLight).toHaveBeenCalledTimes(2);
      expect(map.setLight.mock.calls[1]?.[0].position).not.toEqual(
        map.setLight.mock.calls[0]?.[0].position,
      );
      expect(map.flyTo).toHaveBeenCalledTimes(1);
      unmount();
      act(() => vi.advanceTimersByTime(60_000));
      expect(map.setLight).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports an unavailable map when WebGL initialization fails", () => {
    constructMap.mockImplementationOnce(function () {
      throw new Error("WebGL unavailable");
    });
    const onMapError = vi.fn();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      render(
        <AirGlobe
          place={null}
          pendingPoint={null}
          view="globe"
          conditions={emptyConditions}
          paused={false}
          onMapPick={vi.fn()}
          onMapError={onMapError}
        />,
      );
      expect(onMapError).toHaveBeenCalledWith(true);
    } finally {
      warning.mockRestore();
    }
  });
});
