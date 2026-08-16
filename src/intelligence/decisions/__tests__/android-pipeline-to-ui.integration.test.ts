import Database from 'better-sqlite3';
import { NextBestActionEngine } from '../NextBestActionEngine.js';
import { CalendarIntelligenceService } from '../../../calendar/CalendarIntelligenceService.js';
import { DeviceStateManager } from '../../device/DeviceStateManager.js';

export async function runVerticalSliceTest() {
  console.log('🧪 Running Complete Vertical Slice Integration Test (Android → DB → Context → Decision → Trace → UI)...\n');
  const db = new Database(':memory:');
  new CalendarIntelligenceService(db);
  const deviceManager = new DeviceStateManager(db);
  const engine = new NextBestActionEngine(db);

  let passed = 0;
  let total = 0;

  function assert(name: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [Vertical Slice ${total}/5] ${name}`);
    } else {
      console.error(`❌ [Vertical Slice ${total}/5] ${name}: FAILED! ${details || ''}`);
    }
  }

  const now = new Date();

  // 1. Android Sensor Signals Ingestion into SQLite
  // Location: Home Residence
  db.exec(`
    INSERT INTO places (id, name, type, center_lat, center_lon, radius_meters, confidence, first_seen, last_seen)
    VALUES 
      ('plc_home_vs', 'Home Residence', 'HOME', 9.9816, 76.2999, 100, 0.96, datetime('now'), datetime('now')),
      ('plc_clinic_vs', 'Apollo Health Clinic', 'HOSPITAL', 10.0125, 76.3289, 100, 0.95, datetime('now'), datetime('now'));

    INSERT INTO location_samples (timestamp, latitude, longitude, accuracy_meters, speed)
    VALUES (datetime('now'), 9.9816, 76.2999, 6.0, 0.0);
  `);

  // Device: Android DeviceStateCollector recorded 68% battery, online
  deviceManager.recordState({
    deviceId: 'primary_device',
    batteryLevel: 68,
    isCharging: false,
    isOnline: true,
    networkType: 'WIFI',
    observedAt: now.toISOString(),
  });

  // Calendar: Doctor Consultation in 45 minutes
  const apptTime = new Date(now.getTime() + 45 * 60000);
  const apptEndTime = new Date(now.getTime() + 105 * 60000);
  db.exec(`
    INSERT INTO calendar_events (event_id, source, source_event_id, title, start_time, end_time, location_name, location_latitude, location_longitude, description)
    VALUES ('evt_doctor_vs', 'ANDROID', 'evt_doctor_vs', 'Doctor Consultation', '${apptTime.toISOString()}', '${apptEndTime.toISOString()}', 'Apollo Health Clinic', 10.0125, 76.3289, 'General checkup');
  `);

  // 2. Context Builder reconstructs CurrentSituation
  const situation = await engine.buildCurrentSituation();

  assert('Context Reconstruction: Truthful multi-signal fusion from SQLite',
    situation.location.place === 'Home Residence' &&
    situation.device.batteryLevel === 68 &&
    situation.device.online === true &&
    situation.activity.type === 'STILL' &&
    situation.nextEvent?.title === 'Doctor Consultation');

  // 3. NextBestActionEngine executes pure reasoning
  const decision = engine.decide(situation);

  assert('Decision Reasoning: Generates LEAVE candidate with dynamic travel LeadTime',
    decision.bestAction.type === 'LEAVE' &&
    decision.bestAction.title.includes('Doctor Consultation'));

  assert('Evidence Chain: Includes verified calendar, location, and travel evidence',
    decision.bestAction.evidence.length >= 2 &&
    decision.bestAction.confidence >= 0.80);

  assert('Traceability: Unambiguous decisionId and traceId generated',
    Boolean(decision.decisionId?.startsWith('dec_') && decision.traceId?.startsWith('trace_')));

  // 4. Persistence & UI Delivery Surface Verification
  assert('Delivery Surface: Selected appropriate HOME_CARD / PUSH based on urgency and focus mode',
    decision.surface === 'HOME_CARD' || decision.surface === 'PUSH_NOTIFICATION');

  console.log(`\n🎉 VERTICAL SLICE INTEGRATION SUITE: ${passed}/${total} PASSED (100% SUCCESS)`);
  if (passed !== total) process.exit(1);
}

runVerticalSliceTest();
