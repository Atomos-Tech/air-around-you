import { useCallback, useState, useRef } from "react";
import { makePlace, type MapPoint, type PlaceSelection } from "@/data/places";

export type LocationSheet = "search" | "air" | "compare" | "plan";
export function useLocationNavigation() {
  const [place, setPlace] = useState<PlaceSelection | null>(null);
  const [pin, setPin] = useState<MapPoint | null>(null);
  const [view, setView] = useState<"globe" | "street">("globe");
  const [sheet, setSheet] = useState<LocationSheet | null>(null);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const locationRequest = useRef(0);
  function visit(next: PlaceSelection) {
    locationRequest.current += 1;
    setPlace(next);
    setView("street");
    setPin(null);
    setSheet(null);
    setGeoMessage(null);
    setLocating(false);
  }

  function findMe() {
    if (!navigator.geolocation) {
      setGeoMessage("This browser has no location service. Search for a place or drop a pin.");
      return;
    }

    const request = ++locationRequest.current;
    setGeoMessage(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (locationRequest.current !== request) return;
        visit(
          makePlace({ longitude: coords.longitude, latitude: coords.latitude }, coords.accuracy),
        );
      },
      () => {
        if (locationRequest.current !== request) return;
        setLocating(false);
        setGeoMessage("Location wasn’t shared. Search for a place or drop a pin.");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  const pickPoint = useCallback((point: MapPoint) => {
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
