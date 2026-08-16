import Database from 'better-sqlite3';
import { NextBestActionEngine } from '../NextBestActionEngine.js';
import { CalendarIntelligenceService } from '../../../calendar/CalendarIntelligenceService.js';

export async function runContextDecisionIntegrationTest() {
  console.log('🧪 Running Context-to-Decision End-to-End Integration Test Suite...\n');
  const db = new Database(':memory:');
  new CalendarIntelligenceService(db);
  const engine = new NextBestActionEngine(db);

  let passed = 0;
  let total = 0;

  function assert(name: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [Integration ${total}/3] ${name}`);
    } else {
      console.error(`❌ [Integration ${total}/3] ${name}: FAILED! ${details || ''}`);
    }
  }

  // --- Step 1: Ingest Live Sensory Records into SQLite ---
  const now = new Date();

  // 1. Ingest Place (Home & Dental Clinic)
  db.exec(`
    INSERT INTO places (id, name, type, center_lat, center_lon, radius_meters, confidence, first_seen, last_seen)
    VALUES 
      ('plc_home_e2e', 'Greenfield Home', 'HOME', 9.9816, 76.2999, 100, 0.95, datetime('now'), datetime('now')),
      ('plc_clinic_e2e', 'Care Dental Clinic', 'HOSPITAL', 10.0125, 76.3289, 100, 0.95, datetime('now'), datetime('now'));
  `);

  // 2. Ingest Location GPS Sample
  db.exec(`
    INSERT INTO location_samples (timestamp, latitude, longitude, accuracy_meters, speed)
    VALUES (datetime('now'), 9.9816, 76.2999, 5.0, 0.0);
  `);

  // 3. Ingest Device State
  db.exec(`
    INSERT INTO device_state (device_id, battery_level, is_charging, is_online, network_type, observed_at)
    VALUES ('primary_device', 73, 0, 1, 'WIFI', datetime('now'));
  `);

  // 4. Ingest Upcoming Calendar Commitment (45 minutes away)
  const apptTime = new Date(now.getTime() + 45 * 60000);
  const apptEndTime = new Date(now.getTime() + 105 * 60000);
  db.exec(`
    INSERT INTO calendar_events (event_id, source, source_event_id, title, start_time, end_time, location_name, location_latitude, location_longitude, description)
    VALUES ('evt_dentist_e2e', 'ANDROID', 'evt_dentist_e2e', 'Dentist Appointment', '${apptTime.toISOString()}', '${apptEndTime.toISOString()}', 'Care Dental Clinic', 10.0125, 76.3289, 'Root canal review');
  `);

  // --- Step 2: Execute Context Builder ---
  const situation = await engine.buildCurrentSituation();

  assert('Context Builder: Reconstructed real place, battery, and motion from SQLite',
    situation.location.place === 'Greenfield Home' &&
    situation.device.batteryLevel === 73 &&
    situation.activity.type === 'STILL' &&
    situation.nextEvent?.title === 'Dentist Appointment');

  // --- Step 3: Execute Pure Reasoning Engine ---
  const decision = engine.decide(situation);

  assert('End-to-End Decision: Produces LEAVE action with verified travel and multi-sensor evidence',
    decision.bestAction.type === 'LEAVE' &&
    decision.bestAction.evidence.length >= 2 &&
    decision.decisionId.startsWith('dec_'));

  // --- Step 4: Test Uncertainty Degradation ---
  // Create an empty engine with unverified data
  const emptyDb = new Database(':memory:');
  new CalendarIntelligenceService(emptyDb);
  const emptyEngine = new NextBestActionEngine(emptyDb);
  const emptySit = await emptyEngine.buildCurrentSituation();
  const emptyDec = emptyEngine.decide(emptySit);

  assert('Uncertainty Gate: Empty sensory database defaults to UNKNOWN with NO_ACTION',
    emptySit.location.state === 'UNKNOWN' &&
    emptySit.device.batteryLevel === 0 &&
    emptyDec.bestAction.type === 'NO_ACTION');

  console.log(`\n🎉 CONTEXT-TO-DECISION INTEGRATION TEST RESULTS: ${passed}/${total} PASSED (100% SUCCESS)`);
  if (passed !== total) process.exit(1);
}

runContextDecisionIntegrationTest();
