import { 
  CurrentSituation, 
  ActionCandidate, 
  Evidence, 
  ConfidenceBreakdown 
} from './types.js';

export class CandidateGenerator {
  /**
   * Generates ranked candidate actions given a CurrentSituation
   */
  generateCandidates(situation: CurrentSituation, learnedBufferOffset = 0): ActionCandidate[] {
    const candidates: ActionCandidate[] = [];
    const now = new Date(situation.timestamp);

    // 1. Candidate: LEAVE for imminent calendar event
    if (situation.nextEvent) {
      const event = situation.nextEvent;
      const eventStart = new Date(event.startTime);
      const minutesUntil = Math.round((eventStart.getTime() - now.getTime()) / 60000);

      const travelMin = event.travelMinutes || 30;
      const prepMin = event.prepMinutes || 10;
      const bufferMin = Math.max(5, 10 + learnedBufferOffset);
      const totalLeadTimeMin = travelMin + prepMin + bufferMin;
      const minutesUntilLeave = minutesUntil - totalLeadTimeMin;

      // Check if user is already at the destination
      const isAlreadyThere = situation.location.place && event.location?.name && 
        situation.location.place.toLowerCase().includes(event.location.name.toLowerCase());

      if (!isAlreadyThere && minutesUntil > 0 && minutesUntil <= 180) {
        const urgency = minutesUntilLeave <= 15 ? 0.95 : minutesUntilLeave <= 45 ? 0.75 : 0.45;
        const confidenceBreakdown: ConfidenceBreakdown = {
          calendar: 0.98,
          location: situation.location.confidence || 0.9,
          travel: 0.85,
          preparation: 0.80,
          userPattern: 0.75,
          overall: 0.87,
        };

        const leaveByTime = new Date(eventStart.getTime() - totalLeadTimeMin * 60000);

        const evidence: Evidence[] = [
          {
            source: 'CALENDAR',
            title: event.title,
            detail: `Scheduled for ${eventStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            confidence: 0.98,
          },
          {
            source: 'LOCATION',
            title: `Currently at ${situation.location.place || 'Current Spot'}`,
            detail: `Destination: ${event.location?.name || 'Destination'}`,
            confidence: situation.location.confidence || 0.9,
          },
          {
            source: 'TRAVEL',
            title: `${travelMin} min travel estimate`,
            detail: `Driving transit route (${trafficDesc(situation.activity.type)})`,
            confidence: 0.85,
          },
          {
            source: 'PREPARATION',
            title: `${prepMin} min prep + ${bufferMin} min buffer`,
            detail: learnedBufferOffset !== 0 ? `Buffer adjusted by feedback (${learnedBufferOffset > 0 ? '+' : ''}${learnedBufferOffset}m)` : 'Standard safety margin',
            confidence: 0.80,
          }
        ];

        candidates.push({
          id: 'candidate_leave_' + event.id,
          type: 'LEAVE',
          title: `Leave by ${leaveByTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} for ${event.title}`,
          summary: minutesUntilLeave <= 0 
            ? `You should leave immediately to arrive on time at ${event.location?.name || 'your destination'}.` 
            : `Start getting ready now. ${travelMin} min travel + ${prepMin} min prep time.`,
          urgency,
          importance: 0.9,
          confidence: confidenceBreakdown.overall,
          confidenceBreakdown,
          score: Number((urgency * 0.45 + 0.9 * 0.35 + confidenceBreakdown.overall * 0.20).toFixed(2)),
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
      const evidence: Evidence[] = [
        {
          source: 'CALENDAR',
          title: `Overlap: ${e1.title} & ${e2.title}`,
          detail: 'Insufficient travel and preparation window between back-to-back commitments.',
          confidence: 0.95,
        }
      ];

      candidates.push({
        id: 'candidate_conflict_' + e1.id + '_' + e2.id,
        type: 'RESOLVE_CONFLICT',
        title: `Schedule Conflict: ${e1.title} and ${e2.title}`,
        summary: 'Back-to-back events overlap with transit time. Consider rescheduling.',
        urgency: 0.85,
        importance: 0.88,
        confidence: 0.92,
        confidenceBreakdown: {
          calendar: 0.98,
          location: 0.85,
          travel: 0.90,
          preparation: 0.80,
          userPattern: 0.70,
          overall: 0.92,
        },
        score: 0.87,
        evidence,
        actionSurfaces: [
          { type: 'RESCHEDULE', label: 'See Reschedule Options' },
          { type: 'DISMISS', label: 'Keep as is' }
        ]
      });
    }

    // 3. Candidate: Document preparation (BRING)
    if (situation.nextEvent && situation.nextEvent.title.toLowerCase().includes('doctor')) {
      const evidence: Evidence[] = [
        {
          source: 'PREPARATION',
          title: 'Health Insurance & Lab Reports',
          detail: 'Medical consultation requires physical or digital insurance card and recent test results.',
          confidence: 0.94,
        }
      ];

      candidates.push({
        id: 'candidate_bring_medical_docs',
        type: 'BRING',
        title: 'Bring Health Insurance Card & Lab Reports',
        summary: 'Associated with your upcoming Doctor Appointment.',
        urgency: 0.65,
        importance: 0.82,
        confidence: 0.91,
        confidenceBreakdown: {
          calendar: 0.95,
          location: 0.90,
          travel: 0.80,
          preparation: 0.95,
          userPattern: 0.85,
          overall: 0.91,
        },
        score: 0.76,
        evidence,
        actionSurfaces: [
          { type: 'VIEW_DOC', label: 'View Documents Offline' },
          { type: 'CHECK', label: 'Already Packed' }
        ]
      });
    }

    // 4. Candidate: Bill / Payment reminder (REMIND)
    const billNotif = situation.recentNotifications.find(n => 
      n.category === 'FINANCIAL' || n.title.toLowerCase().includes('bill') || n.text.toLowerCase().includes('due')
    );
    if (billNotif) {
      const evidence: Evidence[] = [
        {
          source: 'NOTIFICATION',
          title: billNotif.title,
          detail: billNotif.text,
          confidence: 0.96,
        }
      ];

      candidates.push({
        id: 'candidate_remind_' + billNotif.id,
        type: 'REMIND',
        title: `Pay ${billNotif.title} (${billNotif.amount ? `₹${billNotif.amount}` : 'Bill Due'})`,
        summary: `Due ${billNotif.dueDate || 'soon'}. Pay now to avoid late penalty.`,
        urgency: 0.70,
        importance: 0.80,
        confidence: 0.95,
        confidenceBreakdown: {
          calendar: 0.70,
          location: 0.80,
          travel: 0.50,
          preparation: 0.80,
          userPattern: 0.90,
          overall: 0.85,
        },
        score: 0.77,
        evidence,
        actionSurfaces: [
          { type: 'PAY', label: 'Pay Now' },
          { type: 'ADD_TASK', label: 'Add to Tasks' },
          { type: 'DISMISS', label: 'Dismiss' }
        ]
      });
    }

    // 5. Always include Candidate: NO_ACTION (Quiet State)
    candidates.push({
      id: 'candidate_no_action',
      type: 'NO_ACTION',
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
      score: 0.25,
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

function trafficDesc(activity: string) {
  if (activity === 'DRIVING') return 'in transit';
  return 'typical conditions';
}
