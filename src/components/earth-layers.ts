import type { Map as MapLibreMap } from "maplibre-gl";

import { installWaterRipples } from "./water-ripples";

export const TERRAIN_SOURCE = "world-elevation";

export function installEarthLayers(map: MapLibreMap) {
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
