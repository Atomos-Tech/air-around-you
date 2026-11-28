import { Globe2, LocateFixed, Mountain, Pause, Play, Search } from "lucide-react";
import type { useLocationNavigation } from "@/hooks/useLocationNavigation";

type Props = {
  navigation: ReturnType<typeof useLocationNavigation>;
  mapError: boolean;
  paused: boolean;
  reducedMotion: boolean;
  toggleMotion: () => void;
};

export default function MapControls({
  navigation,
  mapError,
  paused,
  reducedMotion,
  toggleMotion,
}: Props) {
  const { place, view, setView, setSheet, findMe, geoMessage, locating } = navigation;
  const showGlobe = () => setView("globe");
  const openSearch = () => setSheet("search");
  const showStreet = () => (place ? setView("street") : openSearch());
  const showPause = place && view === "street" && !reducedMotion;
  return (
    <>
      <header className="experience-header">
        <button
          type="button"
          className="brand"
          aria-label="Air Around You, return to globe"
          onClick={showGlobe}
        >
          <img src="/favicon.png" alt="" />
          <span>Air Around You</span>
        </button>
        <div className="header-actions">
          <button type="button" className="map-button" onClick={openSearch}>
            <Search aria-hidden="true" />
            <span>Explore</span>
          </button>
          <button
            type="button"
            className="map-button map-button-primary"
            onClick={findMe}
            disabled={locating}
          >
            <LocateFixed aria-hidden="true" />
            <span>{locating ? "Finding…" : "Find me"}</span>
          </button>
        </div>
      </header>
      {geoMessage && (
        <div className="map-notice" role="status">
          {geoMessage}
        </div>
      )}
      {mapError && !geoMessage && (
        <div className="map-notice" role="status">
          Some map imagery couldn’t load. You can still explore readings by place.
        </div>
      )}
      <div className="view-controls" role="group" aria-label="Map view">
        <button type="button" aria-pressed={view === "globe"} onClick={showGlobe}>
          <Globe2 aria-hidden="true" /> Globe
        </button>
        <button type="button" aria-pressed={view === "street"} onClick={showStreet}>
          <Mountain aria-hidden="true" /> 3D view
        </button>
        {showPause && (
          <button
            type="button"
            className="motion-control"
            aria-label={paused ? "Resume 3D animations" : "Pause 3D animations"}
            title={paused ? "Resume 3D animations" : "Pause 3D animations"}
            onClick={toggleMotion}
          >
            {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            {paused ? "Resume" : "Pause"}
          </button>
        )}
      </div>
    </>
  );
}
