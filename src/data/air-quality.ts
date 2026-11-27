import { modelCoordinate, type MapPoint } from "./places";
import { isRecord, nonnegative } from "./validation";
import {
  fetchPm25Observation,
  isCurrentObservation,
  type Pm25Observation,
} from "./air-observations";

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
  const payload: unknown = await response.json();
  const current = isRecord(payload) ? payload["current"] : null;
  if (!isRecord(current)) throw new Error("Provider reading missing");
  const time = current["time"];
  if (typeof time !== "string") throw new Error("Provider time missing");
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

async function fetchWeather(point: MapPoint, signal: AbortSignal): Promise<WeatherReading> {
  const { timestamp, current } = await requestCurrent(
    "https://api.open-meteo.com/v1/forecast",
    point,
    "wind_speed_10m,wind_direction_10m,cloud_cover,visibility,weather_code",
    signal,
    { models: "best_match" },
  );
  return {
    timestamp,
    windSpeed: nonnegative(current["wind_speed_10m"]),
    windFrom: nonnegative(current["wind_direction_10m"], 360),
    cloudCover: nonnegative(current["cloud_cover"], 100),
    visibility: nonnegative(current["visibility"]),
    code: nonnegative(current["weather_code"], 99),
  };
}

export async function fetchEnvironment(
  point: MapPoint,
  signal: AbortSignal,
  observationPoint = point,
): Promise<Environment> {
  const grid = modelCoordinate(point);
  const [air, weather, observation] = await Promise.allSettled([
    fetchAir(grid, signal),
    fetchWeather(grid, signal),
    fetchPm25Observation(observationPoint, grid, signal),
  ]);

  return {
    air: air.status === "fulfilled" ? air.value : null,
    weather: weather.status === "fulfilled" ? weather.value : null,
    observation: observation.status === "fulfilled" ? observation.value : null,
  };
}

export function isDelayed(timestamp: number, now = Date.now()) {
  return now - timestamp > 2 * 60 * 60 * 1000;
}

// Historical estimates may still be displayed with their timestamps. Only current
// readings drive the animated scene and the air plan.
export function currentEnvironment({ air, weather, observation }: Environment, now = Date.now()) {
  return {
    air: air && !isDelayed(air.timestamp, now) ? air : null,
    weather: weather && !isDelayed(weather.timestamp, now) ? weather : null,
    observation: observation && isCurrentObservation(observation, now) ? observation : null,
  };
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
