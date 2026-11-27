import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

import type { Environment, MapPoint, PlaceSelection } from "@/data/air-quality";
import Atmosphere from "./Atmosphere";
import type { mountAvatar } from "./avatar-scene";
import { animateWaterRipples, installWaterRipples } from "./water-ripples";

type Props = {
  place: PlaceSelection | null;
  pendingPoint: MapPoint | null;
  view: "globe" | "street";
  conditions: Environment;
  paused: boolean;
  onMapPick: (point: MapPoint) => void;
  onMapError: (hasError: boolean) => void;
};

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const TERRAIN_SOURCE = "world-elevation";

function installEarthLayers(map: maplibregl.Map) {
  map.setProjection({ type: "globe" });
  map.setLight({ anchor: "map", color: "#fff4e9", intensity: 0.32, position: [1.15, 220, 42] });
  map.setSky({
    "sky-color": "#071421",
    "horizon-color": "#8fb2c8",
    "fog-color": "#c9d7da",
    "sky-horizon-blend": 0.38,
    "horizon-fog-blend": 0.65,
    "fog-ground-blend": 0.4,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 1, 0.85, 12, 0.08],
  });

  const style = map.getStyle();
  const labels = style.layers.filter((layer) => layer.type === "symbol");
  const firstLabel = labels[0]?.id;
  for (const layer of labels) {
    if ((layer.minzoom ?? 0) < 2.65) {
      map.setLayerZoomRange(layer.id, 2.65, Math.max(2.65, layer.maxzoom ?? 24));
    }
  }
  map.addSource("earth-observatory", {
    type: "raster",
    tiles: [
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
    ],
    tileSize: 256,
    maxzoom: 8,
    attribution:
      '<a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/">NASA Blue Marble · historical imagery</a>',
  });
  map.addLayer(
    {
      id: "blue-marble",
      type: "raster",
      source: "earth-observatory",
      maxzoom: 9,
      paint: {
        "raster-opacity": ["interpolate", ["linear"], ["zoom"], 6, 1, 8.5, 0],
        "raster-saturation": 0.05,
      },
    },
    firstLabel,
  );

  map.addSource(TERRAIN_SOURCE, {
    type: "raster-dem",
    tiles: ["https://tiles.mapterhorn.com/{z}/{x}/{y}.webp"],
    tileSize: 512,
    encoding: "terrarium",
    maxzoom: 12,
    attribution: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>',
  });

  if (style.sources["openmaptiles"]) {
    for (const layer of style.layers) {
      if (layer.type === "fill" && layer["source-layer"] === "water") {
        map.setPaintProperty(layer.id, "fill-color", [
          "match",
          ["get", "class"],
          "river",
          "#648c90",
          "swimming_pool",
          "#84afc9",
          "#749baa",
        ]);
      }
    }
    installWaterRipples(map, firstLabel);
    map.addLayer(
      {
        id: "mapped-buildings",
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14.5,
        filter: ["!=", ["get", "hide_3d"], true],
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "render_height"], 0],
            0,
            "#e5d9c7",
            24,
            "#c8b8a0",
            180,
            "#9babb3",
          ],
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 0],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.94,
        },
      },
      firstLabel,
    );
  }
}

export default function AirGlobe({
  place,
  pendingPoint,
  view,
  conditions,
  paused,
  onMapPick,
  onMapError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const avatarRef = useRef<ReturnType<typeof mountAvatar> | null>(null);
  const motionRef = useRef(paused);
  const waterClock = useRef({ seconds: 0 });
  const [mapReady, setMapReady] = useState(false);
  const wind = conditions.weather?.windSpeed ?? null;
  const windFrom = conditions.weather?.windFrom ?? null;

  useEffect(() => {
    motionRef.current = paused;
    avatarRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    maplibregl.setWorkerUrl(mapWorkerUrl);
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: MAP_STYLE,
        center: [16, 20],
        zoom: 1.6,
        minZoom: 0.6,
        maxZoom: 19,
        maxPitch: 78,
        attributionControl: false,
      });
    } catch (error) {
      onMapError(true);
      console.warn("The Earth map could not be opened", error);
      return;
    }

    mapRef.current = map;
    let loaded = false;
    map.addControl(new maplibregl.AttributionControl(), "bottom-right");
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
      "top-right",
    );
    map.on("style.load", () => installEarthLayers(map));
    map.on("load", () => {
      loaded = true;
      setMapReady(true);
      onMapError(false);
    });
    map.on("error", (event) => {
      if (!loaded && !map.isStyleLoaded()) onMapError(true);
      console.warn("A map resource could not be loaded", event.error.message);
    });
    map.on("click", (event) =>
      onMapPick({ longitude: event.lngLat.lng, latitude: event.lngLat.lat }),
    );

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [onMapPick, onMapError]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !place || view !== "street" || paused) return;
    return animateWaterRipples(map, wind, windFrom, waterClock.current);
  }, [mapReady, paused, place, view, wind, windFrom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const width = containerRef.current?.clientWidth ?? 0;
    const compact = width < 700;
    const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    if (view === "globe" || !place) {
      map.setTerrain(null);
      map.flyTo({
        center: place ? [place.longitude, place.latitude] : [16, 20],
        zoom: compact ? 1.05 : 1.95,
        pitch: 0,
        bearing: 0,
        duration: reducedMotion ? 0 : 1800,
        padding: compact
          ? { top: 0, bottom: 190, left: 0, right: 0 }
          : { top: 0, bottom: 0, left: Math.min(355, width * 0.31), right: 0 },
      });
      return;
    }

    map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: 1 });
    map.flyTo({
      center: [place.longitude, place.latitude],
      zoom: 17.1,
      pitch: 68,
      bearing: 24,
      duration: reducedMotion ? 0 : 2550,
      padding: compact
        ? { top: 20, bottom: 173, left: 0, right: 0 }
        : { top: 24, bottom: 0, left: 290, right: 0 },
    });
  }, [place, view, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !place || view !== "street") return;

    const element = document.createElement("div");
    element.className = "person-marker";
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", `3D avatar at ${place.name}`);
    const pin = document.createElement("span");
    pin.className = "person-ground";
    const model = document.createElement("span");
    model.className = "person-mesh";
    element.append(pin, model);
    const marker = new maplibregl.Marker({ element, anchor: "bottom" })
      .setLngLat([place.longitude, place.latitude])
      .addTo(map);

    let disposed = false;
    void import("./avatar-scene")
      .then(({ mountAvatar }) => {
        if (disposed) return;
        avatarRef.current = mountAvatar(model);
        avatarRef.current.setPaused(motionRef.current);
      })
      .catch((error: unknown) => console.warn("The 3D avatar could not be opened", error));
    return () => {
      disposed = true;
      avatarRef.current?.destroy();
      avatarRef.current = null;
      marker.remove();
    };
  }, [mapReady, view, place]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !pendingPoint) return;
    const element = document.createElement("div");
    element.className = "pending-pin-marker";
    element.setAttribute("aria-label", "Selected map point");
    const marker = new maplibregl.Marker({ element, anchor: "bottom" })
      .setLngLat([pendingPoint.longitude, pendingPoint.latitude])
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [mapReady, pendingPoint]);

  const getLocalView = useCallback(() => {
    const map = mapRef.current;
    if (!map || !place || view !== "street" || map.getZoom() < 13) return null;
    const { x, y } = map.project([place.longitude, place.latitude]);
    const { clientWidth, clientHeight } = map.getContainer();
    if (x < 0 || y < 0 || x > clientWidth || y > clientHeight) return null;
    return { x, y, bearing: map.getBearing(), pitch: map.getPitch() };
  }, [view, place]);

  return (
    <>
      <div ref={containerRef} className="earth-map" aria-label="Interactive Earth map" />
      {view === "street" && place && (
        <Atmosphere conditions={conditions} paused={paused} getLocalView={getLocalView} />
      )}
    </>
  );
}
