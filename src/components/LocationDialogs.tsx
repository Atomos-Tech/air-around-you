import { lazy, Suspense } from "react";
import type { Environment, AirReading } from "@/data/air-quality";
import type { PlaceSelection } from "@/data/places";
import AirComparison from "@/components/AirComparison";
import AirDetails from "@/components/AirDetails";
import ExperienceDialog from "@/components/ExperienceDialog";
import PlaceSearch from "@/components/PlaceSearch";
import { localAdvisory, WHO_ADVISORY } from "@/data/air-sources";
import { WORLD_CITIES } from "@/data/cities";
import type { LocationSheet } from "@/hooks/useLocationNavigation";

const DailyPlan = lazy(() => import("@/components/DailyPlan"));

type Props = {
  sheet: LocationSheet | null;
  closeSheet: () => void;
  place: PlaceSelection | null;
  home: PlaceSelection | null;
  readings: Environment;
  currentAir: AirReading | null;
  loading: boolean;
  visit: (place: PlaceSelection) => void;
};

export default function LocationDialogs({
  sheet,
  closeSheet,
  place,
  home,
  readings,
  currentAir,
  loading,
  visit,
}: Props) {
  return (
    <>
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
          <AirComparison home={home} place={place} air={readings.air} loading={loading} />
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
              air={currentAir}
              loading={loading}
              advisory={localAdvisory(place.countryCode) ?? WHO_ADVISORY}
            />
          </Suspense>
        )}
      </ExperienceDialog>
    </>
  );
}
