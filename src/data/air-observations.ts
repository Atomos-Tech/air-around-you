import type { MapPoint } from "./places";
import { isLatitude, isLongitude, isRecord, nonnegative } from "./validation";

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
  if (!isLatitude(latitude) || !isLongitude(longitude)) return Infinity;
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

type StationRecord = {
  value: unknown;
  timestamp: unknown;
  name: unknown;
  latitude: unknown;
  longitude: unknown;
};

// Normalize only the rows we visit. A malformed station should never discard
// the other stations in a regional feed.
function chooseNearest(
  source: Pm25Observation["source"],
  point: MapPoint,
  rows: unknown,
  normalize: (row: Record<string, unknown>) => StationRecord | null,
) {
  if (!Array.isArray(rows)) return null;
  let nearest: Pm25Observation | null = null;
  let closestKm = 20;
  const now = Date.now();
  for (const row of rows) {
    const station = isRecord(row) ? normalize(row) : null;
    if (!station) continue;
    const pm25 = nonnegative(station.value);
    if (
      pm25 === null ||
      typeof station.name !== "string" ||
      !station.name.trim() ||
      typeof station.timestamp !== "number"
    )
      continue;
    const observation = { source, pm25, timestamp: station.timestamp, area: station.name };
    if (!isCurrentObservation(observation, now)) continue;
    const distance = distanceKm(point, station.latitude, station.longitude);
    if (distance < closestKm) {
      nearest = observation;
      closestKm = distance;
    }
  }
  return nearest;
}

async function readFeed(url: URL | string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Observation feed unavailable");
  const payload: unknown = await response.json();
  if (!isRecord(payload)) throw new Error("Invalid observation feed");
  return payload;
}

async function checkIndia(point: MapPoint, signal: AbortSignal) {
  const feed = await readFeed("https://snapdata.dev/api/v1/aqi/in/latest.json", signal);
  return chooseNearest("cpcb", point, feed["records"], (row) => {
    if (row["pollutant"] !== "PM2.5" || typeof row["updated_at"] !== "string") return null;
    return {
      value: row["avg"],
      timestamp: Date.parse(row["updated_at"]),
      name: row["station"],
      latitude: row["latitude"],
      longitude: row["longitude"],
    };
  });
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
  const feed = await readFeed(url, signal);
  return chooseNearest("airnow", point, feed["features"], ({ attributes }) => {
    if (!isRecord(attributes) || attributes["PM25_Unit"] !== "UG/M3") return null;
    return {
      value: attributes["PM25"],
      timestamp: attributes["ValidTime"],
      name: attributes["SiteName"],
      latitude: attributes["Latitude"],
      longitude: attributes["Longitude"],
    };
  });
}

async function checkSingapore(point: MapPoint, signal: AbortSignal) {
  const { data } = await readFeed("https://api-open.data.gov.sg/v2/real-time/api/pm25", signal);
  if (!isRecord(data) || !Array.isArray(data["items"])) return null;
  const item: unknown = data["items"][0];
  if (!isRecord(item) || typeof item["timestamp"] !== "string" || !isRecord(item["readings"]))
    return null;
  const values = item["readings"]["pm25_one_hourly"];
  if (!isRecord(values)) return null;
  const timestamp = Date.parse(item["timestamp"]);
  return chooseNearest("nea", point, data["regionMetadata"], ({ name, labelLocation }) => {
    if (typeof name !== "string" || !name || !isRecord(labelLocation)) return null;
    return {
      latitude: labelLocation["latitude"],
      longitude: labelLocation["longitude"],
      name: `Singapore · ${name} region`,
      value: values[name],
      timestamp,
    };
  });
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
