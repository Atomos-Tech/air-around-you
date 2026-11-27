import { formatTime, isDelayed, type AirReading } from "@/data/air-quality";
import { AIR_SOURCE } from "@/data/air-sources";

export default function AirModelCredit({ air }: { air: AirReading }) {
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
