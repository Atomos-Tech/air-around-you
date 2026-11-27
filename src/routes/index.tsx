import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import LocationDialogs from "@/components/LocationDialogs";
import MapControls from "@/components/MapControls";
import { PinCard, ExploreIntro } from "@/components/ExplorePlace";
import { useLocationNavigation } from "@/hooks/useLocationNavigation";
import ConditionsCard from "@/components/ConditionsCard";
import { currentEnvironment } from "@/data/air-quality";
import { useEnvironment } from "@/hooks/useEnvironment";
import { useHome } from "@/hooks/useHome";

const AirGlobe = lazy(() => import("@/components/AirGlobe"));
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
  const navigation = useLocationNavigation();
  const { place, pin, setPin, view, sheet, setSheet, visit, pickPoint } = navigation;
  const { home, chooseHome } = useHome();
  const [mapError, setMapError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const { value: conditions, loading } = useEnvironment(place);

  const currentReadings = currentEnvironment(conditions);
  const readings = { ...conditions, observation: currentReadings.observation };
  const closeSheet = () => setSheet(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(query.matches);
    change();
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
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

      <MapControls
        navigation={navigation}
        mapError={mapError}
        reducedMotion={reducedMotion}
        paused={paused}
        toggleMotion={() => setPaused((value) => !value)}
      />
      <div className="experience-content">
        {pin ? (
          <PinCard pin={pin} visit={visit} cancel={() => setPin(null)} />
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
          <ExploreIntro home={home} visit={visit} openSearch={() => setSheet("search")} />
        )}
      </div>

      <LocationDialogs
        sheet={sheet}
        closeSheet={closeSheet}
        place={place}
        home={home}
        readings={readings}
        currentAir={currentReadings.air}
        loading={loading}
        visit={visit}
      />
    </main>
  );
}
