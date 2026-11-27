import type { MapPoint } from "./air-quality";

export const AIR_OBSERVATION_SOURCES = {
  cpcb: {
    name: "CPCB station",
    url: "https://data.gov.in/resource/real-time-air-quality-index-various-locations",
    detail: "Central Pollution Control Board via the Snapdata mirror · station-reported average",
    maxAgeHours: 4,
  },
  airnow: {
    name: "EPA AirNow station",
    url: "https://www.airnow.gov/",
    detail: "U.S. EPA AirNow · preliminary station reading",
    maxAgeHours: 2,
  },
  nea: {
    name: "Singapore NEA",
    url: "https://guide.data.gov.sg/developer-guide/real-time-apis",
    detail: "National Environment Agency · one-hour regional reading",
    maxAgeHours: 2,
  },
} as const;

export type Pm25Observation = {
  source: keyof typeof AIR_OBSERVATION_SOURCES;
  pm25: number;
  timestamp: number;
  area: string;
};

export function isCurrentObservation(reading: Pm25Observation, now = Date.now()) {
  const age = now - reading.timestamp;
  return (
    age >= -15 * 60_000 && age <= AIR_OBSERVATION_SOURCES[reading.source].maxAgeHours * 3_600_000
  );
}

function distanceKm(point: MapPoint, latitude: unknown, longitude: unknown) {
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  )
    return Infinity;
  const radians = Math.PI / 180;
  const halfLatitude = ((latitude - point.latitude) * radians) / 2;
  const halfLongitude = ((longitude - point.longitude) * radians) / 2;
  const sineSquared =
    Math.sin(halfLatitude) ** 2 +
    Math.cos(point.latitude * radians) *
      Math.cos(latitude * radians) *
      Math.sin(halfLongitude) ** 2;
  return 12_742 * Math.asin(Math.sqrt(Math.min(1, sineSquared)));
}

function chooseNearest(
  source: Pm25Observation["source"],
  records: ReadonlyArray<{
    value: unknown;
    timestamp: unknown;
    name: unknown;
    latitude: unknown;
    longitude: unknown;
  }>,
  point: MapPoint,
  range: number,
) {
  let nearest: Pm25Observation | null = null;
  let closest = range;
  const now = Date.now();
  for (const { value, timestamp, name, latitude, longitude } of records) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      typeof timestamp !== "number" ||
      !Number.isFinite(timestamp) ||
      typeof name !== "string" ||
      !name.trim()
    )
      continue;
    const distance = distanceKm(point, latitude, longitude);
    if (distance >= closest) continue;
    const observation = {
      source,
      pm25: value,
      timestamp,
      area: name,
    };
    if (!isCurrentObservation(observation, now)) continue;
    nearest = observation;
    closest = distance;
  }
  return nearest;
}

async function readJson<T>(url: URL | string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Observation feed unavailable");
  return (await response.json()) as T;
}

async function checkIndia(point: MapPoint, signal: AbortSignal) {
  const { records } = await readJson<{ records?: Array<Record<string, unknown>> }>(
    "https://snapdata.dev/api/v1/aqi/in/latest.json",
    signal,
  );
  const candidates = (records ?? [])
    .filter((record) => record["pollutant"] === "PM2.5")
    .map((record) => ({
      value: record["avg"],
      timestamp: typeof record["updated_at"] === "string" ? Date.parse(record["updated_at"]) : NaN,
      name: record["station"],
      latitude: record["latitude"],
      longitude: record["longitude"],
    }));
  return chooseNearest("cpcb", candidates, point, 20);
}

async function checkAirNow(point: MapPoint, requestPoint: MapPoint, signal: AbortSignal) {
  const url = new URL(
    "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Air%20Now%20Current%20Monitor%20Data%20Public/FeatureServer/0/query",
  );
  const { latitude, longitude } = requestPoint;
  const width = 0.25 / Math.cos((latitude * Math.PI) / 180);
  url.search = new URLSearchParams({
    f: "json",
    where: "PM25 >= 0 AND PM25_Measured = 1",
    geometry: [longitude - width, latitude - 0.25, longitude + width, latitude + 0.25]
      .map((edge) => edge.toFixed(3))
      .join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    returnGeometry: "false",
    outFields: "SiteName,Latitude,Longitude,PM25,PM25_Unit,ValidTime",
  }).toString();
  const { features } = await readJson<{
    features?: Array<{ attributes: Record<string, unknown> }>;
  }>(url, signal);
  const candidates = (features ?? []).map(({ attributes }) => ({
    value: attributes["PM25_Unit"] === "UG/M3" ? attributes["PM25"] : null,
    timestamp: attributes["ValidTime"],
    name: attributes["SiteName"],
    latitude: attributes["Latitude"],
    longitude: attributes["Longitude"],
  }));
  return chooseNearest("airnow", candidates, point, 20);
}

async function checkSingapore(
  point: MapPoint,
  signal: AbortSignal,
): Promise<Pm25Observation | null> {
  type NeaPayload = {
    data?: {
      items?: Array<{ timestamp: string; readings: { pm25_one_hourly: Record<string, number> } }>;
      regionMetadata?: Array<{ name: string; labelLocation: MapPoint }>;
    };
  };
  const { data } = await readJson<NeaPayload>(
    "https://api-open.data.gov.sg/v2/real-time/api/pm25",
    signal,
  );
  const item = data?.items?.[0];
  if (!item || !data?.regionMetadata) return null;
  return chooseNearest(
    "nea",
    data.regionMetadata.map(({ name, labelLocation }) => ({
      ...labelLocation,
      name: name ? `Singapore · ${name} region` : "",
      timestamp: Date.parse(item.timestamp),
      value: item.readings?.pm25_one_hourly?.[name],
    })),
    point,
    20,
  );
}

export function observationSourceFor(point: MapPoint) {
  const { latitude, longitude } = point;
  if (latitude >= 1.2 && latitude <= 1.5 && longitude >= 103.6 && longitude <= 104.0) return "nea";
  if (latitude >= 7 && latitude <= 36 && longitude >= 68 && longitude <= 98) return "cpcb";
  if (latitude >= 17 && latitude <= 72 && longitude >= -170 && longitude <= -51) return "airnow";
  return null;
}

export async function fetchPm25Observation(
  point: MapPoint,
  requestPoint: MapPoint,
  signal: AbortSignal,
) {
  const source = observationSourceFor(point);
  if (!source) return null;
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(4_000)]);
  if (source === "nea") return checkSingapore(point, deadline);
  if (source === "cpcb") return checkIndia(point, deadline);
  return checkAirNow(point, requestPoint, deadline);
}
