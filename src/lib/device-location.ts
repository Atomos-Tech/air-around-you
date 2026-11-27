import { makePlace } from "@/data/places";

function readPosition(service: Geolocation, highAccuracy: boolean) {
  return new Promise<GeolocationPosition>((resolve, reject) =>
    service.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: highAccuracy,
      timeout: highAccuracy ? 8_000 : 15_000,
      maximumAge: 60_000,
    }),
  );
}

function locationErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error ? error.code : undefined;
}

export function locationErrorMessage(error: unknown) {
  switch (locationErrorCode(error)) {
    case 1:
      return "Location access is blocked. Allow location for this site in your browser and device settings. In an embedded preview, open the site in its own tab.";
    case 3:
      return "The device timed out finding your location. Try Find me again, search for a place, or drop a pin.";
    default:
      return "Your device couldn’t determine its location. Check location services, search for a place, or drop a pin.";
  }
}

export async function locateDevice(service: Geolocation, signal: AbortSignal) {
  let position: GeolocationPosition;
  try {
    position = await readPosition(service, true);
  } catch (error) {
    signal.throwIfAborted();
    const code = locationErrorCode(error);
    if (code !== 2 && code !== 3) throw error;
    // Some devices can supply a network location even when a precise fix fails.
    position = await readPosition(service, false);
  }
  signal.throwIfAborted();
  const { latitude, longitude, accuracy } = position.coords;
  return makePlace({ latitude, longitude }, accuracy);
}
