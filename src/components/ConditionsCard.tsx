import { ArrowDownRight, ArrowLeftRight, Cloud, House, Info, Wind } from "lucide-react";

import { AIR_OBSERVATION_SOURCES } from "@/data/air-observations";
import {
  airCategory,
  compassDirection,
  formatTime,
  hasModeledFog,
  isDelayed,
  type AirReading,
  type Environment,
} from "@/data/air-quality";
import type { PlaceSelection } from "@/data/places";
import { WEATHER_SOURCE } from "@/data/air-sources";
import AirModelCredit from "./AirModelCredit";

type Props = {
  place: PlaceSelection;
  home: PlaceSelection | null;
  conditions: Environment;
  loading: boolean;
  onOpen: (sheet: "air" | "compare" | "plan") => void;
  onVisit: (place: PlaceSelection) => void;
  onChooseHome: (place: PlaceSelection) => void;
};

function sourceLabel({ air, observation }: Environment) {
  if (observation) return observation.source === "nea" ? "Monitor network" : "Station reading";
  if (!air) return "Air data";
  return isDelayed(air.timestamp) ? "Estimate delayed" : "Model estimate";
}

export default function ConditionsCard({
  place,
  home,
  conditions,
  loading,
  onOpen,
  onVisit,
  onChooseHome,
}: Props) {
  const isHome = place.id === home?.id;
  return (
    <aside className="surface conditions-card" aria-label="Air around the selected location">
      <div className="place-heading">
        <div>
          <span className="place-role">{isHome ? "Home" : "Visiting"}</span>
          <h1>{place.name}</h1>
          <p>{place.region}</p>
        </div>
        <button
          type="button"
          className="data-label"
          aria-label="Air data details"
          onClick={() => onOpen("air")}
        >
          {sourceLabel(conditions)}
          <Info aria-hidden="true" />
        </button>
      </div>

      <AirSummary conditions={conditions} loading={loading} accuracyMeters={place.accuracyMeters} />
      <WeatherStrip weather={conditions.weather} dust={conditions.air?.dust ?? null} />

      <div className="card-actions">
        <button
          type="button"
          className="map-button map-button-primary"
          onClick={() => onOpen("plan")}
        >
          Today’s plan <ArrowDownRight aria-hidden="true" />
        </button>
        {!isHome && home && (
          <button
            type="button"
            className="map-button"
            onClick={() => onOpen("compare")}
            aria-label="Compare with Home"
          >
            <ArrowLeftRight aria-hidden="true" /> Compare
          </button>
        )}
      </div>
      {!isHome && (
        <div className="home-tools">
          {home && (
            <button type="button" onClick={() => onVisit(home)}>
              <House aria-hidden="true" /> Return home
            </button>
          )}
          <button type="button" onClick={() => onChooseHome(place)}>
            Set as home
          </button>
        </div>
      )}
    </aside>
  );
}

function AirSummary({
  conditions,
  loading,
  accuracyMeters,
}: {
  conditions: Environment;
  loading: boolean;
  accuracyMeters: number | undefined;
}) {
  const { air, observation: measured } = conditions;
  const pm25 = measured?.pm25 ?? air?.pm25;
  return (
    <div className="air-summary" aria-live="polite">
      {loading ? (
        <p className="status-copy">Getting air conditions…</p>
      ) : (
        <>
          <AqiSummary air={air} showCredit={Boolean(measured)} />
          {pm25 != null ? (
            <div className="pm-value">
              {Math.round(pm25 * 10) / 10} <span>µg/m³ PM₂.₅</span>
            </div>
          ) : (
            <p className="status-copy">PM₂.₅ unavailable for this point.</p>
          )}
        </>
      )}
      {measured ? (
        <p className="reading-meta">
          <a href={AIR_OBSERVATION_SOURCES[measured.source].url} target="_blank" rel="noreferrer">
            {AIR_OBSERVATION_SOURCES[measured.source].name}
          </a>
          {" · "}
          {measured.area} · {formatTime(measured.timestamp)}
        </p>
      ) : (
        air && <AirModelCredit air={air} />
      )}
      {accuracyMeters !== undefined && (
        <p className="reading-meta">Device accuracy ±{Math.round(accuracyMeters)} m</p>
      )}
    </div>
  );
}

function AqiSummary({ air, showCredit }: { air: AirReading | null; showCredit: boolean }) {
  if (air?.usAqi == null) {
    return (
      <div className="aqi-summary">
        <p className="reading-meta">Modeled US AQI unavailable.</p>
      </div>
    );
  }
  const category = airCategory(air.usAqi);
  return (
    <div className="aqi-summary">
      <p className="aqi-reading" data-severity={category.severity}>
        <span className="aqi-dot" aria-hidden="true" />
        <span>
          <strong>{Math.round(air.usAqi)} modeled US AQI</strong> · {category.label}
        </span>
      </p>
      {showCredit && <AirModelCredit air={air} />}
    </div>
  );
}

function WeatherStrip({ weather, dust }: { weather: Environment["weather"]; dust: number | null }) {
  if (!weather && dust === null) return null;
  return (
    <div className="weather-strip">
      <div>
        {weather?.windSpeed != null && weather.windFrom !== null && (
          <span>
            <Wind aria-hidden="true" /> {weather.windSpeed} km/h from{" "}
            {compassDirection(weather.windFrom)}
          </span>
        )}
        {weather?.cloudCover != null && (
          <span>
            <Cloud aria-hidden="true" /> {weather.cloudCover}% cloud
          </span>
        )}
        {hasModeledFog(weather?.code) && <span>Fog modeled</span>}
        {dust !== null && <span>Dust {dust} µg/m³</span>}
      </div>
      {weather && (
        <p className="reading-meta">
          <a href={WEATHER_SOURCE} target="_blank" rel="noreferrer">
            Open-Meteo weather
          </a>{" "}
          · {formatTime(weather.timestamp)}
          {isDelayed(weather.timestamp) ? " · delayed" : ""}
        </p>
      )}
    </div>
  );
}
