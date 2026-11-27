import { useEffect, useRef, useState } from "react";
import { airCategory, formatTime, type AirReading } from "@/data/air-quality";
import { PLAN_SECTIONS, planOptions, type PlanAction, type PlanProfile } from "@/data/daily-plan";

const DEFAULT_PROFILE: PlanProfile = {
  audience: "Family",
  travel: "Drive",
  flexible: true,
  hasFilter: false,
};

export type DailyPlanProps = {
  location: string;
  air: AirReading | null;
  loading: boolean;
  advisory?: { name: string; url: string } | null;
};

export function useDailyPlan({ location, air, advisory }: DailyPlanProps) {
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

  function statusMessage() {
    if (busy) {
      if (progress === null || progress >= 1) return "Preparing your plan on this device…";
      return `Downloading the AI model… ${Math.floor(progress * 100)}%`;
    }
    if (status) return status;
    return aiActions
      ? "AI selected the actions from published guidance."
      : "AI runs on this device. First use downloads about 110 MB.";
  }
  return {
    profile,
    updateProfile,
    busy,
    aiActions,
    actions,
    basis,
    generate,
    copyPlan,
    status: statusMessage(),
  };
}
