export const AUDIENCES = ["Family", "School", "Community group"] as const;
export const TRAVEL_MODES = ["Drive", "Transit or carpool", "Walk or cycle", "Stay local"] as const;
export const PLAN_SECTIONS = ["Outdoor routine", "Indoor air", "Lower-emission travel"] as const;

export type PlanProfile = {
  audience: (typeof AUDIENCES)[number];
  travel: (typeof TRAVEL_MODES)[number];
  flexible: boolean;
  hasFilter: boolean;
};

export type PlanAction = { title: string; impact: string; source: "outdoor" | "indoor" | "travel" };
type ActionChoices = [PlanAction, ...PlanAction[]];

export const PLAN_SOURCES = {
  outdoor: {
    name: "AirNow activity guidance",
    url: "https://www.airnow.gov/publications/activity-guides/air-quality-and-outdoor-activity-guidance-for-schools/",
  },
  indoor: {
    name: "EPA indoor air guidance",
    url: "https://www.epa.gov/emergencies-iaq/wildfires-and-indoor-air-quality-iaq",
  },
  travel: {
    name: "EPA fuel-saving guidance",
    url: "https://www.epa.gov/greenvehicles/your-mileage-may-vary",
  },
} as const;

const REVIEWED_ACTIONS = {
  advisory: {
    title: "Check the local advisory before outdoor activity",
    impact:
      "An official update helps you decide whether to move strenuous plans indoors while current air data is unavailable.",
    source: "outdoor",
  },
  indoorActivity: {
    title: "Move vigorous activity to a cleaner indoor room",
    impact:
      "Moving games or exercise indoors reduces time in polluted outdoor air when the room has cleaner air.",
    source: "outdoor",
  },
  shortOuting: {
    title: "Keep essential outings brief and easy-paced",
    impact:
      "Spending less time outside and breathing less heavily can reduce how much polluted air you inhale.",
    source: "outdoor",
  },
  schoolActivity: {
    title: "Move outdoor practices and games indoors",
    impact:
      "An indoor venue with cleaner air reduces exposure during activities that make children breathe harder.",
    source: "outdoor",
  },
  groupActivity: {
    title: "Move the group activity to a cleaner indoor space",
    impact:
      "A shared indoor option reduces outdoor exposure for attendees, including those who are more sensitive to pollution.",
    source: "outdoor",
  },
  delayOutdoor: {
    title: "Postpone the outdoor session and check the next local update",
    impact:
      "Rescheduling gives you a chance to do the activity in cleaner air. A fresh local reading helps you choose when to resume.",
    source: "outdoor",
  },
  checkAgain: {
    title: "Recheck the air before a longer outdoor session",
    impact: "A fresh reading helps you decide whether to shorten the session or move it indoors.",
    source: "outdoor",
  },
  lightActivity: {
    title: "Keep longer outdoor activities light, with breaks",
    impact:
      "Shorter bouts and lighter effort can reduce exposure when air quality is unhealthy for sensitive groups.",
    source: "outdoor",
  },
  avoidIncense: {
    title: "Skip incense, candles, and indoor smoking",
    impact:
      "Avoiding indoor combustion removes sources of airborne particles where people spend time.",
    source: "indoor",
  },
  lowerSmokeCooking: {
    title: "Choose steaming or simmering instead of frying",
    impact: "A lower-smoke cooking method can reduce particles released into the room.",
    source: "indoor",
  },
  useFilter: {
    title: "Run your particle air cleaner in the room people use most",
    impact:
      "A correctly sized particle filter removes airborne particles from the room as air passes through it.",
    source: "indoor",
  },
  cleanerRoom: {
    title: "Set up one cleaner room for the group",
    impact:
      "Running an appropriately sized particle air cleaner and keeping smoke sources out reduces airborne particles where people gather.",
    source: "indoor",
  },
  skipSprays: {
    title: "Skip aerosol sprays in occupied rooms",
    impact: "Avoiding sprays reduces particles and irritants introduced into shared indoor air.",
    source: "indoor",
  },
  idling: {
    title: "Switch off the engine during safe, parked waits",
    impact: "Avoiding unnecessary idling saves fuel and cuts exhaust where people gather or wait.",
    source: "travel",
  },
  combine: {
    title: "Combine necessary errands into one trip",
    impact:
      "Replacing separate journeys can cut the distance driven, fuel used, and emissions from those trips.",
    source: "travel",
  },
  share: {
    title: "Use an existing transit trip or share the ride",
    impact:
      "When a shared journey replaces a solo car trip, it can reduce the number of vehicles making the trip.",
    source: "travel",
  },
  remote: {
    title: "Do a flexible errand remotely or postpone the trip",
    impact:
      "Skipping a vehicle journey avoids its tailpipe emissions and can reduce time spent in polluted outdoor air.",
    source: "travel",
  },
  active: {
    title: "Walk or cycle for a short trip when local air is suitable",
    impact:
      "Replacing a short drive avoids its tailpipe emissions. Check the current air before choosing an active route.",
    source: "travel",
  },
} satisfies Record<string, PlanAction>;

const actions = REVIEWED_ACTIONS;

export function planOptions(
  aqi: number | null,
  profile: PlanProfile,
): readonly [ActionChoices, ActionChoices, ActionChoices] {
  const indoorActivity =
    profile.audience === "School"
      ? actions.schoolActivity
      : profile.audience === "Community group"
        ? actions.groupActivity
        : actions.indoorActivity;
  const outdoor: ActionChoices =
    aqi === null
      ? [actions.advisory]
      : aqi > 150
        ? profile.flexible
          ? [indoorActivity, actions.delayOutdoor]
          : [actions.shortOuting, indoorActivity]
        : aqi > 100
          ? [profile.flexible ? actions.checkAgain : actions.lightActivity, indoorActivity]
          : [actions.checkAgain, actions.advisory];
  const indoorAlternative =
    profile.audience === "Family" ? actions.lowerSmokeCooking : actions.skipSprays;
  const indoor: ActionChoices = profile.hasFilter
    ? aqi !== null && aqi > 150
      ? [actions.useFilter, actions.cleanerRoom]
      : [actions.useFilter, actions.avoidIncense, indoorAlternative]
    : [actions.avoidIncense, indoorAlternative];
  const travel: ActionChoices =
    profile.travel === "Drive"
      ? [actions.combine, actions.idling, actions.share]
      : profile.travel === "Transit or carpool"
        ? [actions.combine, actions.share]
        : profile.travel === "Walk or cycle" && aqi !== null && aqi <= 100
          ? [actions.active, actions.combine]
          : [actions.remote, actions.share, actions.combine];
  return [outdoor, indoor, travel];
}

export function resolvePlan(
  options: ReturnType<typeof planOptions>,
  result: unknown,
): PlanAction[] | null {
  if (!Array.isArray(result) || result.length !== options.length) return null;
  const selected = options.map((choices, index) => {
    const choice: unknown = result[index];
    return typeof choice === "number" && Number.isInteger(choice) ? choices[choice] : undefined;
  });
  return selected.every((choice) => choice !== undefined) ? selected : null;
}
