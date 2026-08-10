import {
  ConfidenceWeights,
  Intervention,
  InterventionConfidence,
  NormalizedEvent,
  PenaltyFactors,
} from "./types.js";

// tuned weights: emphasize predicted intent and event urgency to boost true positives
const DEFAULT_WEIGHTS: ConfidenceWeights = {
  pIntent: 0.50,
  cState: 0.10,
  aHistorical: 0.05,
  eUrgency: 0.35,
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function calculateInterventionConfidence(
  subscores: ConfidenceWeights,
  penalties: PenaltyFactors,
  weights = DEFAULT_WEIGHTS,
): InterventionConfidence {
  const baseScore = clamp(
    Math.pow(subscores.pIntent, weights.pIntent) *
      Math.pow(subscores.cState, weights.cState) *
      Math.pow(subscores.aHistorical, weights.aHistorical) *
      Math.pow(subscores.eUrgency, weights.eUrgency),
  );

  const penaltyProduct = clamp(
    penalties.interruptibility * penalties.locationAccuracy * penalties.cooldown,
  );

  const finalScore = clamp(baseScore * penaltyProduct);

  return {
    baseScore,
    finalScore,
    weights,
    penalties,
  };
}

export function formatConfidenceDetails(confidence: InterventionConfidence): string {
  return `S_final = (${confidence.baseScore.toFixed(3)}) * (${(
    confidence.penalties.interruptibility *
    confidence.penalties.locationAccuracy *
    confidence.penalties.cooldown
  ).toFixed(3)}) = ${confidence.finalScore.toFixed(3)}`;
}

export function scoreIntervention(
  event: NormalizedEvent,
  baseMessage: string,
  confidence: InterventionConfidence,
): Intervention {
  return {
    id: `intervention:${event.id}`,
    title: "Context-aware intervention",
    summary: baseMessage,
    score: confidence.finalScore,
    reason: formatConfidenceDetails(confidence),
    surfaces: [
      {
        type: "notification",
        title: "Action recommended",
        description: baseMessage,
        trigger: "immediate",
      },
    ],
    createdAt: new Date().toISOString(),
  };
}
