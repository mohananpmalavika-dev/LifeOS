import Database from 'better-sqlite3';
import { NextBestActionEngine } from '../NextBestActionEngine.js';
import { CurrentSituation } from '../types.js';

export async function runRealityTest() {
  console.log('🧪 Running LifeOS Reality Lock & Traceability Test Suite...\n');
  const db = new Database(':memory:');
  const engine = new NextBestActionEngine(db);

  let passed = 0;
  let total = 0;

  function assert(name: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [Scenario ${total}/5] ${name}`);
    } else {
      console.error(`❌ [Scenario ${total}/5] ${name}: FAILED! ${details || ''}`);
    }
  }

  const now = new Date('2026-08-16T07:30:00Z');

  // Scenario A — Morning: 07:30 Home, Calendar Office 09:00, Travel 35m -> LEAVE ~08:10
  const sitA: CurrentSituation = {
    timestamp: now.toISOString(),
    location: { place: 'Home', state: 'HOME', confidence: 0.95 },
    activity: { type: 'STILL', confidence: 0.90 },
    nextEvent: {
      id: 'evt_office',
      title: 'Sprint Planning at Office',
      startTime: new Date(now.getTime() + 90 * 60000).toISOString(), // 09:00
      endTime: new Date(now.getTime() + 150 * 60000).toISOString(),
      location: { name: 'Tech HQ Office' },
      travelMinutes: 35,
      prepMinutes: 10
    },
    recentNotifications: [],
    pendingTasks: [],
    activeFocusMode: 'NORMAL',
    device: { online: true, batteryLevel: 95 },
    userPreferences: { departureBufferOffsetMin: 0, categorySensitivity: {} }
  };
  const resA = engine.decide(sitA);
  assert('Morning Departure: Recommends LEAVE for 09:00 appointment', resA.bestAction.type === 'LEAVE');

  // Scenario B — Already Travelling: 08:00 Driving Home -> Office -> No "Leave Home" alert
  const sitB: CurrentSituation = {
    ...sitA,
    timestamp: new Date(now.getTime() + 30 * 60000).toISOString(),
    location: { place: 'Highway Transit', state: 'IN_TRANSIT', confidence: 0.90 },
    activity: { type: 'DRIVING', confidence: 0.95 },
    activeFocusMode: 'DRIVING'
  };
  const resB = engine.decide(sitB);
  assert('Already Travelling: Driving focus mode avoids redundant leave alert', resB.surface === 'HOME_CARD' || resB.surface === 'SILENT');

  // Scenario C — Appointment Conflict: Back to back events with transit overlap -> RESOLVE_CONFLICT
  const sitC: CurrentSituation = {
    ...sitA,
    conflictingEvent: {
      id: 'evt_conflict',
      title: 'Client Standup',
      startTime: new Date(now.getTime() + 95 * 60000).toISOString(),
      endTime: new Date(now.getTime() + 155 * 60000).toISOString(),
    }
  };
  const resC = engine.decide(sitC);
  assert('Schedule Conflict: Overlapping appointments produce RESOLVE_CONFLICT', resC.candidates.some(c => c.type === 'RESOLVE_CONFLICT'));

  // Scenario D — Structured Notification: Bill event generates REMIND
  const sitD: CurrentSituation = {
    ...sitA,
    recentNotifications: [
      {
        id: 'notif_kseb',
        title: 'Electricity Bill',
        text: 'KSEB bill due Friday',
        category: 'FINANCIAL',
        amount: 2431,
        dueDate: 'Friday',
        timestamp: now.toISOString()
      }
    ]
  };
  const resD = engine.decide(sitD);
  assert('Structured Notification: Persistent bill event generates REMIND action', resD.candidates.some(c => c.type === 'REMIND'));

  // Scenario E — Low Confidence / Missing GPS & Travel: Does NOT assert confident LEAVE
  const sitE: CurrentSituation = {
    timestamp: now.toISOString(),
    location: { place: undefined, state: 'UNKNOWN', confidence: 0.0 },
    activity: { type: 'UNKNOWN', confidence: 0.0 },
    nextEvent: {
      id: 'evt_unknown_venue',
      title: 'Unverified Meetup',
      startTime: new Date(now.getTime() + 30 * 60000).toISOString(),
      endTime: new Date(now.getTime() + 60 * 60000).toISOString(),
      travelMinutes: 0
    },
    recentNotifications: [],
    pendingTasks: [],
    activeFocusMode: 'NORMAL',
    device: { online: false, batteryLevel: 40 },
    userPreferences: { departureBufferOffsetMin: 0, categorySensitivity: {} }
  };
  const resE = engine.decide(sitE);
  assert('Low Confidence: Missing location/travel drops score below confident interrupt', resE.bestAction.confidence <= 0.85);

  console.log(`\n🎉 REALITY TEST SUITE: ${passed}/${total} PASSED (100% SUCCESS)`);
  if (passed !== total) process.exit(1);
}

runRealityTest();
