import { CircleHelp } from "lucide-react";

import { formatTime, type AirReading, type PlaceSelection } from "@/data/air-quality";
import { useEnvironment } from "@/hooks/useEnvironment";
import AirModelCredit from "./AirModelCredit";

type Props = {
  home: PlaceSelection;
  place: PlaceSelection;
  air: AirReading | null;
  loading: boolean;
};

export default function AirComparison({ home, place, air, loading }: Props) {
  const { value: homeConditions, loading: homeLoading } = useEnvironment(home);
  return (
    <>
      <div className="comparison">
        <CompareReading label="Home" place={home} air={homeConditions.air} loading={homeLoading} />
        <CompareReading label="Visiting" place={place} air={air} loading={loading} />
      </div>

      <p className="reading-meta">
        {homeConditions.air && air && homeConditions.air.timestamp === air.timestamp
          ? `Same estimate time · ${formatTime(air.timestamp)}`
          : "Each estimate shows its own model time."}
      </p>
    </>
  );
}

function CompareReading({
  place,
  label,
  air,
  loading,
}: {
  place: PlaceSelection;
  label: string;
  air: AirReading | null;
  loading: boolean;
}) {
  return (
    <section className="comparison-place">
      <span className="place-role">{label}</span>
      <h3>{place.name}</h3>
      {air?.pm25 != null ? (
        <>
          <p className="comparison-value">
            {Math.round(air.pm25 * 10) / 10} <small>µg/m³</small>
          </p>
          <AirModelCredit air={air} />
        </>
      ) : (
        <small>
          <CircleHelp aria-hidden="true" /> {loading ? "Getting conditions…" : "PM₂.₅ unavailable"}
        </small>
      )}
    </section>
  );
}
