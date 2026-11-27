import { Check, Clipboard, Sparkles } from "lucide-react";
import PlanSelect from "@/components/PlanSelect";
import { Switch } from "@/components/ui/switch";
import { formatTime } from "@/data/air-quality";
import { useDailyPlan, type DailyPlanProps } from "@/hooks/useDailyPlan";
import { AUDIENCES, PLAN_SECTIONS, PLAN_SOURCES, TRAVEL_MODES } from "@/data/daily-plan";

export default function DailyPlan(props: DailyPlanProps) {
  const { air, loading, advisory } = props;
  const { profile, updateProfile, busy, aiActions, actions, basis, generate, copyPlan, status } =
    useDailyPlan(props);
  return (
    <>
      <p className="plan-context" aria-live="polite">
        <strong>{loading ? "Getting local air conditions…" : basis}</strong>
        {air && (
          <time dateTime={new Date(air.timestamp).toISOString()}>{formatTime(air.timestamp)}</time>
        )}
      </p>
      <fieldset disabled={busy} className="plan-preferences">
        <legend>Make the plan fit your day</legend>
        <div className="plan-selects">
          <PlanSelect
            label="Planning for"
            options={AUDIENCES}
            value={profile.audience}
            disabled={busy}
            onChange={(audience) => updateProfile({ ...profile, audience })}
          />
          <PlanSelect
            label="Getting around"
            options={TRAVEL_MODES}
            value={profile.travel}
            disabled={busy}
            onChange={(travel) => updateProfile({ ...profile, travel })}
          />
        </div>
        <div className="plan-switches">
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
        </div>
      </fieldset>

      <div className="plan-actions">
        <button
          type="button"
          className="map-button map-button-primary"
          disabled={loading || busy || Boolean(aiActions)}
          onClick={() => void generate()}
        >
          {aiActions ? <Check aria-hidden="true" /> : <Sparkles aria-hidden="true" />}{" "}
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
      <p className="plan-status" role="status">
        {status}
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
