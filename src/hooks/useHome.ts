import { useEffect, useState } from "react";

import type { PlaceSelection } from "@/data/places";
import { isRecord, isLatitude, isLongitude } from "@/data/validation";

const HOME_STORAGE_KEY = "air-around-you.home";

function readHome(): PlaceSelection | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(HOME_STORAGE_KEY) ?? "null");
    if (!isRecord(saved)) return null;
    const { id, name, region, longitude, latitude, countryCode } = saved;
    if (
      typeof id !== "string" ||
      typeof name !== "string" ||
      typeof region !== "string" ||
      !isLongitude(longitude) ||
      !isLatitude(latitude)
    ) {
      return null;
    }
    return {
      id,
      name,
      region,
      longitude,
      latitude,
      ...(typeof countryCode === "string" ? { countryCode } : {}),
    };
  } catch {
    return null;
  }
}

export function useHome() {
  const [home, setHome] = useState<PlaceSelection | null>(null);
  useEffect(() => setHome(readHome()), []);

  function chooseHome(location: PlaceSelection) {
    setHome(location);
    try {
      localStorage.setItem(HOME_STORAGE_KEY, JSON.stringify(location));
    } catch {
      // The in-memory reference remains available for this session.
    }
  }

  return { home, chooseHome };
}
