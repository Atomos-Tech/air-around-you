import { ArrowUpRight } from "lucide-react";

import { AIR_OBSERVATION_SOURCES } from "@/data/air-observations";
import {
  airCategory,
  formatTime,
  hasModeledFog,
  isDelayed,
  type AirReading,
  type Environment,
} from "@/data/air-quality";
import { localAdvisory, WEATHER_SOURCE } from "@/data/air-sources";
import AirModelCredit from "./AirModelCredit";

export default function AirDetails({
  conditions,
  loading,
  countryCode,
}: {
  conditions: Environment;
  loading: boolean;
  countryCode: string | undefined;
}) {
  const { air, weather, observation } = conditions;
  const observationSource = observation ? AIR_OBSERVATION_SOURCES[observation.source] : null;
  const official = localAdvisory(countryCode);

  return (
    <>
      {observation && observationSource && (
        <section className="observed-air" aria-label="Measured PM₂.₅">
          <h3>{Math.round(observation.pm25 * 10) / 10} µg/m³ measured PM₂.₅</h3>
          <p>{observation.area}</p>
          <p className="reading-meta">
            <a href={observationSource.url} target="_blank" rel="noreferrer">
              {observationSource.detail}
            </a>
            {" · "}
            {formatTime(observation.timestamp)}
          </p>
        </section>
      )}
      {air ? (
        <ModelEstimates air={air} />
      ) : (
        <p className="reading-meta">
          {loading ? "Getting air conditions…" : "Air estimates are unavailable for this point."}
        </p>
      )}
      {weather && (
        <p className="reading-meta">
          <a href={WEATHER_SOURCE} target="_blank" rel="noreferrer">
            Open-Meteo weather · best available model for this location
          </a>{" "}
          · {formatTime(weather.timestamp)}
          {isDelayed(weather.timestamp) ? " · delayed" : ""}
          {weather.visibility !== null
            ? ` · Visibility ${(weather.visibility / 1000).toFixed(1)} km`
            : ""}
          {hasModeledFog(weather.code) ? " · Fog modeled" : ""}
        </p>
      )}
      {official && (
        <a className="guidance-link" href={official.url} target="_blank" rel="noreferrer">
          {official.name} <ArrowUpRight aria-hidden="true" />
        </a>
      )}
      <p className="reading-meta">
        The 3D scene uses area weather and air data. Water motion illustrates wind and the path of
        mapped waterways.
      </p>
    </>
  );
}

const POLLUTANTS = [
  ["pm25", "Fine particles (PM₂.₅)"],
  ["pm10", "Inhalable particles (PM₁₀)"],
  ["nitrogenDioxide", "Nitrogen dioxide (NO₂)"],
  ["ozone", "Ozone (O₃)"],
  ["carbonMonoxide", "Carbon monoxide (CO)"],
  ["sulphurDioxide", "Sulphur dioxide (SO₂)"],
  ["dust", "Modeled dust"],
] as const;

function formatConcentration(value: number | null) {
  return value === null
    ? "Unavailable"
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} µg/m³`;
}

function ModelEstimates({ air }: { air: AirReading }) {
  return (
    <>
      <h3 className="data-section-title">Area model estimates</h3>
      <AirModelCredit air={air} />
      <dl className="pollutant-list">
        {POLLUTANTS.map(([field, label]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{formatConcentration(air[field])}</dd>
          </div>
        ))}
      </dl>
      {air.usAqi !== null && (
        <p className="reading-meta">
          {Math.round(air.usAqi)} modeled US AQI · {airCategory(air.usAqi).label}
        </p>
      )}
    </>
  );
}
