import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

import type { MapPoint, PlaceSelection } from "@/data/air-quality";

type AirGlobeProps = {
  place: PlaceSelection | null;
  pendingPoint: MapPoint | null;
  onMapPick: (point: MapPoint) => void;
  onMapError: (hasError: boolean) => void;
};

const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

export default function AirGlobe({ place, pendingPoint, onMapPick, onMapError }: AirGlobeProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const humanMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    maplibregl.setWorkerUrl(mapWorkerUrl);
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: MAP_STYLE,
        center: [10, 18],
        zoom: 1.45,
        minZoom: 0.8,
        maxZoom: 19,
        attributionControl: false,
        cooperativeGestures: true,
      });
    } catch (error) {
      onMapError(true);
      console.warn("The Earth map could not be opened", error);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl(), "top-right");
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
      "bottom-right",
    );

    map.on("style.load", () => map.setProjection({ type: "globe" }));
    map.on("load", () => {
      setMapReady(true);
      onMapError(false);
    });
    map.on("error", (event) => {
      if (!map.isStyleLoaded()) onMapError(true);
      console.warn("Map resource could not be loaded", event.error.message);
    });
    map.on("click", (event) => {
      onMapPick({
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
      });
    });

    return () => {
      humanMarkerRef.current?.remove();
      pinMarkerRef.current?.remove();
      humanMarkerRef.current = null;
      pinMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [onMapError, onMapPick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !place) return;

    const markerElement = document.createElement("div");
    markerElement.className = "human-marker";
    markerElement.setAttribute("role", "img");
    markerElement.setAttribute("aria-label", `Avatar at ${place.name}`);
    markerElement.innerHTML =
      '<span class="marker-accuracy" aria-hidden="true"></span><span class="avatar-figure" aria-hidden="true"><span class="avatar-head"></span><span class="avatar-body"></span><span class="avatar-legs"><span></span><span></span></span></span>';
    markerElement.classList.toggle("has-accuracy", place.source === "device");
    humanMarkerRef.current?.remove();
    humanMarkerRef.current = new maplibregl.Marker({
      element: markerElement,
      anchor: "center",
    })
      .setLngLat([place.longitude, place.latitude])
      .addTo(map);

    map.flyTo({
      center: [place.longitude, place.latitude],
      zoom: 15.2,
      pitch: 56,
      bearing: 18,
      duration: 2600,
    });
  }, [mapReady, place]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    pinMarkerRef.current?.remove();
    pinMarkerRef.current = null;

    if (pendingPoint) {
      const markerElement = document.createElement("div");
      markerElement.className = "pending-pin-marker";
      markerElement.setAttribute("role", "img");
      markerElement.setAttribute("aria-label", "Selected map point");
      pinMarkerRef.current = new maplibregl.Marker({
        element: markerElement,
        anchor: "bottom-left",
      })
        .setLngLat([pendingPoint.longitude, pendingPoint.latitude])
        .addTo(map);
    }
  }, [mapReady, pendingPoint]);

  return <div ref={mapContainerRef} className="h-full w-full" aria-label="Interactive Earth map" />;
}
