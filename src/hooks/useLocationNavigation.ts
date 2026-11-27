import { useCallback, useEffect, useState, useRef } from "react";
import { locateDevice, locationErrorMessage } from "@/lib/device-location";
import type { MapPoint, PlaceSelection } from "@/data/places";

export type LocationSheet = "search" | "air" | "compare" | "plan";
export function useLocationNavigation() {
  const [place, setPlace] = useState<PlaceSelection | null>(null);
  const [pin, setPin] = useState<MapPoint | null>(null);
  const [view, setView] = useState<"globe" | "street">("globe");
  const [sheet, setSheet] = useState<LocationSheet | null>(null);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const locationRequest = useRef<AbortController | null>(null);
  useEffect(() => () => locationRequest.current?.abort(), []);

  function visit(next: PlaceSelection) {
    locationRequest.current?.abort();
    setPlace(next);
    setView("street");
    setPin(null);
    setSheet(null);
    setGeoMessage(null);
    setLocating(false);
  }

  async function findMe() {
    if (window.isSecureContext === false) {
      setGeoMessage(
        "Open the HTTPS version of this site to use Find me. You can also search or drop a pin.",
      );
      return;
    }
    if (!navigator.geolocation) {
      setGeoMessage("This browser has no location service. Search for a place or drop a pin.");
      return;
    }
    locationRequest.current?.abort();
    const request = new AbortController();
    locationRequest.current = request;
    setGeoMessage("Finding your location. Allow location access if your browser asks.");
    setLocating(true);
    try {
      const location = await locateDevice(navigator.geolocation, request.signal);
      if (!request.signal.aborted) visit(location);
    } catch (error) {
      if (!request.signal.aborted) {
        setLocating(false);
        setGeoMessage(locationErrorMessage(error));
      }
    }
  }

  const pickPoint = useCallback((point: MapPoint) => {
    locationRequest.current?.abort();
    setLocating(false);
    setPin(point);
    setGeoMessage(null);
  }, []);
  return {
    place,
    pin,
    setPin,
    view,
    setView,
    sheet,
    setSheet,
    geoMessage,
    locating,
    visit,
    findMe,
    pickPoint,
  };
}
