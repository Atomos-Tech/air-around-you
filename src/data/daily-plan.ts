export const AUDIENCES = ["Family", "School", "Community group"] as const;
export const TRAVEL_MODES = ["Drive", "Transit or carpool", "Walk or cycle", "Stay local"] as const;

export type PlanProfile = {
  audience: (typeof AUDIENCES)[number];
  travel: (typeof TRAVEL_MODES)[number];
  flexible: boolean;
  hasFilter: boolean;
};

export const PLAN_SOURCES = {
  outdoor: {
    section: "Outdoor routine",
    name: "AirNow activity guidance",
    url: "https://www.airnow.gov/publications/activity-guides/air-quality-and-outdoor-activity-guidance-for-schools/",
  },
  indoor: {
    section: "Indoor air",
    name: "EPA indoor air guidance",
    url: "https://www.epa.gov/emergencies-iaq/wildfires-and-indoor-air-quality-iaq",
  },
  travel: {
    section: "Lower-emission travel",
    name: "EPA fuel-saving guidance",
    url: "https://www.epa.gov/greenvehicles/your-mileage-may-vary",
  },
} as const;

type Section = keyof typeof PLAN_SOURCES;
export type PlanAction<S extends Section = Section> = { title: string; impact: string; source: S };
type ActionChoices<S extends Section> = [PlanAction<S>, ...PlanAction<S>[]];

const actions = {
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

const indoorActivityByAudience = {
  Family: actions.indoorActivity,
  School: actions.schoolActivity,
  "Community group": actions.groupActivity,
} satisfies Record<PlanProfile["audience"], PlanAction>;

function outdoorOptions(
  aqi: number | null,
  { audience, flexible }: PlanProfile,
): ActionChoices<"outdoor"> {
  if (aqi === null) return [actions.advisory];
  const indoorActivity = indoorActivityByAudience[audience];
  if (aqi > 150) {
    return flexible
      ? [indoorActivity, actions.delayOutdoor]
      : [actions.shortOuting, indoorActivity];
  }
  if (aqi > 100) return [flexible ? actions.checkAgain : actions.lightActivity, indoorActivity];
  return [actions.checkAgain, actions.advisory];
}

function indoorOptions(
  aqi: number | null,
  { audience, hasFilter }: PlanProfile,
): ActionChoices<"indoor"> {
  const alternative = audience === "Family" ? actions.lowerSmokeCooking : actions.skipSprays;
  if (!hasFilter) return [actions.avoidIncense, alternative];
  if (aqi !== null && aqi > 150) return [actions.useFilter, actions.cleanerRoom];
  return [actions.useFilter, actions.avoidIncense, alternative];
}

function travelOptions(aqi: number | null, mode: PlanProfile["travel"]): ActionChoices<"travel"> {
  switch (mode) {
    case "Drive":
      return [actions.combine, actions.idling, actions.share];
    case "Transit or carpool":
      return [actions.combine, actions.share];
    case "Walk or cycle":
      if (aqi !== null && aqi <= 100) return [actions.active, actions.combine];
      return [actions.remote, actions.share, actions.combine];
    case "Stay local":
      return [actions.remote, actions.share, actions.combine];
  }
}

// The first choice supplies the quick plan. AI selection uses the same ordered choices.
export function planOptions(
  aqi: number | null,
  profile: PlanProfile,
): readonly [
  outdoor: ActionChoices<"outdoor">,
  indoor: ActionChoices<"indoor">,
  travel: ActionChoices<"travel">,
] {
  return [
    outdoorOptions(aqi, profile),
    indoorOptions(aqi, profile),
    travelOptions(aqi, profile.travel),
  ];
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
