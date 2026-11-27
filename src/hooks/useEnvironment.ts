import { useEffect, useState } from "react";

import { isCurrentObservation, observationSourceFor } from "@/data/air-observations";
import { fetchEnvironment, type Environment } from "@/data/air-quality";
import { modelCoordinate, type MapPoint } from "@/data/places";

const REFRESH_MS = 5 * 60_000;
const RETRY_MS = 60_000;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_CACHED_LOCATIONS = 30;
const EMPTY: Environment = { air: null, weather: null };
const cache = new Map<string, { value: Environment; expires: number }>();

function mergeReadings(incoming: Environment, previous: Environment): Environment {
  const station = incoming.observation ?? previous.observation;
  return {
    air: incoming.air ?? previous.air,
    weather: incoming.weather ?? previous.weather,
    observation: station && isCurrentObservation(station) ? station : null,
  };
}

function cacheReadings(key: string, incoming: Environment) {
  const value = mergeReadings(incoming, cache.get(key)?.value ?? EMPTY);
  if (cache.size >= MAX_CACHED_LOCATIONS && !cache.has(key)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  const delay = incoming.air && incoming.weather ? REFRESH_MS : RETRY_MS;
  const entry = { value, expires: Date.now() + delay };
  cache.set(key, entry);
  return entry;
}

export function useEnvironment(point: MapPoint | null) {
  // Points on the same model grid share a cache entry. Where monitors exist,
  // keep the precise point locally for choosing the nearest station.
  const location = point && !observationSourceFor(point) ? modelCoordinate(point) : point;
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  const key = location ? `${location.latitude}:${location.longitude}` : null;
  const [result, setResult] = useState<{ key: string; value: Environment } | null>(null);

  useEffect(() => {
    if (key === null || latitude === undefined || longitude === undefined) return;
    const requestedKey = key;
    const requestedPoint = { latitude, longitude };
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function refresh() {
      let entry = cache.get(requestedKey);
      if (!entry || entry.expires <= Date.now()) {
        const signal = AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        ]);
        const incoming = await fetchEnvironment(requestedPoint, signal);
        if (controller.signal.aborted) return;
        entry = cacheReadings(requestedKey, incoming);
      }
      setResult({ key: requestedKey, value: entry.value });
      timer = setTimeout(refresh, Math.max(0, entry.expires - Date.now()));
    }

    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [key, latitude, longitude]);

  return {
    value: result?.key === key ? result.value : EMPTY,
    loading: key !== null && result?.key !== key,
  };
}
