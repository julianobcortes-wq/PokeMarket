export type IndexDecision = {
  published: false;
  reason: "insufficient_constituents" | "no_prior_period";
  constituents: number;
  required: number;
};

/**
 * An index level is published only with enough constituents that also have a prior
 * comparable value. The function never invents a point level.
 */
export function decideIndexPublication(input: {
  constituentsWithCurrentEstimate: number;
  constituentsWithPriorPeriod: number;
  minConstituents: number;
}): IndexDecision | { published: true; constituents: number } {
  if (input.constituentsWithCurrentEstimate < input.minConstituents) {
    return {
      published: false,
      reason: "insufficient_constituents",
      constituents: input.constituentsWithCurrentEstimate,
      required: input.minConstituents,
    };
  }
  if (input.constituentsWithPriorPeriod < input.minConstituents) {
    return {
      published: false,
      reason: "no_prior_period",
      constituents: input.constituentsWithPriorPeriod,
      required: input.minConstituents,
    };
  }
  return { published: true, constituents: input.constituentsWithCurrentEstimate };
}
