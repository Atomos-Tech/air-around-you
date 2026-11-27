export const AIR_SOURCE = "https://open-meteo.com/en/docs/air-quality-api";
export const WEATHER_SOURCE = "https://open-meteo.com/en/docs";

export const WHO_ADVISORY = {
  name: "WHO air pollution guidance",
  url: "https://www.who.int/publications/i/item/WHO-EURO-2024-9115-48887-72806",
};

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

export function localAdvisory(countryCode: string | undefined) {
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
