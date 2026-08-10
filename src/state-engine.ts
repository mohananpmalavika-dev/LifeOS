import { SensorState } from "./types.js";

export function initialSensorState(): SensorState {
  return {
    batteryLevel: 0.9,
    focusState: "idle",
    motionState: "stationary",
    location: {},
    lastUpdated: new Date().toISOString(),
  };
}

export function updateSensorState(
  previous: SensorState,
  updates: Partial<SensorState>,
): SensorState {
  return {
    ...previous,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };
}

export function shouldScheduleModelEvaluation(state: SensorState): boolean {
  if (state.batteryLevel < 0.2) {
    return false;
  }

  if (state.focusState === "focused" && state.motionState === "driving") {
    return false;
  }

  return true;
}
