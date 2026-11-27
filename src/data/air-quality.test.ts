import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchEnvironment, hasModeledFog, isDelayed } from "@/data/air-quality";
import { makePlace, modelCoordinate, searchPlaces } from "@/data/places";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("environment providers", () => {
  it("keeps precise device coordinates out of data requests and wraps the date line", () => {
    const place = makePlace({ latitude: 35.686257, longitude: 179.9724 }, 18);
    expect(place.longitude).toBeCloseTo(179.9724);
    expect(modelCoordinate(place)).toEqual({ latitude: 35.7, longitude: -180 });
  });

  it("uses model timestamps and preserves valid zeros without inventing missing fields", async () => {
    const fetchData = vi.fn(async (url: URL) => {
      const current = url.hostname.startsWith("air-quality")
        ? { time: "2026-11-27T10:00", pm2_5: 18.4, pm10: 25.8, ozone: 0, dust: 0 }
        : {
            time: "2026-11-27T10:15",
            wind_speed_10m: 0,
            wind_direction_10m: 90,
            cloud_cover: 0,
            weather_code: 48,
          };
      return Response.json({ current });
    });
    vi.stubGlobal("fetch", fetchData);
    const readings = await fetchEnvironment(
      { latitude: 35.7, longitude: 139.8 },
      new AbortController().signal,
    );

    expect(readings.air).toMatchObject({
      timestamp: Date.parse("2026-11-27T10:00Z"),
      pm25: 18.4,
      pm10: 25.8,
      ozone: 0,
      nitrogenDioxide: null,
      dust: 0,
      usAqi: null,
    });
    expect(readings.weather).toMatchObject({
      timestamp: Date.parse("2026-11-27T10:15Z"),
      windSpeed: 0,
      windFrom: 90,
      cloudCover: 0,
      code: 48,
    });
    expect(fetchData.mock.calls[0]?.[0].searchParams.get("domains")).toBe("cams_global");
    expect(hasModeledFog(readings.weather?.code)).toBe(true);
    expect(hasModeledFog(51)).toBe(false);
    expect(hasModeledFog(null)).toBe(false);
  });

  it("keeps weather available when the air feed fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) =>
        url.hostname.startsWith("air-quality")
          ? new Response(null, { status: 503 })
          : Response.json({ current: { time: "2026-11-27T10:15", cloud_cover: 43 } }),
      ),
    );
    const readings = await fetchEnvironment(
      { latitude: 28.6, longitude: 77.2 },
      new AbortController().signal,
    );
    expect(readings.air).toBeNull();
    expect(readings.weather?.cloudCover).toBe(43);
  });

  it("prefers the finer CAMS region and falls back when its PM₂.₅ field is absent", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-27T11:00Z"));
    let regionalPm25: number | null = 6;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) =>
        Response.json({
          current: {
            time: "2026-11-27T11:00",
            pm2_5: url.searchParams.get("domains") === "cams_europe" ? regionalPm25 : 17,
          },
        }),
      ),
    );
    const point = { latitude: 52.4, longitude: 4.9 };
    const signal = new AbortController().signal;
    expect((await fetchEnvironment(point, signal)).air).toMatchObject({
      model: "cams_europe",
      pm25: 6,
    });
    regionalPm25 = null;
    expect((await fetchEnvironment(point, signal)).air).toMatchObject({
      model: "cams_global",
      pm25: 17,
    });
  });

  it("uses a recent nearby CPCB station while keeping its measurement apart from model AQI", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-27T12:00Z"));
    const station = { latitude: 28.6, longitude: 77.2, pollutant: "PM2.5", avg: 164 };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        if (String(url).includes("snapdata.dev"))
          return Response.json({
            records: [
              null,
              { ...station, station: "Stale", updated_at: "2026-11-27T03:00Z" },
              { ...station, station: "Future", updated_at: "2026-11-27T13:00Z" },
              { ...station, station: "Non-reporting", avg: null, updated_at: "2026-11-27T11:00Z" },
              {
                ...station,
                station: "Outside area",
                latitude: 29,
                updated_at: "2026-11-27T11:00Z",
              },
              {
                ...station,
                station: "Qualifying station",
                latitude: 28.61,
                updated_at: "2026-11-27T11:00Z",
              },
            ],
          });
        return Response.json({ current: { time: "2026-11-27T12:00", pm2_5: 139, us_aqi: 198 } });
      }),
    );
    const result = await fetchEnvironment(
      { latitude: 28.6, longitude: 77.2 },
      new AbortController().signal,
    );
    expect(result.observation).toMatchObject({
      source: "cpcb",
      area: "Qualifying station",
      pm25: 164,
    });
    expect(result.air).toMatchObject({ model: "cams_global", pm25: 139, usAqi: 198 });
  });

  it("selects Singapore’s reporting region locally, without sending precise coordinates", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-27T12:00Z"));
    const request = vi.fn(async (url: string | URL) => {
      if (String(url).includes("api-open.data.gov.sg"))
        return Response.json({
          data: {
            regionMetadata: [
              { name: "unmapped", labelLocation: null },
              { name: "north", labelLocation: { latitude: 1.41803, longitude: 103.82 } },
              { name: "central", labelLocation: { latitude: 1.35735, longitude: 103.82 } },
            ],
            items: [
              {
                timestamp: "2026-11-27T19:00:00+08:00",
                readings: { pm25_one_hourly: { north: 18, central: 0 } },
              },
            ],
          },
        });
      return Response.json({ current: { time: "2026-11-27T12:00", pm2_5: 9 } });
    });
    vi.stubGlobal("fetch", request);
    const result = await fetchEnvironment(
      { latitude: 1.4, longitude: 103.8 },
      new AbortController().signal,
      { latitude: 1.3521, longitude: 103.8198 },
    );
    expect(result.observation).toMatchObject({
      source: "nea",
      area: "Singapore · central region",
      pm25: 0,
    });
    expect(request.mock.calls.map(([url]) => String(url)).join(" ")).not.toMatch(
      /1\.3521|103\.8198/,
    );
  });

  it("keeps valid AirNow readings when other rows have invalid units or missing station data", async () => {
    const station = {
      SiteName: "Downtown",
      PM25_Unit: "UG/M3",
      PM25: 0,
      Latitude: 40.7128,
      Longitude: -74.006,
      ValidTime: Date.now(),
    };
    const request = vi.fn(async (url: URL) => {
      if (url.hostname === "services.arcgis.com")
        return Response.json({
          features: [
            { attributes: null },
            { attributes: { ...station, PM25_Unit: "PPM" } },
            { attributes: station },
          ],
        });
      return Response.json({ current: { time: "2026-11-27T12:00", pm2_5: 9 } });
    });
    vi.stubGlobal("fetch", request);
    const result = await fetchEnvironment(
      { latitude: 40.712851, longitude: -74.006128 },
      new AbortController().signal,
    );
    expect(result.observation).toMatchObject({ source: "airnow", area: "Downtown", pm25: 0 });
    const urls = request.mock.calls.map(([url]) => url);
    expect(urls.map(String).join(" ")).not.toMatch(/40\.712851|-74\.006128/);
    const geometry = urls
      .find((url) => url.hostname === "services.arcgis.com")
      ?.searchParams.get("geometry");
    if (!geometry) throw new Error("AirNow request is missing its search area");
    const [west, south, east, north] = geometry.split(",").map(Number);
    if (west === undefined || south === undefined || east === undefined || north === undefined) {
      throw new Error("AirNow requires four bounding coordinates");
    }
    expect((west + east) / 2).toBeCloseTo(-74.0, 3);
    expect((south + north) / 2).toBeCloseTo(40.7, 3);
  });
});

it("retains usable worldwide search results when the geocoder returns malformed rows", async () => {
  const city = {
    id: 123,
    name: "Example city",
    latitude: 0,
    longitude: 180,
    country_code: "GB",
    country: "United Kingdom",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        results: [
          null,
          { ...city, latitude: 91 },
          { ...city, id: undefined },
          { ...city, name: {} },
          city,
        ],
      }),
    ),
  );
  expect(await searchPlaces("Example", new AbortController().signal)).toEqual([
    {
      id: "123",
      name: "Example city",
      latitude: 0,
      longitude: 180,
      countryCode: "GB",
      region: "United Kingdom",
    },
  ]);
});

describe("model freshness", () => {
  it("flags estimates older than two hours", () => {
    expect(isDelayed(Date.parse("2026-11-27T10:00Z"), Date.parse("2026-11-27T12:01Z"))).toBe(true);
  });
});
