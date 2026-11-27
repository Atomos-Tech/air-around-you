import { Clipboard, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { airCategory, formatTime, type AirReading } from "@/data/air-quality";
import {
  AUDIENCES,
  PLAN_SECTIONS,
  PLAN_SOURCES,
  TRAVEL_MODES,
  planOptions,
  type PlanAction,
  type PlanProfile,
} from "@/data/daily-plan";

const DEFAULT_PROFILE: PlanProfile = {
  audience: "Family",
  travel: "Drive",
  flexible: true,
  hasFilter: false,
};

type Props = {
  location: string;
  air: AirReading | null;
  loading: boolean;
  advisory?: { name: string; url: string } | null;
};

export default function DailyPlan({ location, air, loading, advisory }: Props) {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [generated, setGenerated] = useState<{ key: string; actions: PlanAction[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const running = useRef<AbortController | null>(null);
  const aqi = air?.usAqi ?? null;
  const key = JSON.stringify([aqi, profile]);
  const aiActions = generated?.key === key ? generated.actions : null;
  const actions = aiActions ?? planOptions(aqi, profile).map(([first]) => first);
  const basis =
    aqi === null
      ? "Current modeled AQI unavailable"
      : `${Math.round(aqi)} modeled US AQI · ${airCategory(aqi).label}`;

  useEffect(() => () => running.current?.abort(), []);

  async function generate() {
    if (running.current) return;
    const controller = new AbortController();
    running.current = controller;
    setBusy(true);
    setProgress(null);
    setStatus("");
    try {
      const { generateDailyPlan } = await import("@/lib/generate-daily-plan");
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)]);
      signal.throwIfAborted();
      const next = await generateDailyPlan(aqi, profile, signal, (value) => {
        if (!signal.aborted) setProgress(value);
      });
      if (!controller.signal.aborted) {
        setGenerated({ key, actions: next });
      }
    } catch {
      if (!controller.signal.aborted) {
        setStatus(
          "AI generation is unavailable on this device right now. Your quick plan is ready below.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      running.current = null;
    }
  }

  async function copyPlan() {
    const context = air ? `${basis} · ${formatTime(air.timestamp)}` : basis;
    const lines = [
      `Air Around You · ${location} · ${profile.audience}`,
      context,
      ...actions.map(
        (action, index) => `${PLAN_SECTIONS[index]} — ${action.title}. ${action.impact}`,
      ),
      ...(advisory ? [`${advisory.name} — ${advisory.url}`] : []),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setStatus("Plan copied.");
    } catch {
      setStatus("Clipboard access is unavailable.");
    }
  }

  function updateProfile(next: PlanProfile) {
    setProfile(next);
    setStatus("");
  }

  return (
    <>
      <p className="plan-context">
        {basis}
        {air && ` · ${formatTime(air.timestamp)}`}
      </p>
      <fieldset disabled={busy} className="plan-preferences">
        <legend>Make the plan fit your day</legend>
        <div className="plan-selects">
          <label>
            Planning for
            <select
              value={profile.audience}
              onChange={(event) => {
                const audience = AUDIENCES.find((choice) => choice === event.target.value);
                if (audience) updateProfile({ ...profile, audience });
              }}
            >
              {AUDIENCES.map((audience) => (
                <option key={audience}>{audience}</option>
              ))}
            </select>
          </label>
          <label>
            Getting around
            <select
              value={profile.travel}
              onChange={(event) => {
                const travel = TRAVEL_MODES.find((choice) => choice === event.target.value);
                if (travel) updateProfile({ ...profile, travel });
              }}
            >
              {TRAVEL_MODES.map((travel) => (
                <option key={travel}>{travel}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flexible-row">
          <label htmlFor="flexible-timing">Outdoor timing is flexible</label>
          <Switch
            id="flexible-timing"
            checked={profile.flexible}
            disabled={busy}
            onCheckedChange={(flexible) => updateProfile({ ...profile, flexible })}
          />
        </div>
        <div className="flexible-row">
          <label htmlFor="has-air-filter">An indoor air cleaner is available</label>
          <Switch
            id="has-air-filter"
            checked={profile.hasFilter}
            disabled={busy}
            onCheckedChange={(hasFilter) => updateProfile({ ...profile, hasFilter })}
          />
        </div>
      </fieldset>

      <div className="plan-actions">
        <button
          type="button"
          className="map-button map-button-primary"
          disabled={loading || busy || Boolean(aiActions)}
          onClick={() => void generate()}
        >
          <Sparkles aria-hidden="true" />{" "}
          {busy ? "Generating…" : aiActions ? "AI plan ready" : "Generate AI plan"}
        </button>
        <button
          type="button"
          className="map-button"
          disabled={busy}
          onClick={() => void copyPlan()}
        >
          <Clipboard aria-hidden="true" /> Copy plan
        </button>
      </div>
      <p className="reading-meta" role="status">
        {loading
          ? "Getting local air conditions…"
          : busy
            ? progress === null || progress >= 1
              ? "Preparing your plan on this device…"
              : `Downloading the AI model… ${Math.floor(progress * 100)}%`
            : status ||
              (!aiActions
                ? "AI runs on this device. First use downloads about 110 MB."
                : "AI selected the actions from published guidance.")}
      </p>

      <ul className="action-list" aria-label={aiActions ? "AI plan" : "Quick plan"}>
        {actions.map((action, index) => (
          <li key={PLAN_SECTIONS[index]}>
            <span>{PLAN_SECTIONS[index]}</span>
            <h3>{action.title}</h3>
            <p>{action.impact}</p>
            <a
              className="guidance-link"
              href={PLAN_SOURCES[action.source].url}
              target="_blank"
              rel="noreferrer"
            >
              {PLAN_SOURCES[action.source].name}
            </a>
          </li>
        ))}
      </ul>
      {advisory && (
        <a className="guidance-link" href={advisory.url} target="_blank" rel="noreferrer">
          {advisory.name}
        </a>
      )}
    </>
  );
}
