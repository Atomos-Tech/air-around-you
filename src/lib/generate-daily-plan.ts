import { Wllama } from "@wllama/wllama";
import wasmUrl from "@wllama/wllama/esm/wasm/wllama.wasm?url";

import { PLAN_SECTIONS, planOptions, resolvePlan, type PlanProfile } from "@/data/daily-plan";

const MODEL_URL =
  "https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/09816acd5d99df7be770d85ea30822623dab342c/SmolLM2-135M-Instruct-Q4_K_S.gguf";

export async function generateDailyPlan(
  aqi: number | null,
  profile: PlanProfile,
  signal: AbortSignal,
  reportProgress: (progress: number | null) => void,
) {
  const runtime = new Wllama({ default: wasmUrl }, { suppressNativeLog: true, allowOffline: true });
  const options = planOptions(aqi, profile);
  try {
    await runtime.loadModelFromUrl(MODEL_URL, {
      n_ctx: 1024,
      n_threads: 1,
      n_gpu_layers: 0,
      signal,
      progressCallback: ({ loaded, total }) => reportProgress(total > 0 ? loaded / total : null),
    });
    signal.throwIfAborted();
    reportProgress(null);

    // The model produces one choice per section. A grammar and bounds check restrict
    // the result to actions already reviewed for these air conditions and preferences.
    const alternatives = options.map(
      (choices, index) =>
        `choice${index} ::= ${choices.map((_, choice) => `"${choice}"`).join(" | ")}`,
    );
    const grammar = ['root ::= "[" choice0 "," choice1 "," choice2 "]"', ...alternatives].join(
      "\n",
    );
    const completion = await runtime.createChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "Plan a day with lower air pollution exposure and travel emissions. Select one numbered action per section. Prefer practical steps for the user's routine and resources. Reply with three numbers in a JSON array in the listed section order.",
        },
        {
          role: "user",
          content: JSON.stringify({
            modeledUsAqi: aqi,
            ...profile,
            sections: Object.fromEntries(
              options.map((choices, index) => [
                PLAN_SECTIONS[index],
                choices.map(({ title, impact }) => `${title}. ${impact}`),
              ]),
            ),
          }),
        },
      ],
      grammar,
      temperature: 0,
      max_tokens: 18,
      abortSignal: signal,
    });
    signal.throwIfAborted();
    const content = completion.choices[0]?.message.content;
    if (typeof content !== "string") throw new Error("No plan generated");
    const actions = resolvePlan(options, JSON.parse(content));
    if (!actions) throw new Error("Generated action was outside the reviewed options");
    return actions;
  } finally {
    await runtime.exit().catch(() => undefined);
  }
}
