import { ActionCandidate, CurrentSituation, InterventionSurface } from './types.js';

export class InterventionPolicy {
  /**
   * Determines the appropriate delivery surface based on focus mode, urgency, and confidence
   */
  evaluateSurface(candidate: ActionCandidate, situation: CurrentSituation): InterventionSurface {
    if (candidate.type === 'NO_ACTION') {
      return 'SILENT';
    }

    const { activeFocusMode } = situation;
    const { urgency, confidence } = candidate;

    // 1. SLEEP / Quiet Hours focus mode
    if (activeFocusMode === 'SLEEP') {
      // Only critical emergencies break through sleep
      if (urgency >= 0.95 && confidence >= 0.95) {
        return 'PUSH_NOTIFICATION';
      }
      return 'SILENT';
    }

    // 2. DRIVING focus mode
    if (activeFocusMode === 'DRIVING') {
      if (candidate.type === 'LEAVE') {
        // Already driving, keep it on Home or subtle
        return 'HOME_CARD';
      }
      if (urgency >= 0.90) {
        return 'PUSH_NOTIFICATION';
      }
      return 'SILENT';
    }

    // 3. MEETING focus mode
    if (activeFocusMode === 'MEETING') {
      if (urgency >= 0.90 && confidence >= 0.85) {
        return 'HOME_CARD';
      }
      return 'SILENT';
    }

    // 4. WORK focus mode
    if (activeFocusMode === 'WORK') {
      if (urgency >= 0.85 && confidence >= 0.85) {
        return 'PUSH_NOTIFICATION';
      }
      if (urgency >= 0.50 && confidence >= 0.65) {
        return 'HOME_CARD';
      }
      return 'DAILY_BRIEFING';
    }

    // 5. NORMAL / Default focus mode
    if (urgency >= 0.80 && confidence >= 0.80) {
      return 'PUSH_NOTIFICATION';
    }
    if (urgency >= 0.40 && confidence >= 0.60) {
      return 'HOME_CARD';
    }
    if (confidence >= 0.50) {
      return 'DAILY_BRIEFING';
    }

    return 'SILENT';
  }
}
