import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  CircleHelp,
  Cloud,
  Globe2,
  House,
  Info,
  LocateFixed,
  MapPin,
  Mountain,
  Pause,
  Play,
  Search,
  Wind,
  X,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import DailyPlan from "@/components/DailyPlan";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AIR_OBSERVATION_SOURCES, isCurrentObservation } from "@/data/air-observations";
import {
  airCategory,
  compassDirection,
  formatTime,
  hasModeledFog,
  isDelayed,
  makePlace,
  searchPlaces,
  type AirReading,
  type Environment,
  type MapPoint,
  type PlaceSelection,
} from "@/data/air-quality";
import { findLocalCities, WORLD_CITIES } from "@/data/cities";
import { useEnvironment } from "@/hooks/useEnvironment";

const AirGlobe = lazy(() => import("@/components/AirGlobe"));
const HOME_STORAGE_KEY = "air-around-you.home";
const AIR_SOURCE = "https://open-meteo.com/en/docs/air-quality-api";
const WEATHER_SOURCE = "https://open-meteo.com/en/docs";
const GUIDANCE_SOURCE = "https://www.who.int/publications/i/item/WHO-EURO-2024-9115-48887-72806";
const OFFICIAL_MONITOR_LINKS: Record<string, { name: string; url: string }> = {
  IN: { name: "India’s CPCB monitoring map", url: "https://airquality.cpcb.gov.in/AQI_India/" },
  US: { name: "U.S. EPA AirNow monitoring map", url: "https://www.airnow.gov/" },
  JP: {
    name: "Japan’s Ministry of the Environment monitoring portal",
    url: "https://www.env.go.jp/air/portal.html",
  },
  GB: { name: "UK Defra air quality", url: "https://uk-air.defra.gov.uk/" },
  SG: {
    name: "Singapore NEA monitoring feed",
    url: "https://guide.data.gov.sg/developer-guide/real-time-apis",
  },
};
const EEA_COUNTRIES = new Set(
  "AT BE BG CH CY CZ DE DK EE ES FI FR GR HR HU IE IS IT LI LT LU LV MT NL NO PL PT RO SE SI SK".split(
    " ",
  ),
);

function localAdvisory(countryCode: string | undefined) {
  if (!countryCode) return null;
  return (
    OFFICIAL_MONITOR_LINKS[countryCode] ??
    (EEA_COUNTRIES.has(countryCode)
      ? {
          name: "European Environment Agency monitoring map",
          url: "https://airindex.eea.europa.eu/AQI/",
        }
      : null)
  );
}

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
  const [home, setHome] = useState<PlaceSelection | null>(null);
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
  const { value: homeConditions, loading: homeLoading } = useEnvironment(
    sheet === "compare" ? home : null,
  );
  const { air, weather, observation } = conditions;
  const measured = observation && isCurrentObservation(observation) ? observation : null;
  const pm25 = measured?.pm25 ?? air?.pm25;
  const stopMotion = paused || reducedMotion;
  const isHome = place !== null && place.id === home?.id;
  const airDelayed = air !== null && isDelayed(air.timestamp);
  const weatherDelayed = weather !== null && isDelayed(weather.timestamp);
  const availableConditions = {
    air: airDelayed ? null : air,
    weather: weatherDelayed ? null : weather,
    observation: measured,
  };
  const category = airCategory(air?.usAqi);
  const closeSheet = (open: boolean) => {
    if (!open) setSheet(null);
  };

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(HOME_STORAGE_KEY) ?? "null");
      if (!saved || typeof saved !== "object") return;
      const { id, name, region, longitude, latitude, countryCode } =
        saved as Partial<PlaceSelection>;
      if (
        typeof id === "string" &&
        typeof name === "string" &&
        typeof region === "string" &&
        typeof longitude === "number" &&
        Number.isFinite(longitude) &&
        Math.abs(longitude) <= 180 &&
        typeof latitude === "number" &&
        Number.isFinite(latitude) &&
        Math.abs(latitude) <= 90
      ) {
        setHome({
          id,
          name,
          region,
          longitude,
          latitude,
          ...(typeof countryCode === "string" ? { countryCode } : {}),
        });
      }
    } catch {
      // Home can still be selected for this session if browser storage is unavailable.
    }
  }, []);

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

  function chooseHome(location: PlaceSelection) {
    setHome(location);
    try {
      localStorage.setItem(HOME_STORAGE_KEY, JSON.stringify(location));
    } catch {
      // The in-memory reference remains available for this session.
    }
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
              conditions={availableConditions}
              paused={stopMotion}
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
                onClick={() => setSheet("air")}
              >
                {measured
                  ? measured.source === "nea"
                    ? "Monitor network"
                    : "Station reading"
                  : air
                    ? airDelayed
                      ? "Estimate delayed"
                      : "Model estimate"
                    : "Air data"}
                <Info aria-hidden="true" />
              </button>
            </div>

            <div className="air-summary" aria-live="polite">
              {loading ? (
                <p className="status-copy">Getting air conditions…</p>
              ) : (
                <>
                  <div className="aqi-summary">
                    {air?.usAqi != null ? (
                      <p className="aqi-reading" data-severity={category.severity}>
                        <span className="aqi-dot" aria-hidden="true" />
                        <span>
                          <strong>{Math.round(air.usAqi)} modeled US AQI</strong> · {category.label}
                        </span>
                      </p>
                    ) : (
                      <p className="reading-meta">Modeled US AQI unavailable.</p>
                    )}
                    {measured && air?.usAqi != null && <AirModelCredit air={air} />}
                  </div>
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
                  <a
                    href={AIR_OBSERVATION_SOURCES[measured.source].url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {AIR_OBSERVATION_SOURCES[measured.source].name}
                  </a>
                  {" · "}
                  {measured.area} · {formatTime(measured.timestamp)}
                </p>
              ) : (
                air && <AirModelCredit air={air} />
              )}
              {place.accuracyMeters !== undefined && (
                <p className="reading-meta">
                  Device accuracy ±{Math.round(place.accuracyMeters)} m
                </p>
              )}
            </div>

            {(weather || air?.dust != null) && (
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
                  {air?.dust != null && <span>Dust {air.dust} µg/m³</span>}
                </div>
                {weather && (
                  <p className="reading-meta">
                    <a href={WEATHER_SOURCE} target="_blank" rel="noreferrer">
                      Open-Meteo weather
                    </a>{" "}
                    · {formatTime(weather.timestamp)}
                    {weatherDelayed ? " · delayed" : ""}
                  </p>
                )}
              </div>
            )}

            <div className="card-actions">
              <button
                type="button"
                className="map-button map-button-primary"
                onClick={() => setSheet("plan")}
              >
                Today’s plan <ArrowDownRight aria-hidden="true" />
              </button>
              {!isHome && home && (
                <button
                  type="button"
                  className="map-button"
                  onClick={() => setSheet("compare")}
                  aria-label="Compare with Home"
                >
                  <ArrowLeftRight aria-hidden="true" /> Compare
                </button>
              )}
            </div>
            {!isHome && (
              <div className="home-tools">
                {home && (
                  <button type="button" onClick={() => visit(home)}>
                    <House aria-hidden="true" /> Return home
                  </button>
                )}
                <button type="button" onClick={() => chooseHome(place)}>
                  Set as home
                </button>
              </div>
            )}
          </aside>
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

      <Dialog open={sheet === "search"} onOpenChange={closeSheet}>
        <DialogContent className="experience-dialog">
          <DialogHeader>
            <DialogTitle>Explore a place</DialogTitle>
            <DialogDescription>
              Browse {WORLD_CITIES.length} featured cities, search worldwide, or choose any point on
              the map.
            </DialogDescription>
          </DialogHeader>
          {sheet === "search" && <PlaceSearch onPick={visit} />}
        </DialogContent>
      </Dialog>

      <Dialog open={sheet === "air"} onOpenChange={closeSheet}>
        <DialogContent className="experience-dialog">
          <DialogHeader>
            <DialogTitle>Air around {place?.name ?? "this place"}</DialogTitle>
            <DialogDescription>Outdoor conditions for the selected area.</DialogDescription>
          </DialogHeader>
          <AirDetails
            conditions={{ ...conditions, observation: measured }}
            loading={loading}
            countryCode={place?.countryCode}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={sheet === "compare"} onOpenChange={closeSheet}>
        <DialogContent className="experience-dialog">
          <DialogHeader>
            <DialogTitle>Compare with home</DialogTitle>
            <DialogDescription>Compare modeled PM₂.₅ across both locations.</DialogDescription>
          </DialogHeader>
          {home && place && (
            <div className="comparison">
              <CompareReading
                label="Home"
                place={home}
                air={homeConditions.air}
                loading={homeLoading}
              />
              <CompareReading label="Visiting" place={place} air={air} loading={loading} />
            </div>
          )}
          <p className="reading-meta">
            {homeConditions.air && air && homeConditions.air.timestamp === air.timestamp
              ? `Same estimate time · ${formatTime(air.timestamp)}`
              : "Each estimate shows its own model time."}
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={sheet === "plan"} onOpenChange={closeSheet}>
        <DialogContent className="experience-dialog">
          <DialogHeader>
            <DialogTitle>Today’s air plan</DialogTitle>
            <DialogDescription>
              {place?.name} · Choose how your family or group spends the day.
            </DialogDescription>
          </DialogHeader>
          {place && (
            <DailyPlan
              key={place.id}
              location={place.name}
              air={availableConditions.air}
              loading={loading}
              advisory={
                localAdvisory(place.countryCode) ?? {
                  name: "WHO air pollution guidance",
                  url: GUIDANCE_SOURCE,
                }
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function PlaceSearch({ onPick }: { onPick: (location: PlaceSelection) => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceSelection[] | null>(null);
  const [status, setStatus] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("Finding places…");
    setHits(null);
    try {
      const places = await searchPlaces(
        term,
        AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
      );
      if (controller.signal.aborted) return;
      setHits(places);
      setStatus(places.length ? "" : "No cities matched. Try a nearby city or drop a pin.");
    } catch {
      if (!controller.signal.aborted)
        setStatus("Worldwide search is unavailable. Browse featured cities or drop a pin.");
    }
  }

  return (
    <>
      <form className="place-search" onSubmit={submit}>
        <input
          aria-label="City name"
          autoComplete="off"
          placeholder="Search cities"
          value={query}
          maxLength={100}
          onChange={(event) => {
            requestRef.current?.abort();
            setHits(null);
            setStatus("");
            setQuery(event.target.value);
          }}
        />
        <button
          type="submit"
          className="map-button map-button-primary"
          disabled={query.trim().length < 2}
        >
          <Search aria-hidden="true" /> Search
        </button>
      </form>
      {status && (
        <p className="reading-meta" role="status">
          {status}
        </p>
      )}
      <ul className="place-list">
        {(hits ?? findLocalCities(query)).map((location) => (
          <li key={location.id}>
            <button type="button" onClick={() => onPick(location)}>
              <MapPin aria-hidden="true" />
              <span>
                <strong>{location.name}</strong>
                <small>{location.region}</small>
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function AirModelCredit({ air }: { air: AirReading }) {
  const regional = air.model === "cams_europe";
  return (
    <p className="reading-meta">
      <a href={AIR_SOURCE} target="_blank" rel="noreferrer">
        {regional ? "CAMS Europe" : "CAMS global"}
      </a>
      {` · ~${regional ? 11 : 45} km grid · ${formatTime(air.timestamp)}`}
      {isDelayed(air.timestamp) ? " · delayed" : ""}
    </p>
  );
}

function AirDetails({
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
  const pollutants: Array<[string, number | null]> = air
    ? [
        ["Fine particles (PM₂.₅)", air.pm25],
        ["Inhalable particles (PM₁₀)", air.pm10],
        ["Nitrogen dioxide (NO₂)", air.nitrogenDioxide],
        ["Ozone (O₃)", air.ozone],
        ["Carbon monoxide (CO)", air.carbonMonoxide],
        ["Sulphur dioxide (SO₂)", air.sulphurDioxide],
        ["Modeled dust", air.dust],
      ]
    : [];

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
        <>
          <h3 className="data-section-title">Area model estimates</h3>
          <AirModelCredit air={air} />
          <dl className="pollutant-list">
            {pollutants.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {value === null
                    ? "Unavailable"
                    : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} µg/m³`}
                </dd>
              </div>
            ))}
          </dl>
          {air.usAqi !== null && (
            <p className="reading-meta">
              {Math.round(air.usAqi)} modeled US AQI · {airCategory(air.usAqi).label}
            </p>
          )}
        </>
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
