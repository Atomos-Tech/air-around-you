const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const DEGREES = 180 / Math.PI;

export function solarLightPosition(time: Date): [number, number, number] {
  const year = time.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const yearLength = Date.UTC(year + 1, 0, 1) - yearStart;
  const elapsed = time.getTime() - yearStart;

  // NOAA's fractional-year approximation accounts for the season and apparent solar time.
  // https://gml.noaa.gov/grad/solcalc/solareqns.PDF
  const angle = (2 * Math.PI * (elapsed - DAY_MS / 2)) / yearLength;
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(angle) -
      0.032077 * Math.sin(angle) -
      0.014615 * Math.cos(2 * angle) -
      0.040849 * Math.sin(2 * angle));
  const latitude =
    0.006918 -
    0.399912 * Math.cos(angle) +
    0.070257 * Math.sin(angle) -
    0.006758 * Math.cos(2 * angle) +
    0.000907 * Math.sin(2 * angle) -
    0.002697 * Math.cos(3 * angle) +
    0.00148 * Math.sin(3 * angle);
  const utcMinutes = (elapsed % DAY_MS) / MINUTE_MS;
  const longitude = (180 - (utcMinutes + equationOfTime) / 4) / DEGREES;

  // MapLibre's globe uses east, north, and the prime meridian as its x, y, and z axes.
  // Its atmosphere shader reverses the light vector to get the direction toward the Sun.
  const x = Math.cos(latitude) * Math.sin(longitude);
  const y = Math.sin(latitude);
  const z = Math.cos(latitude) * Math.cos(longitude);
  const azimuth = (Math.atan2(-y, -x) * DEGREES + 270) % 360;
  const polar = Math.acos(-z) * DEGREES;
  return [1, azimuth, polar];
}
