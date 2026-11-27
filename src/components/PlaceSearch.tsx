import { ChevronRight, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { searchPlaces, type PlaceSelection } from "@/data/places";
import { findLocalCities } from "@/data/cities";

export default function PlaceSearch({ onPick }: { onPick: (location: PlaceSelection) => void }) {
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
