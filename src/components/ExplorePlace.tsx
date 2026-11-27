import { ArrowUpRight, House, X } from "lucide-react";
import { WORLD_CITIES } from "@/data/cities";
import { makePlace, type MapPoint, type PlaceSelection } from "@/data/places";

export function PinCard({
  pin,
  visit,
  cancel,
}: {
  pin: MapPoint;
  visit: (place: PlaceSelection) => void;
  cancel: () => void;
}) {
  return (
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
        <button type="button" className="icon-tool" aria-label="Cancel pin" onClick={cancel}>
          <X aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

export function ExploreIntro({
  home,
  visit,
  openSearch,
}: {
  home: PlaceSelection | null;
  visit: (place: PlaceSelection) => void;
  openSearch: () => void;
}) {
  return (
    <section className="intro">
      <h1>
        See the air
        <br />
        around you.
      </h1>
      <p>Fly to a place, see its outdoor air, and compare it with home.</p>
      <div className="card-actions">
        <button type="button" className="map-button map-button-primary" onClick={openSearch}>
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
  );
}
