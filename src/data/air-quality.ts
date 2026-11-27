export type LocationSource = "sample" | "device" | "pin";

export type MapPoint = {
  longitude: number;
  latitude: number;
};

export type PlaceSelection = MapPoint & {
  id: string;
  name: string;
  region: string;
  pm25: number | null;
  windDirectionDeg: number | null;
  windSpeedKmh: number | null;
  hazeLabel: string | null;
  dustLevel: "present" | "none" | null;
  timestampUtc: string | null;
  averagingWindow: string | null;
  source: LocationSource;
  accuracyMeters: number | null;
};

export type SampleAction = {
  category: "Outdoor time" | "Indoor air" | "Lower-emission commute";
  title: string;
  impact: string;
};

export const SAMPLE_TIMESTAMP_UTC = "2026-11-27T08:00:00Z";
export const SAMPLE_TIMESTAMP_LABEL = "27 Nov 2026 · 08:00 UTC";
export const SAMPLE_AVERAGING_WINDOW = "24-hour average";

export const SAMPLE_LOCATIONS: PlaceSelection[] = [
  {
    id: "new-delhi",
    name: "New Delhi",
    region: "India · South Asia",
    longitude: 77.209,
    latitude: 28.6139,
    pm25: 38,
    windDirectionDeg: 315,
    windSpeedKmh: 8,
    hazeLabel: "Elevated",
    dustLevel: "present",
    timestampUtc: SAMPLE_TIMESTAMP_UTC,
    averagingWindow: SAMPLE_AVERAGING_WINDOW,
    source: "sample",
    accuracyMeters: null,
  },
  {
    id: "nairobi",
    name: "Nairobi",
    region: "Kenya · East Africa",
    longitude: 36.8219,
    latitude: -1.2921,
    pm25: 12,
    windDirectionDeg: 80,
    windSpeedKmh: 14,
    hazeLabel: "Light",
    dustLevel: "none",
    timestampUtc: SAMPLE_TIMESTAMP_UTC,
    averagingWindow: SAMPLE_AVERAGING_WINDOW,
    source: "sample",
    accuracyMeters: null,
  },
  {
    id: "sao-paulo",
    name: "São Paulo",
    region: "Brazil · South America",
    longitude: -46.6333,
    latitude: -23.5505,
    pm25: 19,
    windDirectionDeg: 135,
    windSpeedKmh: 18,
    hazeLabel: "Moderate",
    dustLevel: null,
    timestampUtc: SAMPLE_TIMESTAMP_UTC,
    averagingWindow: SAMPLE_AVERAGING_WINDOW,
    source: "sample",
    accuracyMeters: null,
  },
];

export function makeUnmeasuredPlace(
  source: "device" | "pin",
  point: MapPoint,
  accuracyMeters: number | null,
): PlaceSelection {
  const id =
    source === "device"
      ? "device-location"
      : `pin-${point.latitude.toFixed(4)}-${point.longitude.toFixed(4)}`;

  return {
    id,
    name: source === "device" ? "Your location" : "Dropped pin",
    region: `${point.latitude.toFixed(3)}°, ${point.longitude.toFixed(3)}°`,
    ...point,
    pm25: null,
    windDirectionDeg: null,
    windSpeedKmh: null,
    hazeLabel: null,
    dustLevel: null,
    timestampUtc: null,
    averagingWindow: null,
    source,
    accuracyMeters,
  };
}

export function getSamplePlan(pm25: number | null, outdoorTimingFlexible: boolean): SampleAction[] {
  const outdoorAction = outdoorTimingFlexible
    ? {
        category: "Outdoor time" as const,
        title: "Choose a less busy time for a walk",
        impact: "Fewer nearby vehicles can reduce one source of particles along your route.",
      }
    : {
        category: "Outdoor time" as const,
        title:
          pm25 !== null && pm25 >= 25
            ? "Take a route away from busy roads"
            : "Choose a greener, quieter route",
        impact: "Moving away from traffic can reduce time beside one source of outdoor particles.",
      };

  return [
    outdoorAction,
    {
      category: "Indoor air",
      title: "Skip burning incense tonight",
      impact: "That removes one source of particles from the air inside your home.",
    },
    {
      category: "Lower-emission commute",
      title: "Combine a short errand or take transit",
      impact: "Fewer separate car trips can mean fewer emissions on nearby streets.",
    },
  ];
}

export function getWindDirectionBucket(degrees: number): number {
  return Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
}
