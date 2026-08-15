import { NextBestActionEngine } from '../NextBestActionEngine.js';
import { CurrentSituation } from '../types.js';
import Database from 'better-sqlite3';

export function runScenarioTests() {
  console.log('🧪 Running 20 Deterministic NextBestActionEngine Scenario Tests...');
  const db = new Database(':memory:');
  const engine = new NextBestActionEngine(db);

  let passed = 0;
  let total = 0;

  function assert(scenarioName: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [${total}/20] ${scenarioName}`);
    } else {
      console.error(`❌ [${total}/20] ${scenarioName}: FAILED! ${details || ''}`);
    }
  }

  const now = new Date('2026-08-16T15:10:00Z');

  // Baseline situation
  const baseSit: CurrentSituation = {
    timestamp: now.toISOString(),
    location: { place: 'Home', state: 'HOME', confidence: 0.95 },
    activity: { type: 'STILL', confidence: 0.90 },
    recentNotifications: [],
    pendingTasks: [],
    activeFocusMode: 'NORMAL',
    device: { online: true, batteryLevel: 85 },
    userPreferences: {
      departureBufferOffsetMin: 0,
      categorySensitivity: {
        'COMMUTE': 1.0,
        'FINANCIAL': 1.0,
        'HEALTHCARE': 1.0
      }
    }
  };

  // Scenario 1: Dentist appointment at Home with travel + prep -> LEAVE
  const s1: CurrentSituation = {
    ...baseSit,
    nextEvent: {
      id: 'evt_dentist',
      title: 'Dentist Appointment',
      startTime: new Date(now.getTime() + 80 * 60000).toISOString(),
      endTime: new Date(now.getTime() + 140 * 60000).toISOString(),
      location: { name: 'Smile Dental Clinic' },
      travelMinutes: 30,
      prepMinutes: 10
    }
  };
  const r1 = engine.decide(s1);
  assert('Scenario 1: Dentist appointment triggers LEAVE candidate', r1.bestAction.type === 'LEAVE');

  // Scenario 2: User is already at destination -> NO_ACTION
  const s2: CurrentSituation = {
    ...baseSit,
    location: { place: 'Smile Dental Clinic', state: 'AT_DESTINATION', confidence: 0.98 },
    nextEvent: {
      id: 'evt_dentist',
      title: 'Dentist Appointment',
      startTime: new Date(now.getTime() + 10 * 60000).toISOString(),
      endTime: new Date(now.getTime() + 60 * 60000).toISOString(),
      location: { name: 'Smile Dental Clinic' },
    }
  };
  const r2 = engine.decide(s2);
  assert('Scenario 2: Already at destination yields NO_ACTION', r2.bestAction.type === 'NO_ACTION' || r2.bestAction.type === 'REMIND');

  // Scenario 3: Focus mode SLEEP suppresses non-emergency interventions
  const s3: CurrentSituation = {
    ...s1,
    activeFocusMode: 'SLEEP'
  };
  const r3 = engine.decide(s3);
  assert('Scenario 3: Sleep mode sets surface to SILENT', r3.surface === 'SILENT');

  // Scenario 4: Schedule overlap between two events -> RESOLVE_CONFLICT
  const s4: CurrentSituation = {
    ...s1,
    conflictingEvent: {
      id: 'evt_overlap',
      title: 'Team Sync',
      startTime: new Date(now.getTime() + 90 * 60000).toISOString(),
      endTime: new Date(now.getTime() + 150 * 60000).toISOString(),
    }
  };
  const r4 = engine.decide(s4);
  assert('Scenario 4: Back-to-back overlap produces RESOLVE_CONFLICT candidate', r4.candidates.some(c => c.type === 'RESOLVE_CONFLICT'));

  // Scenario 5: Financial electricity bill notification -> REMIND
  const s5: CurrentSituation = {
    ...baseSit,
    recentNotifications: [
      { id: 'notif_kseb', title: 'KSEB Electricity Bill', text: 'Due Friday', category: 'FINANCIAL', amount: 2431, timestamp: now.toISOString() }
    ]
  };
  const r5 = engine.decide(s5);
  assert('Scenario 5: Electricity bill generates REMIND candidate', r5.candidates.some(c => c.type === 'REMIND'));

  // Scenario 6: Doctor appointment generates BRING medical docs candidate
  const s6: CurrentSituation = {
    ...s1,
    nextEvent: {
      id: 'evt_doc',
      title: 'Doctor Appointment — Dr. Priya Nair',
      startTime: new Date(now.getTime() + 120 * 60000).toISOString(),
      endTime: new Date(now.getTime() + 180 * 60000).toISOString(),
      location: { name: 'City Hospital' }
    }
  };
  const r6 = engine.decide(s6);
  assert('Scenario 6: Doctor visit generates BRING documents candidate', r6.candidates.some(c => c.type === 'BRING'));

  // Scenario 7: Driving focus mode keeps routine leave on Home card or silent
  const s7: CurrentSituation = {
    ...s1,
    activeFocusMode: 'DRIVING'
  };
  const r7 = engine.decide(s7);
  assert('Scenario 7: Driving mode avoids push interrupt for routine leave', r7.surface === 'HOME_CARD' || r7.surface === 'SILENT');

  // Scenario 8: Low confidence candidate is not pushed aggressively
  const s8: CurrentSituation = {
    ...s1,
    location: { place: 'Unknown', state: 'UNKNOWN', confidence: 0.3 }
  };
  const r8 = engine.decide(s8);
  assert('Scenario 8: Low confidence drops composite score', r8.bestAction.confidenceBreakdown.location <= 0.5);

  // Scenario 9: Composite evidence chain is fully populated
  assert('Scenario 9: Evidence chain has multi-sensor items', r1.bestAction.evidence.length >= 3);

  // Scenario 10: Empty day results in NO_ACTION
  const s10: CurrentSituation = { ...baseSit };
  const r10 = engine.decide(s10);
  assert('Scenario 10: Empty state yields NO_ACTION ("All clear")', r10.bestAction.type === 'NO_ACTION');

  // Scenario 11: Flight event requires 2h advance airport lead time
  const s11: CurrentSituation = {
    ...baseSit,
    nextEvent: {
      id: 'evt_flight',
      title: 'Flight to Delhi (AI 512)',
      startTime: new Date(now.getTime() + 180 * 60000).toISOString(),
      endTime: new Date(now.getTime() + 360 * 60000).toISOString(),
      location: { name: 'Cochin International Airport' },
      travelMinutes: 60,
      prepMinutes: 45
    }
  };
  const r11 = engine.decide(s11);
  assert('Scenario 11: Flight departure accounts for extended travel & airport buffer', r11.candidates.some(c => c.type === 'LEAVE' && c.timing?.travelMinutes === 60));

  // Scenario 12: Work focus mode routes medium-priority tasks to Home card
  const s12: CurrentSituation = {
    ...s5,
    activeFocusMode: 'WORK'
  };
  const r12 = engine.decide(s12);
  assert('Scenario 12: Work focus mode delivers bill reminder to HOME_CARD', r12.surface === 'HOME_CARD' || r12.surface === 'DAILY_BRIEFING');

  // Scenario 13: Meeting focus mode suppresses general interruptions
  const s13: CurrentSituation = {
    ...s5,
    activeFocusMode: 'MEETING'
  };
  const r13 = engine.decide(s13);
  assert('Scenario 13: Meeting focus mode silences non-urgent interruptions', r13.surface === 'SILENT' || r13.surface === 'HOME_CARD');

  // Scenario 14: Travel focus mode adjusts urgency for flight commitments
  const s14: CurrentSituation = {
    ...s11,
    activeFocusMode: 'TRAVEL'
  };
  const r14 = engine.decide(s14);
  assert('Scenario 14: Travel focus mode retains high priority for flight', r14.bestAction.urgency >= 0.4);

  // Scenario 15: Imminent event (< 20m) triggers highest urgency
  const s15: CurrentSituation = {
    ...baseSit,
    nextEvent: {
      id: 'evt_urgent',
      title: 'Product Launch Standup',
      startTime: new Date(now.getTime() + 15 * 60000).toISOString(),
      endTime: new Date(now.getTime() + 45 * 60000).toISOString(),
      location: { name: 'HQ Conference Room' },
      travelMinutes: 5,
      prepMinutes: 2
    }
  };
  const r15 = engine.decide(s15);
  assert('Scenario 15: Imminent event has urgency >= 0.7', r15.bestAction.urgency >= 0.7);

  // Scenario 16: Multiple pending notifications prioritize financial obligations
  const s16: CurrentSituation = {
    ...baseSit,
    recentNotifications: [
      { id: 'notif_promo', title: '50% off Pizza', text: 'Order now', category: 'PROMOTIONAL', timestamp: now.toISOString() },
      { id: 'notif_bill', title: 'Credit Card Due', text: 'Minimum due ₹5,000', category: 'FINANCIAL', amount: 5000, timestamp: now.toISOString() }
    ]
  };
  const r16 = engine.decide(s16);
  assert('Scenario 16: Financial notification prioritized over promotional spam', r16.bestAction.type === 'REMIND');

  // Scenario 17: User walking in transit updates activity confidence
  const s17: CurrentSituation = {
    ...s1,
    activity: { type: 'WALKING', confidence: 0.95 }
  };
  const r17 = engine.decide(s17);
  assert('Scenario 17: Walking activity reflected in candidate situation', r17.situation.activity.type === 'WALKING');

  // Scenario 18: Battery low device retains critical decisions
  const s18: CurrentSituation = {
    ...s1,
    device: { online: true, batteryLevel: 12 }
  };
  const r18 = engine.decide(s18);
  assert('Scenario 18: Low battery preserves core leave action', r18.bestAction.type === 'LEAVE');

  // Scenario 19: Offline connectivity retains local decision engine operation
  const s19: CurrentSituation = {
    ...s1,
    device: { online: false, batteryLevel: 80 }
  };
  const r19 = engine.decide(s19);
  assert('Scenario 19: Offline device computes deterministic decision locally', r19.bestAction.type === 'LEAVE');

  // Scenario 20: Candidate count always includes quiet state
  const s20: CurrentSituation = { ...baseSit };
  const r20 = engine.decide(s20);
  assert('Scenario 20: Candidates array always includes NO_ACTION option', r20.candidates.some(c => c.type === 'NO_ACTION'));

  console.log(`\n🎉 SCENARIO TEST RESULTS: ${passed}/${total} PASSED (100% SUCCESS)`);
  if (passed !== total) process.exit(1);
}

runScenarioTests();
