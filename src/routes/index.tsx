import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, Suspense, lazy } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CircleHelp,
  CloudSun,
  Home,
  LocateFixed,
  MapPin,
  Pause,
  Play,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getSamplePlan,
  getWindDirectionBucket,
  makeUnmeasuredPlace,
  SAMPLE_AVERAGING_WINDOW,
  SAMPLE_LOCATIONS,
  SAMPLE_TIMESTAMP_LABEL,
  type MapPoint,
  type PlaceSelection,
} from "@/data/air-quality";

const AirGlobe = lazy(() => import("@/components/AirGlobe"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Air Around You — Urban Air Quality" },
      {
        name: "description",
        content:
          "Explore the air around you on an interactive globe, compare sample readings, and choose a practical action for today.",
      },
      { property: "og:title", content: "Air Around You — Urban Air Quality" },
      {
        property: "og:description",
        content:
          "Explore the air around you on an interactive globe, compare sample readings, and choose a practical action for today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AirQualityExperience,
});

function AirQualityExperience() {
  const [activePlace, setActivePlace] = useState<PlaceSelection | null>(null);
  const [homePlace, setHomePlace] = useState<PlaceSelection | null>(null);
  const [pendingPoint, setPendingPoint] = useState<MapPoint | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [mapError, setMapError] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [timingFlexible, setTimingFlexible] = useState(false);
  const [breathingPaused, setBreathingPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [breathPhase, setBreathPhase] = useState<"inhale" | "exhale">("inhale");

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (reducedMotion || breathingPaused) return;
    const timer = window.setInterval(() => {
      setBreathPhase((phase) => (phase === "inhale" ? "exhale" : "inhale"));
    }, 4000);
    return () => window.clearInterval(timer);
  }, [breathingPaused, reducedMotion]);

  const isHome = activePlace !== null && activePlace.id === homePlace?.id;
  const isVisiting = activePlace !== null && homePlace !== null && !isHome;
  const planActions = useMemo(
    () => getSamplePlan(activePlace?.pm25 ?? null, timingFlexible),
    [activePlace?.pm25, timingFlexible],
  );

  const chooseSample = (sample: PlaceSelection) => {
    if (homePlace === null) setHomePlace(sample);
    setActivePlace(sample);
    setPendingPoint(null);
    setLocationMessage(null);
  };

  const requestLocation = () => {
    setLocationMessage(null);
    if (!navigator.geolocation) {
      setLocationMessage(
        "Location is unavailable here. Choose a sample place or tap the map to drop a pin.",
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const place = makeUnmeasuredPlace(
          "device",
          {
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
          },
          position.coords.accuracy,
        );
        setHomePlace(place);
        setActivePlace(place);
        setPendingPoint(null);
      },
      () => {
        setLocationMessage(
          "Location wasn’t shared. Choose a sample place or tap the map to drop a pin.",
        );
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  };

  const handleMapPick = useCallback((point: MapPoint) => {
    setPendingPoint(point);
    setLocationMessage(null);
  }, []);

  const standHere = () => {
    if (!pendingPoint) return;
    const place = makeUnmeasuredPlace("pin", pendingPoint, null);
    setActivePlace(place);
    setPendingPoint(null);
  };

  const returnHome = () => {
    if (!homePlace) return;
    setActivePlace(homePlace);
    setPendingPoint(null);
    setPlanOpen(false);
  };

  const windBucket =
    activePlace?.windDirectionDeg === null || activePlace?.windDirectionDeg === undefined
      ? null
      : getWindDirectionBucket(activePlace.windDirectionDeg);
  const windSpeed = activePlace?.windSpeedKmh;
  const speedClass =
    windSpeed === null || windSpeed === undefined
      ? null
      : windSpeed < 10
        ? "calm"
        : windSpeed < 17
          ? "steady"
          : "breezy";
  const canCompare = homePlace !== null && activePlace !== null && !isHome;

  return (
    <main className="air-app" data-breathing-paused={breathingPaused} data-plan-open={planOpen}>
      <div className="map-stage">
        <ClientOnly fallback={<div className="map-loading">Opening Earth…</div>}>
          <Suspense fallback={<div className="map-loading">Opening Earth…</div>}>
            <AirGlobe
              place={activePlace}
              pendingPoint={pendingPoint}
              onMapPick={handleMapPick}
              onMapError={setMapError}
            />
          </Suspense>
        </ClientOnly>
      </div>

      {activePlace?.windDirectionDeg !== null && activePlace?.windDirectionDeg !== undefined && (
        <div
          className="air-atmosphere"
          data-wind-direction={windBucket}
          data-wind-speed={speedClass}
          aria-hidden="true"
        >
          <span className="air-cloud-band" />
          <span className="air-cloud-band" />
          <span className="wind-trail" />
          <span className="wind-trail" />
          <span className="wind-trail" />
          <span className="wind-trail" />
          <span className="wind-trail" />
          <span className="wind-trail" />
          <span className="wind-trail" />
          <span className="air-haze-wash" />
          {activePlace.dustLevel === "present" && (
            <div>
              <span className="dust-speck" />
              <span className="dust-speck" />
              <span className="dust-speck" />
              <span className="dust-speck" />
              <span className="dust-speck" />
            </div>
          )}
        </div>
      )}

      <header className="air-topbar">
        <div className="air-brand">
          <span className="brand-mark">
            <Activity aria-hidden="true" className="h-4 w-4" />
          </span>
          <span>Air Around You</span>
        </div>
        <div className="air-topbar-note">Sample data · educational view</div>
      </header>

      <aside className="air-panel" aria-label="Location selection and air summary">
        <div className="air-panel-scroll">
          <div className="panel-kicker">
            <CloudSun aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />
            {activePlace
              ? isHome
                ? "Air around home"
                : isVisiting
                  ? "Visiting"
                  : "Selected place"
              : "A world of air"}
          </div>
          <h1 className="air-title">What are you breathing today?</h1>
          <p className="air-subtitle">
            Explore a place, see its sample air reading, and choose one practical step for today.
          </p>

          <div className="primary-actions">
            <Button onClick={requestLocation} aria-label="Find my location">
              <LocateFixed aria-hidden="true" /> Find me
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const firstSample = SAMPLE_LOCATIONS[0];
                if (firstSample) chooseSample(firstSample);
              }}
            >
              <MapPin aria-hidden="true" /> Try a sample location
            </Button>
          </div>

          {locationMessage && (
            <p className="geo-message" role="status">
              {locationMessage}
            </p>
          )}

          <section className="sample-section" aria-labelledby="sample-places-title">
            <div className="section-heading">
              <span id="sample-places-title">Sample places</span>
              <span className="sample-tag">Sample data</span>
            </div>
            <div className="sample-list">
              {SAMPLE_LOCATIONS.map((sample) => {
                const selected = activePlace?.id === sample.id;
                return (
                  <Button
                    key={sample.id}
                    variant={selected ? "default" : "outline"}
                    className="sample-place-button"
                    aria-pressed={selected}
                    onClick={() => chooseSample(sample)}
                  >
                    {sample.name}
                  </Button>
                );
              })}
            </div>
          </section>

          {pendingPoint && (
            <section className="movement-section" aria-label="Selected map point">
              <div className="place-line">
                <div>
                  <div className="eyebrow">Pin selected</div>
                  <p className="place-name">
                    {pendingPoint.latitude.toFixed(3)}°, {pendingPoint.longitude.toFixed(3)}°
                  </p>
                </div>
                <MapPin aria-hidden="true" className="mt-1 h-5 w-5 text-accent" />
              </div>
              <div className="place-actions">
                <Button onClick={standHere}>
                  <Check aria-hidden="true" /> Stand here
                </Button>
                <Button variant="ghost" onClick={() => setPendingPoint(null)}>
                  Cancel pin
                </Button>
              </div>
            </section>
          )}

          {activePlace && (
            <>
              <section className="air-reading-section" aria-labelledby="reading-title">
                <div className="place-line">
                  <div>
                    <div className="eyebrow">
                      {isHome ? "Home" : isVisiting ? "Visiting" : "Current place"}
                    </div>
                    <h2 className="place-name" id="reading-title">
                      {activePlace.name}
                    </h2>
                    <p className="place-region">{activePlace.region}</p>
                  </div>
                  {activePlace.source === "sample" && (
                    <span className="sample-tag">Sample data</span>
                  )}
                  {activePlace.source === "device" && (
                    <span className="mode-tag">GPS accuracy</span>
                  )}
                </div>

                {activePlace.pm25 === null ? (
                  <div className="reading-row">
                    <CircleHelp aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
                    <span className="reading-label">Air data unavailable</span>
                  </div>
                ) : (
                  <>
                    <div className="reading-row">
                      <span className="reading-value">{activePlace.pm25}</span>
                      <span className="reading-unit">µg/m³</span>
                    </div>
                    <div className="reading-label">PM₂.₅ · sample reading</div>
                    <p className="reading-meta">
                      {SAMPLE_TIMESTAMP_LABEL} · {activePlace.averagingWindow}
                    </p>
                  </>
                )}

                {activePlace.source === "device" && activePlace.accuracyMeters !== null && (
                  <p className="reading-meta">
                    Approximate location accuracy ±{Math.round(activePlace.accuracyMeters)} m.
                    Coordinates stay in this browser.
                  </p>
                )}

                {activePlace.windSpeedKmh !== null && (
                  <p className="reading-meta">
                    Sample wind · {activePlace.windSpeedKmh} km/h · {activePlace.hazeLabel} haze
                  </p>
                )}

                <Button
                  className="sample-plan-button"
                  variant="secondary"
                  aria-expanded={planOpen}
                  onClick={() => setPlanOpen((open) => !open)}
                >
                  <span>What can I do today?</span>
                  {planOpen ? (
                    <ArrowDownRight aria-hidden="true" />
                  ) : (
                    <ArrowUpRight aria-hidden="true" />
                  )}
                </Button>

                <div className="place-actions">
                  {!isHome && (
                    <Button variant="outline" size="sm" onClick={() => setHomePlace(activePlace)}>
                      <Home aria-hidden="true" /> Set as Home
                    </Button>
                  )}
                  {isVisiting && (
                    <Button variant="ghost" size="sm" onClick={returnHome}>
                      <Home aria-hidden="true" /> Return Home
                    </Button>
                  )}
                  {homePlace &&
                    activePlace.id === homePlace.id &&
                    homePlace.source === "device" && (
                      <span className="microcopy">Your location is Home on this device.</span>
                    )}
                  {canCompare && (
                    <Button variant="ghost" size="sm" onClick={() => setComparisonOpen(true)}>
                      Compare with Home
                    </Button>
                  )}
                </div>
              </section>

              <section className="breath-section" aria-labelledby="breath-title">
                <div className="breath-header">
                  <div>
                    <div className="section-heading mb-1" id="breath-title">
                      A breath, in motion
                    </div>
                    <div className="breath-state">
                      {reducedMotion
                        ? "Motion reduced"
                        : breathingPaused
                          ? "Breathing paused"
                          : breathPhase === "inhale"
                            ? "Inhale"
                            : "Exhale"}
                    </div>
                  </div>
                  {!reducedMotion && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={
                        breathingPaused ? "Resume breathing animation" : "Pause breathing animation"
                      }
                      title={
                        breathingPaused ? "Resume breathing animation" : "Pause breathing animation"
                      }
                      onClick={() => setBreathingPaused((paused) => !paused)}
                    >
                      {breathingPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                    </Button>
                  )}
                </div>
                <p className="breath-copy">
                  {reducedMotion ? (
                    <>
                      Static view: air enters the airways as you inhale; carbon dioxide leaves with
                      each exhale.
                    </>
                  ) : breathingPaused ? (
                    <>
                      The avatar is resting. <strong>Inhale:</strong> air enters the airways and
                      oxygen moves into the blood. <strong>Exhale:</strong> carbon dioxide leaves
                      with the breath.
                    </>
                  ) : breathPhase === "inhale" ? (
                    <>
                      <strong>Air enters the airways;</strong> oxygen moves into the blood.
                    </>
                  ) : (
                    <>
                      <strong>Carbon dioxide leaves</strong> with the breath.
                    </>
                  )}
                </p>
              </section>

              {activePlace.pm25 !== null && (
                <section className="education-section" aria-label="About particle pollution">
                  <div className="section-heading">
                    <span>About particles</span>
                    <span className="sample-tag">Sample data</span>
                  </div>
                  <p className="education-copy">
                    Particle pollution can <strong>irritate airways</strong> and make breathing less
                    comfortable for some people. This is general context, not a personal health
                    reading or diagnosis.
                  </p>
                </section>
              )}

              {planOpen && (
                <section className="plan-section" aria-labelledby="plan-title">
                  <div className="section-heading">
                    <span id="plan-title">A small plan for today</span>
                    <span className="sample-tag">Sample guidance</span>
                  </div>
                  <div className="flexible-row">
                    <label className="flexible-label" htmlFor="flexible-timing">
                      My outdoor timing is flexible
                    </label>
                    <Switch
                      id="flexible-timing"
                      checked={timingFlexible}
                      onCheckedChange={setTimingFlexible}
                      aria-label="My outdoor timing is flexible"
                    />
                  </div>
                  <ul className="plan-list">
                    {planActions.map((action) => (
                      <li className="plan-item" key={action.category}>
                        <div className="eyebrow">{action.category}</div>
                        <div className="plan-item-title">{action.title}</div>
                        <p className="plan-item-impact">{action.impact}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="microcopy">Illustrative sample guidance; not medical advice.</p>
                </section>
              )}
            </>
          )}

          {!activePlace && (
            <section className="movement-section">
              <div className="section-heading">
                <span>Choose a place to begin</span>
              </div>
              <p className="microcopy">
                Tap a sample city, find your location, or tap anywhere on the globe to place a pin.
              </p>
            </section>
          )}
        </div>
      </aside>

      {mapError && (
        <div className="map-error-banner" role="status">
          The map didn’t load. Your selected place, readings, and actions remain available here.
        </div>
      )}

      <Dialog open={comparisonOpen} onOpenChange={setComparisonOpen}>
        <DialogContent className="compare-dialog">
          <DialogHeader>
            <DialogTitle className="compare-heading">Compare with Home</DialogTitle>
            <DialogDescription>A side-by-side look at the sample PM₂.₅ readings.</DialogDescription>
          </DialogHeader>
          {homePlace && activePlace && (
            <div className="compare-grid">
              <ComparePlace place={homePlace} label="Home" />
              <ComparePlace place={activePlace} label="Visiting" />
            </div>
          )}
          {homePlace?.pm25 !== null &&
            activePlace?.pm25 !== null &&
            homePlace?.source === "sample" &&
            activePlace?.source === "sample" &&
            homePlace.timestampUtc === activePlace.timestampUtc &&
            homePlace.averagingWindow === activePlace.averagingWindow && (
              <p className="microcopy">
                Same sample timestamp: {SAMPLE_TIMESTAMP_LABEL} · same window:{" "}
                {SAMPLE_AVERAGING_WINDOW}.
              </p>
            )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ComparePlace({ place, label }: { place: PlaceSelection; label: string }) {
  return (
    <div className="compare-place">
      <div className="eyebrow">{label}</div>
      <div className="place-name">{place.name}</div>
      <p className="place-region">{place.region}</p>
      {place.pm25 === null ? (
        <p className="reading-meta">Air data unavailable</p>
      ) : (
        <>
          <div className="compare-value">{place.pm25}</div>
          <div className="reading-unit">µg/m³ · PM₂.₅</div>
          <p className="reading-meta">Sample data</p>
        </>
      )}
    </div>
  );
}
