import { useEffect, useState } from "react";

import { isCurrentObservation, observationSourceFor } from "@/data/air-observations";

import {
  fetchEnvironment,
  modelCoordinate,
  type Environment,
  type MapPoint,
} from "@/data/air-quality";

const REFRESH_MS = 5 * 60 * 1000;
const EMPTY: Environment = { air: null, weather: null };
const cache = new Map<string, { value: Environment; expires: number }>();

export function useEnvironment(point: MapPoint | null) {
  const coordinates = point ? modelCoordinate(point) : null;
  const latitude = coordinates?.latitude;
  const longitude = coordinates?.longitude;
  // Select the nearest monitor in the browser. Providers only receive the coarse request point.
  const local = point && observationSourceFor(point) ? point : null;
  const localLatitude = local?.latitude;
  const localLongitude = local?.longitude;
  const key =
    latitude === undefined || longitude === undefined
      ? null
      : `${latitude}:${longitude}${local ? `:${local.latitude}:${local.longitude}` : ""}`;
  const [result, setResult] = useState<{ key: string; value: Environment } | null>(null);

  useEffect(() => {
    if (key === null || latitude === undefined || longitude === undefined) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function refresh() {
      if (
        controller.signal.aborted ||
        key === null ||
        latitude === undefined ||
        longitude === undefined
      )
        return;
      const existing = cache.get(key);
      if (existing && existing.expires > Date.now()) {
        setResult({ key, value: existing.value });
        timer = setTimeout(refresh, existing.expires - Date.now());
        return;
      }

      const timeout = AbortSignal.timeout(12_000);
      const value = await fetchEnvironment(
        { latitude, longitude },
        AbortSignal.any([timeout, controller.signal]),
        localLatitude === undefined || localLongitude === undefined
          ? undefined
          : { latitude: localLatitude, longitude: localLongitude },
      );
      if (controller.signal.aborted) return;

      const previous = cache.get(key)?.value;
      const combined: Environment = {
        air: value.air ?? previous?.air ?? null,
        weather: value.weather ?? previous?.weather ?? null,
        observation:
          value.observation ??
          (previous?.observation && isCurrentObservation(previous.observation)
            ? previous.observation
            : null),
      };
      setResult({ key, value: combined });
      if (cache.size >= 30 && !cache.has(key)) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      const delay = value.air && value.weather ? REFRESH_MS : 60_000;
      cache.set(key, { value: combined, expires: Date.now() + delay });
      timer = setTimeout(refresh, delay);
    }

    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [key, latitude, longitude, localLatitude, localLongitude]);

  return {
    value: result?.key === key ? result.value : EMPTY,
    loading: key !== null && result?.key !== key,
  };
}
