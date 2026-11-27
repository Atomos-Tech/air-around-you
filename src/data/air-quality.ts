import { fetchPm25Observation, type Pm25Observation } from "./air-observations";

export type MapPoint = { longitude: number; latitude: number };

export type PlaceSelection = MapPoint & {
  id: string;
  name: string;
  region: string;
  countryCode?: string;
  accuracyMeters?: number;
};

export type AirReading = {
  timestamp: number;
  model: "cams_europe" | "cams_global";
  pm25: number | null;
  pm10: number | null;
  nitrogenDioxide: number | null;
  ozone: number | null;
  carbonMonoxide: number | null;
  sulphurDioxide: number | null;
  usAqi: number | null;
  dust: number | null;
};

export type WeatherReading = {
  timestamp: number;
  windSpeed: number | null;
  windFrom: number | null;
  cloudCover: number | null;
  visibility: number | null;
  code: number | null;
};

export type Environment = {
  air: AirReading | null;
  weather: WeatherReading | null;
  observation?: Pm25Observation | null;
};

type Action = {
  category: string;
  title: string;
  impact: string;
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

function nonnegative(value: unknown, max = Infinity): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max
    ? value
    : null;
}

async function requestCurrent(
  base: string,
  point: MapPoint,
  fields: string,
  signal: AbortSignal,
  options?: Record<string, string>,
) {
  const url = new URL(base);
  url.search = new URLSearchParams({
    latitude: point.latitude.toFixed(1),
    longitude: point.longitude.toFixed(1),
    current: fields,
    timezone: "GMT",
    cell_selection: "nearest",
    ...options,
  }).toString();

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Conditions request failed (${response.status})`);
  const { current } = (await response.json()) as { current?: Record<string, unknown> };
  const time = current?.["time"];
  if (!current || typeof time !== "string") throw new Error("Provider time missing");
  const timestamp = Date.parse(time.endsWith("Z") ? time : `${time}Z`);
  if (!Number.isFinite(timestamp)) throw new Error("Provider time invalid");
  return { current, timestamp };
}

async function fetchAir(point: MapPoint, signal: AbortSignal): Promise<AirReading> {
  async function read(model: AirReading["model"]) {
    const { timestamp, current } = await requestCurrent(
      "https://air-quality-api.open-meteo.com/v1/air-quality",
      point,
      "pm2_5,pm10,nitrogen_dioxide,ozone,carbon_monoxide,sulphur_dioxide,us_aqi,dust",
      signal,
      { domains: model },
    );
    return {
      timestamp,
      model,
      pm25: nonnegative(current["pm2_5"]),
      pm10: nonnegative(current["pm10"]),
      nitrogenDioxide: nonnegative(current["nitrogen_dioxide"]),
      ozone: nonnegative(current["ozone"]),
      carbonMonoxide: nonnegative(current["carbon_monoxide"]),
      sulphurDioxide: nonnegative(current["sulphur_dioxide"]),
      usAqi: nonnegative(current["us_aqi"]),
      dust: nonnegative(current["dust"]),
    };
  }

  const { latitude, longitude } = point;
  // Copernicus publishes a higher-resolution air-quality grid for this domain.
  if (latitude < 30 || latitude > 72 || longitude < -25 || longitude > 45) {
    return read("cams_global");
  }
  const regional = await read("cams_europe").catch((error: unknown) => {
    if (signal.aborted) throw error;
    return null;
  });
  if (regional?.pm25 != null && !isDelayed(regional.timestamp)) return regional;
  return read("cams_global").catch((error: unknown) => {
    if (!signal.aborted && regional) return regional;
    throw error;
  });
}

export async function fetchEnvironment(
  point: MapPoint,
  signal: AbortSignal,
  observationPoint = point,
): Promise<Environment> {
  const [air, weather, observation] = await Promise.allSettled([
    fetchAir(point, signal),
    requestCurrent(
      "https://api.open-meteo.com/v1/forecast",
      point,
      "wind_speed_10m,wind_direction_10m,cloud_cover,visibility,weather_code",
      signal,
      { models: "best_match" },
    ).then(({ timestamp, current }) => ({
      timestamp,
      windSpeed: nonnegative(current["wind_speed_10m"]),
      windFrom: nonnegative(current["wind_direction_10m"], 360),
      cloudCover: nonnegative(current["cloud_cover"], 100),
      visibility: nonnegative(current["visibility"]),
      code: nonnegative(current["weather_code"], 99),
    })),
    fetchPm25Observation(observationPoint, modelCoordinate(point), signal),
  ]);

  return {
    air: air.status === "fulfilled" ? air.value : null,
    weather: weather.status === "fulfilled" ? weather.value : null,
    observation: observation.status === "fulfilled" ? observation.value : null,
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
  const { results = [] } = (await response.json()) as {
    results?: Array<
      MapPoint & {
        id: number;
        name: string;
        country?: string;
        country_code?: string;
        admin1?: string;
      }
    >;
  };
  return results
    .filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
    .map(({ id, name, country, country_code, admin1, latitude, longitude }) => ({
      id: String(id),
      name,
      latitude,
      longitude,
      region: [admin1, country].filter(Boolean).join(", "),
      ...(country_code ? { countryCode: country_code } : {}),
    }));
}

export function isDelayed(timestamp: number, now = Date.now()) {
  return now - timestamp > 2 * 60 * 60 * 1000;
}

export function hasModeledFog(code: number | null | undefined) {
  return code === 45 || code === 48;
}

export function airCategory(aqi: number | null | undefined) {
  if (aqi == null) return { label: "AQI unavailable", severity: "unknown" };
  if (aqi <= 50) return { label: "Good", severity: "good" };
  if (aqi <= 100) return { label: "Moderate", severity: "moderate" };
  if (aqi <= 150) return { label: "Unhealthy for sensitive groups", severity: "sensitive" };
  if (aqi <= 200) return { label: "Unhealthy", severity: "high" };
  if (aqi <= 300) return { label: "Very unhealthy", severity: "very-high" };
  return { label: "Hazardous", severity: "hazardous" };
}

export function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(timestamp);
}

export function compassDirection(degrees: number) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8];
}

export function planFor(aqi: number | null, flexible: boolean): Action[] {
  const outdoorTitle =
    aqi === null
      ? "Check a local advisory before strenuous activity"
      : aqi > 150 || (aqi > 100 && flexible)
        ? "Choose a cleaner indoor space for strenuous activity"
        : "Choose a route away from heavy traffic";
  const outdoorImpact =
    aqi === null
      ? "Local advisories can provide guidance when the model estimate is delayed or unavailable."
      : aqi > 150 || (aqi > 100 && flexible)
        ? "This can reduce exposure when indoor air is cleaner."
        : "A quieter route can reduce time beside a source of outdoor particles.";

  return [
    { category: "Outdoor plans", title: outdoorTitle, impact: outdoorImpact },
    {
      category: "Indoor air",
      title: "Skip burning incense",
      impact: "That removes one source of particles from the air inside your home.",
    },
    {
      category: "Lower-emission travel",
      title: "Combine errands or take transit if practical",
      impact:
        "Replacing separate car trips can reduce the distance driven and the emissions from those trips.",
    },
  ];
}
