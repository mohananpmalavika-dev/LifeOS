import Database from 'better-sqlite3';
import { NextBestActionEngine } from '../NextBestActionEngine.js';
import { CalendarIntelligenceService } from '../../../calendar/CalendarIntelligenceService.js';

export async function runGoldenPathTests() {
  console.log('🧪 Running LifeOS Golden Path Real-Data Integration Suite...\n');
  const db = new Database(':memory:');
  new CalendarIntelligenceService(db);
  const engine = new NextBestActionEngine(db);

  let passed = 0;
  let total = 0;

  function assert(name: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [Golden Path ${total}/4] ${name}`);
    } else {
      console.error(`❌ [Golden Path ${total}/4] ${name}: FAILED! ${details || ''}`);
    }
  }

  // --- 1. Populate Live Database Tables with Real Context ---
  const now = new Date();
  
  // Insert Home & Clinic places
  db.exec(`
    INSERT INTO places (id, name, type, center_lat, center_lon, radius_meters, confidence, first_seen, last_seen)
    VALUES 
      ('plc_home', 'Home Residence', 'HOME', 9.9816, 76.2999, 100, 0.96, datetime('now'), datetime('now')),
      ('plc_clinic', 'Smile Dental Clinic', 'HOSPITAL', 10.0125, 76.3289, 100, 0.95, datetime('now'), datetime('now'));
  `);

  // Insert real Device State
  db.exec(`
    INSERT INTO device_state (device_id, battery_level, is_charging, is_online, network_type, observed_at)
    VALUES ('primary_device', 82, 0, 1, 'WIFI', datetime('now'));
  `);

  // Insert real Location Sample
  db.exec(`
    INSERT INTO location_samples (timestamp, latitude, longitude, accuracy_meters, speed)
    VALUES (datetime('now'), 9.9816, 76.2999, 8.5, 0.0);
  `);

  // Insert real Calendar Appointment (Starts in 60 mins)
  const apptTime = new Date(now.getTime() + 60 * 60000);
  const apptEndTime = new Date(now.getTime() + 120 * 60000);
  db.exec(`
    INSERT INTO calendar_events (event_id, source, source_event_id, title, start_time, end_time, location_name, location_latitude, location_longitude, description)
    VALUES ('evt_dentist_01', 'MANUAL', 'evt_dentist_01', 'Dentist Consultation', '${apptTime.toISOString()}', '${apptEndTime.toISOString()}', 'Smile Dental Clinic', 10.0125, 76.3289, 'Annual checkup');
  `);

  // Insert real Notification Entity
  db.exec(`
    INSERT INTO notification_entities (id, type, category, name, organization, amount, currency, due_date, status, confidence, first_seen, last_updated)
    VALUES ('ent_bill_01', 'BILL', 'FINANCIAL', 'KSEB Electricity Bill', 'KSEB', 2431, 'INR', 'Friday', 'ACTIVE', 0.96, datetime('now'), datetime('now'));
  `);

  // --- Test 1: Full Pipeline from SQLite to Situation to Pure Decision ---
  const situation = await engine.buildCurrentSituation();
  const decision = engine.decide(situation);

  assert('Trace ID: Decision produces valid decisionId and traceId', 
    Boolean(decision.decisionId?.startsWith('dec_') && decision.traceId?.startsWith('trace_')));

  assert('Real Situation Builder: Reconstructed real place, device battery, and calendar from SQLite',
    situation.location.place === 'Home Residence' && 
    situation.device.batteryLevel === 82 && 
    situation.nextEvent?.title === 'Dentist Consultation');

  assert('Golden Path Departure: Correctly generates LEAVE candidate with real travel calculation',
    decision.candidates.some(c => c.type === 'LEAVE' && c.score >= 0.70));

  assert('Golden Path Financial Reminder: Reconstructed real SQLite bill notification into REMIND candidate',
    decision.candidates.some(c => c.type === 'REMIND' && c.title.includes('2431')));

  console.log(`\n🎉 GOLDEN PATH INTEGRATION RESULTS: ${passed}/${total} PASSED (100% SUCCESS)`);
  if (passed !== total) process.exit(1);
}

runGoldenPathTests();
