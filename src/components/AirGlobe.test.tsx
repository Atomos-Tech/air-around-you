import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAMPLE_LOCATIONS } from "@/data/air-quality";
import AirGlobe from "./AirGlobe";

const { map, constructMap } = vi.hoisted(() => {
  const map = {
    on: vi.fn<(event: string, listener: () => void) => void>(),
    addControl: vi.fn(),
    setProjection: vi.fn(),
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

describe("AirGlobe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the camera in place when breathing is paused", () => {
    const props = {
      place: SAMPLE_LOCATIONS[0] ?? null,
      pendingPoint: null,
      onMapPick: vi.fn(),
      onMapError: vi.fn(),
    };
    const { rerender } = render(
      <main data-breathing-paused={false}>
        <AirGlobe {...props} />
      </main>,
    );
    const listeners = new Map(map.on.mock.calls);
    const styleLoad = listeners.get("style.load");
    const load = listeners.get("load");
    if (!styleLoad || !load) throw new Error("Map load handlers were not registered");
    act(() => {
      styleLoad();
      load();
    });

    rerender(
      <main data-breathing-paused={true}>
        <AirGlobe {...props} />
      </main>,
    );

    expect(constructMap).toHaveBeenCalledTimes(1);
    expect(map.setProjection).toHaveBeenCalledWith({ type: "globe" });
    expect(map.flyTo).toHaveBeenCalledTimes(1);
    expect(props.onMapError).toHaveBeenCalledWith(false);
  });

  it("reports an unavailable map when WebGL initialization fails", () => {
    constructMap.mockImplementationOnce(function () {
      throw new Error("WebGL unavailable");
    });
    const onMapError = vi.fn();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      render(
        <AirGlobe place={null} pendingPoint={null} onMapPick={vi.fn()} onMapError={onMapError} />,
      );
      expect(onMapError).toHaveBeenCalledWith(true);
    } finally {
      warning.mockRestore();
    }
  });
});
