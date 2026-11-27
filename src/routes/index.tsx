import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Globe2,
  House,
  LocateFixed,
  Mountain,
  Pause,
  Play,
  Search,
  X,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

import AirComparison from "@/components/AirComparison";
import AirDetails from "@/components/AirDetails";
import ConditionsCard from "@/components/ConditionsCard";
import ExperienceDialog from "@/components/ExperienceDialog";
import PlaceSearch from "@/components/PlaceSearch";
import { isCurrentObservation } from "@/data/air-observations";
import { isDelayed, makePlace, type MapPoint, type PlaceSelection } from "@/data/air-quality";
import { localAdvisory, WHO_ADVISORY } from "@/data/air-sources";
import { WORLD_CITIES } from "@/data/cities";
import { useEnvironment } from "@/hooks/useEnvironment";
import { useHome } from "@/hooks/useHome";

const AirGlobe = lazy(() => import("@/components/AirGlobe"));
const DailyPlan = lazy(() => import("@/components/DailyPlan"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Air Around You — Explore the air on Earth" },
      {
        name: "description",
        content:
          "Explore a real Earth map, compare current air estimates around the world, and find practical next steps.",
      },
    ],
  }),
  component: AirQualityExperience,
});

function AirQualityExperience() {
  const [place, setPlace] = useState<PlaceSelection | null>(null);
  const { home, chooseHome } = useHome();
  const [pin, setPin] = useState<MapPoint | null>(null);
  const [view, setView] = useState<"globe" | "street">("globe");
  const [sheet, setSheet] = useState<"search" | "air" | "compare" | "plan" | null>(null);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const locationRequest = useRef(0);

  const { value: conditions, loading } = useEnvironment(place);

  const { air, weather, observation } = conditions;
  const readings = {
    air,
    weather,
    observation: observation && isCurrentObservation(observation) ? observation : null,
  };
  const currentReadings = {
    ...readings,
    air: air && !isDelayed(air.timestamp) ? air : null,
    weather: weather && !isDelayed(weather.timestamp) ? weather : null,
  };
  const closeSheet = () => setSheet(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(query.matches);
    change();
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);

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

  return (
    <main className="experience" data-view={view}>
      <div className="map-stage">
        <ClientOnly fallback={<div className="map-loading">Opening Earth…</div>}>
          <Suspense fallback={<div className="map-loading">Opening Earth…</div>}>
            <AirGlobe
              place={place}
              pendingPoint={pin}
              view={view}
              conditions={currentReadings}
              paused={paused || reducedMotion}
              onMapPick={pickPoint}
              onMapError={setMapError}
            />
          </Suspense>
        </ClientOnly>
      </div>

      <header className="experience-header">
        <button
          type="button"
          className="brand"
          aria-label="Air Around You, return to globe"
          onClick={() => setView("globe")}
        >
          <img src="/favicon.png" alt="" />
          <span>Air Around You</span>
        </button>
        <div className="header-actions">
          <button type="button" className="map-button" onClick={() => setSheet("search")}>
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
      {mapError && (
        <div className="map-notice" role="status">
          Some map imagery couldn’t load. You can still explore readings by place.
        </div>
      )}

      <div className="view-controls" role="group" aria-label="Map view">
        <button type="button" aria-pressed={view === "globe"} onClick={() => setView("globe")}>
          <Globe2 aria-hidden="true" /> Globe
        </button>
        <button
          type="button"
          aria-pressed={view === "street"}
          onClick={() => (place ? setView("street") : setSheet("search"))}
        >
          <Mountain aria-hidden="true" /> 3D view
        </button>
        {place && view === "street" && !reducedMotion && (
          <button
            type="button"
            className="motion-control"
            aria-label={paused ? "Resume scene motion" : "Pause scene motion"}
            title={paused ? "Resume scene motion" : "Pause scene motion"}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          </button>
        )}
      </div>

      <div className="experience-content">
        {pin ? (
          <section className="surface pin-card" aria-label="Selected map point">
            <div>
              <h1>Explore this spot</h1>
              <p>
                {pin.latitude.toFixed(3)}°, {pin.longitude.toFixed(3)}°
              </p>
            </div>
            <div className="card-actions">
              <button
                type="button"
                className="map-button map-button-primary"
                onClick={() => visit(makePlace(pin))}
              >
                Stand here
              </button>
              <button
                type="button"
                className="icon-tool"
                aria-label="Cancel pin"
                onClick={() => setPin(null)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </section>
        ) : place ? (
          <ConditionsCard
            place={place}
            home={home}
            conditions={readings}
            loading={loading}
            onOpen={setSheet}
            onVisit={visit}
            onChooseHome={chooseHome}
          />
        ) : (
          <section className="intro">
            <h1>
              See the air
              <br />
              around you.
            </h1>
            <p>Fly to a place, see its outdoor air, and compare it with home.</p>
            <div className="card-actions">
              <button
                type="button"
                className="map-button map-button-primary"
                onClick={() => setSheet("search")}
              >
                Explore a place <ArrowUpRight aria-hidden="true" />
              </button>
              {home && (
                <button type="button" className="map-button" onClick={() => visit(home)}>
                  <House aria-hidden="true" /> Return home
                </button>
              )}
            </div>
            <div className="featured-inline" aria-label="Places to explore">
              {WORLD_CITIES.slice(0, 3).map((item) => (
                <button key={item.id} type="button" onClick={() => visit(item)}>
                  {item.name}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <ExperienceDialog
        open={sheet === "search"}
        onClose={closeSheet}
        title="Explore a place"
        description={`Browse ${WORLD_CITIES.length} featured cities, search worldwide, or choose any point on the map.`}
      >
        {sheet === "search" && <PlaceSearch onPick={visit} />}
      </ExperienceDialog>

      <ExperienceDialog
        open={sheet === "air"}
        onClose={closeSheet}
        title={`Air around ${place?.name ?? "this place"}`}
        description="Outdoor conditions for the selected area."
      >
        <AirDetails conditions={readings} loading={loading} countryCode={place?.countryCode} />
      </ExperienceDialog>

      <ExperienceDialog
        open={sheet === "compare"}
        onClose={closeSheet}
        title="Compare with home"
        description="Compare modeled PM₂.₅ across both locations."
      >
        {sheet === "compare" && home && place && (
          <AirComparison home={home} place={place} air={air} loading={loading} />
        )}
      </ExperienceDialog>

      <ExperienceDialog
        open={sheet === "plan"}
        layout="plan"
        onClose={closeSheet}
        title="Today’s air plan"
        description={`${place?.name ?? ""} · Choose how your family or group spends the day.`}
      >
        {place && (
          <Suspense
            fallback={
              <p className="reading-meta" role="status">
                Opening your plan…
              </p>
            }
          >
            <DailyPlan
              key={place.id}
              location={place.name}
              air={currentReadings.air}
              loading={loading}
              advisory={localAdvisory(place.countryCode) ?? WHO_ADVISORY}
            />
          </Suspense>
        )}
      </ExperienceDialog>
    </main>
  );
}
