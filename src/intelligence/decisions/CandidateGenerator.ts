import { 
  CurrentSituation, 
  ActionCandidate, 
  Evidence, 
  ConfidenceBreakdown 
} from './types.js';

export class CandidateGenerator {
  /**
   * Helper to compute consistent candidate rank score
   */
  private computeScore(urgency: number, importance: number, confidence: number, sensitivity = 1.0): number {
    const raw = (urgency * 0.40) + (importance * 0.40) + (confidence * 0.20);
    return Number(Math.min(1.0, Math.max(0.0, raw * sensitivity)).toFixed(3));
  }

  generateCandidates(situation: CurrentSituation): ActionCandidate[] {
    const candidates: ActionCandidate[] = [];
    const now = new Date(situation.timestamp);
    const learnedBufferOffset = situation.userPreferences?.departureBufferOffsetMin || 0;
    const sensitivities = situation.userPreferences?.categorySensitivity || {};

    // 1. Candidate: LEAVE for imminent calendar event
    if (situation.nextEvent) {
      const event = situation.nextEvent;
      const eventStart = new Date(event.startTime);
      const minutesUntil = Math.round((eventStart.getTime() - now.getTime()) / 60000);

      const travelMin = event.travelMinutes || 25;
      const prepMin = event.prepMinutes || 10;
      const bufferMin = Math.max(5, 10 + learnedBufferOffset);
      const totalLeadTimeMin = travelMin + prepMin + bufferMin;
      const minutesUntilLeave = minutesUntil - totalLeadTimeMin;

      // Check if already at destination
      const isAlreadyThere = situation.location.place && event.location?.name && 
        situation.location.place.toLowerCase().includes(event.location.name.toLowerCase());

      if (!isAlreadyThere && minutesUntil > 0 && minutesUntil <= 240) {
        let urgency = 0.45;
        if (minutesUntilLeave <= 0) urgency = 0.98;
        else if (minutesUntilLeave <= 15) urgency = 0.90;
        else if (minutesUntilLeave <= 45) urgency = 0.75;

        const importance = 0.92;
        const confidenceBreakdown: ConfidenceBreakdown = {
          calendar: 0.98,
          location: situation.location.confidence || 0.90,
          travel: 0.85,
          preparation: 0.80,
          userPattern: 0.75,
          overall: 0.88,
        };

        const leaveByTime = new Date(eventStart.getTime() - totalLeadTimeMin * 60000);
        const commuteSens = sensitivities['COMMUTE'] || 1.0;

        const evidence: Evidence[] = [
          {
            source: 'CALENDAR',
            title: event.title,
            detail: `Scheduled for ${eventStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            confidence: 0.98,
          },
          {
            source: 'LOCATION',
            title: `Origin: ${situation.location.place || 'Current Location'}`,
            detail: `Destination: ${event.location?.name || 'Destination'}`,
            confidence: situation.location.confidence || 0.90,
          },
          {
            source: 'TRAVEL',
            title: `${travelMin} min estimated transit time`,
            detail: `Mode: ${situation.activity.type === 'DRIVING' ? 'In transit' : 'Driving'}`,
            confidence: 0.85,
          },
          {
            source: 'PREPARATION',
            title: `${prepMin} min prep + ${bufferMin} min buffer`,
            detail: learnedBufferOffset !== 0 ? `Adjusted by feedback (${learnedBufferOffset > 0 ? '+' : ''}${learnedBufferOffset}m)` : 'Safety margin',
            confidence: 0.80,
          }
        ];

        candidates.push({
          id: 'candidate_leave_' + event.id,
          type: 'LEAVE',
          category: 'COMMUTE',
          title: `Leave by ${leaveByTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} for ${event.title}`,
          summary: minutesUntilLeave <= 0 
            ? `You should leave immediately to arrive comfortably at ${event.location?.name || 'your destination'}.` 
            : `Start getting ready. ${travelMin} min travel + ${prepMin} min prep time.`,
          urgency,
          importance,
          confidence: confidenceBreakdown.overall,
          confidenceBreakdown,
          score: this.computeScore(urgency, importance, confidenceBreakdown.overall, commuteSens),
          timing: {
            recommendedAt: leaveByTime.toISOString(),
            deadline: eventStart.toISOString(),
            travelMinutes: travelMin,
            prepMinutes: prepMin,
            bufferMinutes: bufferMin,
          },
          evidence,
          actionSurfaces: [
            { type: 'NAVIGATION', label: 'Start Navigation', intent: 'MAPS_NAVIGATION' },
            { type: 'CONFIRM', label: "I'm on my way" },
            { type: 'SNOOZE', label: 'Snooze 5m' }
          ]
        });
      }
    }

    // 2. Candidate: Schedule Conflict Resolution
    if (situation.nextEvent && situation.conflictingEvent) {
      const e1 = situation.nextEvent;
      const e2 = situation.conflictingEvent;
      const urgency = 0.85;
      const importance = 0.90;
      const confidence = 0.94;

      const evidence: Evidence[] = [
        {
          source: 'CALENDAR',
          title: `Overlap: ${e1.title} & ${e2.title}`,
          detail: 'Insufficient travel buffer between back-to-back commitments.',
          confidence: 0.95,
        }
      ];

      candidates.push({
        id: 'candidate_conflict_' + e1.id + '_' + e2.id,
        type: 'RESOLVE_CONFLICT',
        category: 'SCHEDULE',
        title: `Schedule Conflict: ${e1.title} and ${e2.title}`,
        summary: 'Back-to-back events overlap with transit time. Consider rescheduling.',
        urgency,
        importance,
        confidence,
        confidenceBreakdown: {
          calendar: 0.98,
          location: 0.85,
          travel: 0.90,
          preparation: 0.80,
          userPattern: 0.70,
          overall: confidence,
        },
        score: this.computeScore(urgency, importance, confidence, sensitivities['SCHEDULE'] || 1.0),
        evidence,
        actionSurfaces: [
          { type: 'RESCHEDULE', label: 'See Reschedule Options' },
          { type: 'DISMISS', label: 'Keep as is' }
        ]
      });
    }

    // 3. Candidate: Document preparation (BRING) - Data Driven from requiredDocuments or inferred
    const isDocEvent = situation.nextEvent && (
      (situation.nextEvent.requiredDocuments && situation.nextEvent.requiredDocuments.length > 0) ||
      situation.nextEvent.title.toLowerCase().includes('doctor') ||
      situation.nextEvent.title.toLowerCase().includes('hospital') ||
      situation.nextEvent.title.toLowerCase().includes('flight')
    );

    if (situation.nextEvent && isDocEvent) {
      const docNames = (situation.nextEvent.requiredDocuments && situation.nextEvent.requiredDocuments.length > 0)
        ? situation.nextEvent.requiredDocuments.map(d => d.name).join(', ')
        : (situation.nextEvent.title.toLowerCase().includes('flight') ? 'Passport & Boarding Pass' : 'Health Insurance Card & Lab Reports');
      const urgency = 0.65;
      const importance = 0.85;
      const confidence = 0.92;
      const healthSens = sensitivities['HEALTHCARE'] || 1.1;

      const evidence: Evidence[] = [
        {
          source: 'PREPARATION',
          title: `Associated Documents: ${docNames}`,
          detail: `Required for upcoming ${situation.nextEvent.title}.`,
          confidence: 0.94,
        }
      ];

      candidates.push({
        id: 'candidate_bring_docs_' + situation.nextEvent.id,
        type: 'BRING',
        category: 'PREPARATION',
        title: `Bring ${docNames}`,
        summary: `Associated with your upcoming ${situation.nextEvent.title}.`,
        urgency,
        importance,
        confidence,
        confidenceBreakdown: {
          calendar: 0.95,
          location: 0.90,
          travel: 0.80,
          preparation: 0.95,
          userPattern: 0.85,
          overall: confidence,
        },
        score: this.computeScore(urgency, importance, confidence, healthSens),
        evidence,
        actionSurfaces: [
          { type: 'VIEW_DOC', label: 'View Documents Offline' },
          { type: 'CHECK', label: 'Already Packed' }
        ]
      });
    }

    // 4. Candidate: Data-Driven Notifications (REMIND / RESPOND)
    for (const notif of situation.recentNotifications) {
      const isFin = notif.category === 'FINANCIAL';
      const urgency = isFin ? 0.72 : 0.55;
      const importance = isFin ? 0.82 : 0.60;
      const confidence = 0.95;
      const sens = sensitivities[notif.category] || (isFin ? 1.0 : 0.8);

      const evidence: Evidence[] = [
        {
          source: 'NOTIFICATION',
          title: notif.title,
          detail: notif.text,
          confidence: 0.96,
        }
      ];

      candidates.push({
        id: 'candidate_notif_' + notif.id,
        type: isFin ? 'REMIND' : 'FOLLOW_UP',
        category: notif.category,
        title: isFin && notif.amount ? `Pay ${notif.title} (₹${notif.amount})` : notif.title,
        summary: notif.text,
        urgency,
        importance,
        confidence,
        confidenceBreakdown: {
          calendar: 0.70,
          location: 0.80,
          travel: 0.50,
          preparation: 0.80,
          userPattern: 0.90,
          overall: confidence,
        },
        score: this.computeScore(urgency, importance, confidence, sens),
        evidence,
        actionSurfaces: isFin ? [
          { type: 'PAY', label: 'Pay Now' },
          { type: 'ADD_TASK', label: 'Add to Tasks' },
          { type: 'DISMISS', label: 'Dismiss' }
        ] : [
          { type: 'ACK', label: 'Acknowledge' },
          { type: 'DISMISS', label: 'Dismiss' }
        ]
      });
    }

    // 5. Candidate: Data-Driven Pending Tasks
    for (const task of situation.pendingTasks.filter(t => !t.completed && (t.priority === 'high' || t.category === 'MUST_DO'))) {
      const urgency = task.priority === 'high' ? 0.70 : 0.50;
      const importance = 0.78;
      const confidence = 0.90;

      candidates.push({
        id: 'candidate_task_' + task.id,
        type: 'PREPARE',
        category: 'TASK',
        title: task.title,
        summary: task.eventContext ? `Priority task for ${task.eventContext}` : 'High priority pending task',
        urgency,
        importance,
        confidence,
        confidenceBreakdown: {
          calendar: 0.80,
          location: 0.80,
          travel: 0.60,
          preparation: 0.90,
          userPattern: 0.85,
          overall: confidence,
        },
        score: this.computeScore(urgency, importance, confidence, sensitivities['TASK'] || 1.0),
        evidence: [
          {
            source: 'TASK',
            title: task.title,
            detail: task.eventContext || 'Important contextual task',
            confidence: 0.95,
          }
        ],
        actionSurfaces: [
          { type: 'DONE', label: 'Mark Complete' },
          { type: 'SNOOZE', label: 'Later' }
        ]
      });
    }

    // 6. Always include Quiet State: NO_ACTION
    candidates.push({
      id: 'candidate_no_action',
      type: 'NO_ACTION',
      category: 'GENERAL',
      title: 'Nothing else needs your attention right now',
      summary: 'You are on track with all current commitments. LifeOS is passively monitoring.',
      urgency: 0.1,
      importance: 0.2,
      confidence: 0.99,
      confidenceBreakdown: {
        calendar: 0.99,
        location: 0.99,
        travel: 0.99,
        preparation: 0.99,
        userPattern: 0.99,
        overall: 0.99,
      },
      score: this.computeScore(0.1, 0.2, 0.99),
      evidence: [
        {
          source: 'PATTERN',
          title: 'Schedule Feasible',
          detail: 'No pending critical deadlines or immediate departure requirements.',
          confidence: 0.99,
        }
      ],
      actionSurfaces: []
    });

    // Rank candidates by composite score descending
    return candidates.sort((a, b) => b.score - a.score);
  }
}
