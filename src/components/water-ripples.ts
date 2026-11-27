import type { Map as MapLibreMap } from "maplibre-gl";

const WATER_LAYER = "surface-ripples";
const CHANNEL_IMAGE = "channel-ripples";
const OPEN_WATER_IMAGE = "open-water-ripples";
const SIZE = 64;
const WATER_MIN_ZOOM = 14.5;
const SCALE = (2 * Math.PI) / SIZE;

type Vector = { x: number; y: number };

function texture() {
  return { width: SIZE, height: SIZE, data: new Uint8Array(SIZE * SIZE * 4) };
}

function drawSurface(
  image: ReturnType<typeof texture>,
  drift: Vector,
  time: number,
  wind: number,
  channel: boolean,
) {
  const [red, green, blue] = channel ? ([91, 133, 137] as const) : ([102, 146, 163] as const);
  const swellStrength = 6 + wind * 0.15;
  const glintStrength = 11 + wind * 0.44;
  for (let y = 0; y < SIZE; y += 1) {
    const v = (y - drift.y * time) * SCALE;
    for (let x = 0; x < SIZE; x += 1) {
      const offset = (x + y * SIZE) * 4;
      const u = (x - drift.x * time) * SCALE;
      const swell = Math.sin(2 * u - v + Math.sin(u + 2 * v) * 0.7);
      const ripple = Math.sin(4 * u + 7 * v + 1.7 * swell + time * 0.57);
      const crossRipple = Math.sin(7 * u - 5 * v + 1.2 * swell - time * 0.42);
      const reflection = 0.53 * swell + 0.3 * ripple + 0.17 * crossRipple;
      const glint = Math.max(0, 0.63 * ripple + 0.37 * crossRipple - 0.33);
      const light = reflection * swellStrength + glint * glintStrength;
      image.data[offset] = red + 0.83 * light;
      image.data[offset + 1] = green + light;
      image.data[offset + 2] = blue + 1.09 * light;
      image.data[offset + 3] = 255;
    }
  }
}

export function installWaterRipples(map: MapLibreMap, below?: string) {
  for (const [id, channel] of [
    [CHANNEL_IMAGE, true],
    [OPEN_WATER_IMAGE, false],
  ] as const) {
    const image = texture();
    drawSurface(image, { x: 0, y: 0 }, 0, 0, channel);
    map.addImage(id, image);
  }
  // Extrusions render above terrain textures, so water can move while the camera is still.
  map.addLayer(
    {
      id: WATER_LAYER,
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "water",
      minzoom: WATER_MIN_ZOOM,
      filter: ["!=", ["get", "class"], "swimming_pool"],
      paint: {
        "fill-extrusion-height": 0.12,
        "fill-extrusion-pattern": [
          "match",
          ["get", "class"],
          "river",
          CHANNEL_IMAGE,
          OPEN_WATER_IMAGE,
        ],
      },
    },
    below,
  );
}

function closestChannel(map: MapLibreMap): Vector | null {
  const { lng, lat } = map.getCenter();
  const longitudeScale = Math.cos((lat * Math.PI) / 180);
  const features = map.querySourceFeatures("openmaptiles", {
    sourceLayer: "waterway",
    filter: [
      "all",
      ["match", ["get", "class"], ["river", "canal", "stream"], true, false],
      ["!=", ["get", "brunnel"], "tunnel"],
    ],
  });
  let closest = 0.004 ** 2;
  let bearing: Vector | null = null;

  for (const { geometry } of features) {
    const lines =
      geometry.type === "LineString"
        ? [geometry.coordinates]
        : geometry.type === "MultiLineString"
          ? geometry.coordinates
          : [];
    for (const line of lines) {
      for (let index = 1; index < line.length; index += 1) {
        const [startLongitude, startLatitude] = line[index - 1];
        const [endLongitude, endLatitude] = line[index];
        const x = (((startLongitude - lng + 540) % 360) - 180) * longitudeScale;
        const y = lat - startLatitude;
        const dx = (((endLongitude - startLongitude + 540) % 360) - 180) * longitudeScale;
        const dy = startLatitude - endLatitude;
        const lengthSquared = dx * dx + dy * dy;
        if (lengthSquared === 0) continue;
        const distanceAlong = Math.max(0, Math.min(1, -(x * dx + y * dy) / lengthSquared));
        const distance = (x + dx * distanceAlong) ** 2 + (y + dy * distanceAlong) ** 2;
        if (distance >= closest) continue;
        closest = distance;
        const length = Math.sqrt(lengthSquared);
        bearing = { x: dx / length, y: dy / length };
      }
    }
  }

  return bearing;
}

export function animateWaterRipples(
  map: MapLibreMap,
  windSpeed: number | null,
  windFrom: number | null,
  clock: { seconds: number },
) {
  if (!map.getLayer(WATER_LAYER)) return;
  const speed = windFrom === null ? 0 : Math.min(windSpeed ?? 0, 28);
  const heading = (((windFrom ?? 0) + 180) * Math.PI) / 180;
  const wind = { x: Math.sin(heading) * speed * 0.34, y: -Math.cos(heading) * speed * 0.34 };
  const openWater = texture();
  const channel = texture();
  let timer: ReturnType<typeof setInterval> | undefined;

  function startIfVisible() {
    if (timer !== undefined || map.isMoving() || map.getZoom() < WATER_MIN_ZOOM) return;
    const surfaces = map.queryRenderedFeatures({ layers: [WATER_LAYER] });
    const hasChannel = surfaces.some(({ properties }) => properties["class"] === "river");
    const open = speed > 0 && surfaces.some(({ properties }) => properties["class"] !== "river");
    const course = hasChannel ? closestChannel(map) : null;
    if (!open && !course && (!hasChannel || speed === 0)) return;

    const drift = {
      x: (course?.x ?? 0) * 4 + wind.x * 0.4,
      y: (course?.y ?? 0) * 4 + wind.y * 0.4,
    };
    let lastTime = performance.now();
    timer = setInterval(() => {
      const now = performance.now();
      clock.seconds += Math.min(0.15, (now - lastTime) / 1_000);
      lastTime = now;
      if (open) {
        drawSurface(openWater, wind, clock.seconds, speed, false);
        map.updateImage(OPEN_WATER_IMAGE, openWater);
      }
      if (hasChannel) {
        drawSurface(channel, drift, clock.seconds, speed * 0.65, true);
        map.updateImage(CHANNEL_IMAGE, channel);
      }
      map.triggerRepaint();
    }, 83);
  }

  function stop() {
    clearInterval(timer);
    timer = undefined;
  }

  map.on("idle", startIfVisible);
  map.on("movestart", stop);
  map.on("moveend", startIfVisible);
  startIfVisible();

  return () => {
    stop();
    map.off("idle", startIfVisible);
    map.off("movestart", stop);
    map.off("moveend", startIfVisible);
  };
}
