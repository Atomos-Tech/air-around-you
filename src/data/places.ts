import { isLatitude, isLongitude, isRecord } from "./validation";

export type MapPoint = { longitude: number; latitude: number };

export type PlaceSelection = MapPoint & {
  id: string;
  name: string;
  region: string;
  countryCode?: string;
  accuracyMeters?: number;
};

export function makePlace(point: MapPoint, accuracyMeters?: number): PlaceSelection {
  const { latitude } = point;
  const longitude = wrapLongitude(point.longitude);
  return {
    latitude,
    longitude,
    id: `${latitude.toFixed(5)}:${longitude.toFixed(5)}`,
    name: accuracyMeters === undefined ? "Dropped pin" : "Your location",
    region: `${Math.abs(latitude).toFixed(2)}°${latitude < 0 ? "S" : "N"} · ${Math.abs(longitude).toFixed(2)}°${longitude < 0 ? "W" : "E"}`,
    ...(accuracyMeters === undefined ? {} : { accuracyMeters }),
  };
}

function wrapLongitude(longitude: number) {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

export function modelCoordinate(point: MapPoint): MapPoint {
  // The precise geolocation stays on the device. Use a coarse request point for both feeds.
  return {
    latitude: Math.round(point.latitude * 10) / 10,
    longitude: wrapLongitude(Math.round(point.longitude * 10) / 10),
  };
}

function geocodedPlace(record: unknown): PlaceSelection | null {
  if (!isRecord(record)) return null;
  const { id, name, latitude, longitude, admin1, country, country_code } = record;
  if (
    typeof id !== "number" ||
    !Number.isSafeInteger(id) ||
    typeof name !== "string" ||
    !name.trim()
  )
    return null;
  if (!isLatitude(latitude) || !isLongitude(longitude)) return null;
  return {
    id: String(id),
    name,
    latitude,
    longitude,
    region: [admin1, country]
      .filter((value) => typeof value === "string" && value.length > 0)
      .join(", "),
    ...(typeof country_code === "string" && country_code ? { countryCode: country_code } : {}),
  };
}

export async function searchPlaces(query: string, signal: AbortSignal): Promise<PlaceSelection[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({
    name: query,
    count: "16",
    language: "en",
    format: "json",
  }).toString();
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Place search is unavailable");
  const payload: unknown = await response.json();
  if (!isRecord(payload)) throw new Error("Invalid place search response");
  const results = payload["results"] ?? [];
  if (!Array.isArray(results)) throw new Error("Invalid place search results");
  return results.map(geocodedPlace).filter((place) => place !== null);
}
