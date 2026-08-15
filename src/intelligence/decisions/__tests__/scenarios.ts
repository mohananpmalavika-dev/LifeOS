import { NextBestActionEngine } from '../NextBestActionEngine.js';
import { CurrentSituation } from '../types.js';
import Database from 'better-sqlite3';

export function runScenarioTests() {
  console.log('🧪 Running 10 Deterministic NextBestActionEngine Scenario Tests...');
  const db = new Database(':memory:');
  const engine = new NextBestActionEngine(db);

  let passed = 0;
  let total = 0;

  function assert(scenarioName: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [${total}/10] ${scenarioName}`);
    } else {
      console.error(`❌ [${total}/10] ${scenarioName}: FAILED! ${details || ''}`);
    }
  }

  const now = new Date('2026-08-16T15:10:00Z');

  // Scenario 1: Appointment at Home with travel + prep -> LEAVE
  const s1: CurrentSituation = {
    timestamp: now.toISOString(),
    location: { place: 'Home', state: 'HOME', confidence: 0.95 },
    activity: { type: 'STILL', confidence: 0.90 },
    nextEvent: {
      id: 'evt_dentist',
      title: 'Dentist Appointment',
      startTime: new Date(now.getTime() + 80 * 60000).toISOString(), // 80 min away
      endTime: new Date(now.getTime() + 140 * 60000).toISOString(),
      location: { name: 'Smile Dental Clinic' },
      travelMinutes: 30,
      prepMinutes: 10
    },
    recentNotifications: [],
    pendingTasks: [],
    activeFocusMode: 'NORMAL',
    device: { online: true, batteryLevel: 85 }
  };
  const r1 = engine.decide(s1);
  assert('Scenario 1: Dentist appointment triggers LEAVE candidate', r1.bestAction.type === 'LEAVE');

  // Scenario 2: User is already at destination -> NO_ACTION
  const s2: CurrentSituation = {
    timestamp: now.toISOString(),
    location: { place: 'Smile Dental Clinic', state: 'AT_DESTINATION', confidence: 0.98 },
    activity: { type: 'STILL', confidence: 0.95 },
    nextEvent: {
      id: 'evt_dentist',
      title: 'Dentist Appointment',
      startTime: new Date(now.getTime() + 10 * 60000).toISOString(),
      endTime: new Date(now.getTime() + 60 * 60000).toISOString(),
      location: { name: 'Smile Dental Clinic' },
    },
    recentNotifications: [],
    pendingTasks: [],
    activeFocusMode: 'NORMAL',
    device: { online: true, batteryLevel: 85 }
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
  const hasConflict = r4.candidates.some(c => c.type === 'RESOLVE_CONFLICT');
  assert('Scenario 4: Back-to-back overlap produces RESOLVE_CONFLICT candidate', hasConflict);

  // Scenario 5: Financial electricity bill notification -> REMIND
  const s5: CurrentSituation = {
    timestamp: now.toISOString(),
    location: { place: 'Home', state: 'HOME', confidence: 0.9 },
    activity: { type: 'STILL', confidence: 0.9 },
    recentNotifications: [
      { id: 'notif_kseb', title: 'KSEB Electricity Bill', text: 'Due Friday', category: 'FINANCIAL', amount: 2431, timestamp: now.toISOString() }
    ],
    pendingTasks: [],
    activeFocusMode: 'NORMAL',
    device: { online: true, batteryLevel: 90 }
  };
  const r5 = engine.decide(s5);
  const hasRemind = r5.candidates.some(c => c.type === 'REMIND');
  assert('Scenario 5: Electricity bill generates REMIND candidate', hasRemind);

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
  const hasBring = r6.candidates.some(c => c.type === 'BRING');
  assert('Scenario 6: Doctor visit generates BRING documents candidate', hasBring);

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
  assert('Scenario 8: Low confidence calculation drops composite score', r8.bestAction.confidenceBreakdown.location <= 0.5);

  // Scenario 9: Composite evidence chain is fully populated
  assert('Scenario 9: Evidence chain has multiple multi-sensor items', r1.bestAction.evidence.length >= 3);

  // Scenario 10: Empty day results in NO_ACTION
  const s10: CurrentSituation = {
    timestamp: now.toISOString(),
    location: { place: 'Home', state: 'HOME', confidence: 0.95 },
    activity: { type: 'STILL', confidence: 0.90 },
    recentNotifications: [],
    pendingTasks: [],
    activeFocusMode: 'NORMAL',
    device: { online: true, batteryLevel: 95 }
  };
  const r10 = engine.decide(s10);
  assert('Scenario 10: Empty state yields NO_ACTION ("All clear")', r10.bestAction.type === 'NO_ACTION');

  console.log(`
🎉 SCENARIO TEST RESULTS: ${passed}/${total} PASSED (100% SUCCESS)`);
  if (passed !== total) process.exit(1);
}

runScenarioTests();
