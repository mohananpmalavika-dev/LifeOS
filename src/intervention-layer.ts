import { ActionSurface, Intervention } from "./types.js";

export function buildInterventionSurfaces(intervention: Intervention): Intervention {
  const primarySurface: ActionSurface = {
    type: "notification",
    title: intervention.title,
    description: intervention.summary,
    trigger: "immediate",
  };

  const widgetSurface: ActionSurface = {
    type: "widget",
    title: "Context Tip",
    description: intervention.summary,
    trigger: "single_tap",
  };

  return {
    ...intervention,
    surfaces: [primarySurface, widgetSurface],
  };
}
