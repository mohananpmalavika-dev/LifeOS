import ContextEngine from "./engine.js";
import { createRawEvent, normalizeTextNotification, normalizeCalendarEvent, normalizeLocationEvent } from "./ingestion.js";

export async function runEndToEndScenario() {
  const engine = new ContextEngine();

  // Input 1: Mom's appointment
  const e1 = createRawEvent('scenario:1', 'text_message', 'notification', { text: "Mom's hospital appointment is tomorrow at 4." });
  const n1 = await normalizeTextNotification(e1);
  await engine.process(n1);

  // Input 2: insurance reminder
  const e2 = createRawEvent('scenario:2', 'text_message', 'notification', { text: "Don't forget the insurance papers." });
  const n2 = await normalizeTextNotification(e2);
  await engine.process(n2);

  // Input 3: Home location tomorrow morning
  const e3 = createRawEvent('scenario:3', 'text_message', 'sensor', { text: 'Location = Home Time = tomorrow 8:30 AM' });
  const n3 = await normalizeTextNotification(e3);
  await engine.process(n3);

  // Input 4: leaving home
  const e4 = createRawEvent('scenario:4', 'text_message', 'sensor', { text: 'Location transition: Home -> Leaving' });
  const n4 = await normalizeTextNotification(e4);
  const res4 = await engine.process(n4);

  return { engine, final: res4 };
}

export default { runEndToEndScenario };

export async function runBatchScenarios() {
  const scenarioDefinitions = [
    // HEALTH CATEGORY (10 scenarios)
    {
      name: 'mom_hospital_insurance',
      category: 'health',
      steps: [
        { kind: 'text', text: "Mom's hospital appointment is tomorrow at 4." },
        { kind: 'text', text: "Don't forget the insurance papers." },
        { kind: 'text', text: "Location = Home Time = tomorrow 8:30 AM" },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'dentist_xray',
      category: 'health',
      steps: [
        { kind: 'text', text: "Dad's dentist appointment is next Monday at 10:00." },
        { kind: 'text', text: "Bring the dental X-ray files." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'prescription_refill',
      category: 'health',
      steps: [
        { kind: 'text', text: "Prescription refill is due tomorrow." },
        { kind: 'text', text: "Pharmacy appointment scheduled for tomorrow afternoon." },
        { kind: 'text', text: "Don't forget the prescription." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'pet_vet_visit',
      category: 'health',
      steps: [
        { kind: 'text', text: "Pet's vet appointment is tomorrow at 3 PM." },
        { kind: 'text', text: "Bring vaccination records." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'dentist_followup',
      category: 'health',
      steps: [
        { kind: 'text', text: "Dentist follow-up is tomorrow." },
        { kind: 'text', text: "Don't forget the dental insurance card." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'gym_class',
      category: 'health',
      steps: [
        { kind: 'text', text: "Personal training session is tomorrow at 7 AM." },
        { kind: 'text', text: "Pack workout clothes." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: false,
    },
    {
      name: 'physical_therapy',
      category: 'health',
      steps: [
        { kind: 'text', text: "Physical therapy session is tomorrow at 2 PM." },
        { kind: 'text', text: "Bring the therapy band and doctor's note." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'blood_test',
      category: 'health',
      steps: [
        { kind: 'text', text: "Lab appointment for blood test is tomorrow at 8 AM." },
        { kind: 'text', text: "Bring the lab requisition form." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'eye_exam',
      category: 'health',
      steps: [
        { kind: 'text', text: "Eye exam is scheduled for tomorrow afternoon." },
        { kind: 'text', text: "Bring your current glasses and insurance card." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'vaccination_appointment',
      category: 'health',
      steps: [
        { kind: 'text', text: "Child's vaccination appointment is tomorrow at 11 AM." },
        { kind: 'text', text: "Bring the immunization record." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },

    // WORK CATEGORY (8 scenarios)
    {
      name: 'office_meeting_traffic',
      category: 'work',
      steps: [
        { kind: 'text', text: "Team meeting tomorrow at 9 AM in the office." },
        { kind: 'text', text: "Traffic is heavy on route 7 this morning." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'client_presentation',
      category: 'work',
      steps: [
        { kind: 'text', text: "Client presentation is tomorrow at 2 PM." },
        { kind: 'text', text: "Bring the proposal documents and product samples." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'interview_scheduled',
      category: 'work',
      steps: [
        { kind: 'text', text: "Job interview is tomorrow at 10 AM." },
        { kind: 'text', text: "Print extra copies of your resume." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'deadline_reminder',
      category: 'work',
      steps: [
        { kind: 'text', text: "Project deadline is tomorrow." },
        { kind: 'text', text: "Make sure to submit the final report." },
      ],
      expectIntervene: false,
    },
    {
      name: 'equipment_pickup',
      category: 'work',
      steps: [
        { kind: 'text', text: "Pick up laptop from IT department tomorrow morning." },
        { kind: 'text', text: "Bring employee ID badge." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'training_session',
      category: 'work',
      steps: [
        { kind: 'text', text: "Mandatory training session is tomorrow at 1 PM." },
        { kind: 'text', text: "Bring notebook and training manual." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'networking_event',
      category: 'work',
      steps: [
        { kind: 'text', text: "Industry networking event is tomorrow evening." },
        { kind: 'text', text: "Bring business cards." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'performance_review',
      category: 'work',
      steps: [
        { kind: 'text', text: "Performance review meeting is tomorrow at 3 PM." },
        { kind: 'text', text: "Prepare your self-assessment document." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },

    // TRAVEL CATEGORY (8 scenarios)
    {
      name: 'flight_weather',
      category: 'travel',
      steps: [
        { kind: 'text', text: "Flight departure is tomorrow at 6 AM." },
        { kind: 'text', text: "Weather is calling for heavy rain." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'conference_checkin',
      category: 'travel',
      steps: [
        { kind: 'text', text: "Conference check-in starts tomorrow at 9 AM." },
        { kind: 'text', text: "Print the registration badge." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'passport_renewal',
      category: 'travel',
      steps: [
        { kind: 'text', text: "Passport renewal interview is tomorrow." },
        { kind: 'text', text: "Bring the passport form and ID." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'passport_photo',
      category: 'travel',
      steps: [
        { kind: 'text', text: "Passport photo appointment is tomorrow." },
        { kind: 'text', text: "Bring the application paperwork." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'hotel_checkout',
      category: 'travel',
      steps: [
        { kind: 'text', text: "Hotel checkout is tomorrow morning." },
        { kind: 'text', text: "Keep the reservation confirmation." },
        { kind: 'text', text: "Location transition: Hotel -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'visa_appointment',
      category: 'travel',
      steps: [
        { kind: 'text', text: "Visa application appointment is tomorrow at 10 AM." },
        { kind: 'text', text: "Bring passport, photos, and application form." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'airport_pickup',
      category: 'travel',
      steps: [
        { kind: 'text', text: "Sister's flight arrives tomorrow at 5 PM." },
        { kind: 'text', text: "Traffic to airport usually heavy at that time." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'train_booking',
      category: 'travel',
      steps: [
        { kind: 'text', text: "Train departure is tomorrow at 7 AM." },
        { kind: 'text', text: "Print the e-ticket confirmation." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },

    // FINANCE CATEGORY (6 scenarios)
    {
      name: 'bank_appointment',
      category: 'finance',
      steps: [
        { kind: 'text', text: "Bank appointment is tomorrow at 2 PM." },
        { kind: 'text', text: "Bring the account statement." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'tax_document',
      category: 'finance',
      steps: [
        { kind: 'text', text: "Tax appointment is tomorrow." },
        { kind: 'text', text: "Bring the W-2 documents." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'bank_closing',
      category: 'finance',
      steps: [
        { kind: 'text', text: "Utility bill is due tomorrow." },
        { kind: 'text', text: "I need to go to the bank before closing." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: false,
    },
    {
      name: 'budget_review',
      category: 'finance',
      steps: [
        { kind: 'text', text: "Budget review meeting is later this week." },
        { kind: 'text', text: "Gather the latest expense reports." },
      ],
      expectIntervene: false,
    },
    {
      name: 'loan_application',
      category: 'finance',
      steps: [
        { kind: 'text', text: "Loan application meeting is tomorrow at 11 AM." },
        { kind: 'text', text: "Bring income statements and tax returns." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'insurance_claim',
      category: 'finance',
      steps: [
        { kind: 'text', text: "Insurance claim appointment is tomorrow afternoon." },
        { kind: 'text', text: "Bring the claim forms and receipts." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },

    // FAMILY CATEGORY (6 scenarios)
    {
      name: 'school_permission',
      category: 'family',
      steps: [
        { kind: 'text', text: "Child's school event is tomorrow." },
        { kind: 'text', text: "Bring the permission form." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'school_pickup',
      category: 'family',
      steps: [
        { kind: 'text', text: "School pickup is at 3 PM today." },
        { kind: 'text', text: "Don't forget the permission slip." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'parent_teacher_meeting',
      category: 'family',
      steps: [
        { kind: 'text', text: "Parent-teacher conference is tomorrow at 4 PM." },
        { kind: 'text', text: "Bring the report card and homework samples." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'birthday_party',
      category: 'family',
      steps: [
        { kind: 'text', text: "Nephew's birthday party is tomorrow at 2 PM." },
        { kind: 'text', text: "Wrap the birthday gift." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'daycare_dropoff',
      category: 'family',
      steps: [
        { kind: 'text', text: "Daycare dropoff is at 8 AM tomorrow." },
        { kind: 'text', text: "Pack extra clothes and diapers." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'family_dinner',
      category: 'family',
      steps: [
        { kind: 'text', text: "Family dinner at grandma's house tomorrow at 6 PM." },
        { kind: 'text', text: "Bring the dessert." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },

    // HOME CATEGORY (5 scenarios)
    {
      name: 'package_delivery',
      category: 'home',
      steps: [
        { kind: 'text', text: "Package arriving today at home." },
        { kind: 'text', text: "Make sure someone is home." },
      ],
      expectIntervene: false,
    },
    {
      name: 'grocery_planning',
      category: 'home',
      steps: [
        { kind: 'text', text: "Dinner tonight needs tomatoes and basil." },
        { kind: 'text', text: "Buy grocery items on the way home." },
      ],
      expectIntervene: false,
    },
    {
      name: 'grocery_restock',
      category: 'home',
      steps: [
        { kind: 'text', text: "The fridge is almost empty." },
        { kind: 'text', text: "Stop at the store after work." },
      ],
      expectIntervene: false,
    },
    {
      name: 'repair_appointment',
      category: 'home',
      steps: [
        { kind: 'text', text: "Plumber coming tomorrow at 10 AM." },
        { kind: 'text', text: "Make sure to be home." },
      ],
      expectIntervene: false,
    },
    {
      name: 'furniture_delivery',
      category: 'home',
      steps: [
        { kind: 'text', text: "Furniture delivery scheduled for tomorrow between 1-4 PM." },
        { kind: 'text', text: "Someone needs to be home to sign." },
      ],
      expectIntervene: false,
    },

    // SOCIAL CATEGORY (3 scenarios)
    {
      name: 'wedding_rehearsal',
      category: 'social',
      steps: [
        { kind: 'text', text: "Wedding rehearsal is tomorrow evening." },
        { kind: 'text', text: "Bring the ceremony notes." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'movie_plans',
      category: 'social',
      steps: [
        { kind: 'text', text: "Movie plans are tonight at 8." },
        { kind: 'text', text: "Pick up tickets on the way." },
      ],
      expectIntervene: false,
    },
    {
      name: 'concert_tickets',
      category: 'social',
      steps: [
        { kind: 'text', text: "Concert is tomorrow night at 7 PM." },
        { kind: 'text', text: "Print the e-tickets." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },

    // TRANSPORT CATEGORY (2 scenarios)
    {
      name: 'car_service',
      category: 'transport',
      steps: [
        { kind: 'text', text: "Car service appointment is booked for tomorrow morning." },
        { kind: 'text', text: "Take the registration and insurance documents." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'dmv_appointment',
      category: 'transport',
      steps: [
        { kind: 'text', text: "DMV appointment for license renewal is tomorrow at noon." },
        { kind: 'text', text: "Bring current license and proof of residence." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },

    // LEGAL CATEGORY (2 scenarios)
    {
      name: 'legal_court',
      category: 'legal',
      steps: [
        { kind: 'text', text: "Court hearing is scheduled for tomorrow morning." },
        { kind: 'text', text: "Bring the legal documents." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
    {
      name: 'lawyer_consultation',
      category: 'legal',
      steps: [
        { kind: 'text', text: "Lawyer consultation is tomorrow at 3 PM." },
        { kind: 'text', text: "Bring the contract and correspondence." },
        { kind: 'text', text: "Location transition: Home -> Leaving" },
      ],
      expectIntervene: true,
    },
  ];

  // Generate exactly 50 scenarios - use the definitions directly without duplication
  const scenarios = scenarioDefinitions.slice(0, 50);

  const report = [] as Array<{
    id: string;
    name: string;
    category: string;
    expectIntervene: boolean;
    understood: boolean;
    connected: boolean;
    interventionTriggered: boolean;
    reason?: string;
  }>;

  let understood = 0;
  let connected = 0;
  let requires = 0;
  let interventions = 0;
  let correct = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (const scenario of scenarios) {
    const engine = new ContextEngine();
    let scenarioUnderstood = false;
    let anyIntervention = false;
    let lastReason = '';

    for (const step of scenario.steps) {
      const raw = createRawEvent(
        `batch:${scenario.name}:${Math.random().toString(36).slice(2, 8)}`,
        step.kind === 'location' ? 'location_event' : 'text_message',
        step.kind === 'location' ? 'location' : 'notification',
        step.kind === 'location' ? { place: step.text, latitude: 0, longitude: 0 } : { text: step.text },
      );

      const normalized = step.kind === 'location'
        ? await normalizeLocationEvent(raw)
        : await normalizeTextNotification(raw);

      const result = await engine.process(normalized);
      scenarioUnderstood = scenarioUnderstood || normalized.confidence >= 0.6;
      anyIntervention = anyIntervention || !!(result && result.intervention);
      if (result && result.intervention && result.intervention.reason) {
        lastReason = String(result.intervention.reason);
      }
    }

    const graph = engine.getGraph();
    const relations = graph.getRelations();
    const appointmentConnected = relations.some((r) =>
      ['REQUIRES', 'RELATED_TO', 'DEPENDS_ON', 'PLANNED_FOR'].includes(r.type) &&
      (graph.getEntities().some((e) => e.id === r.sourceId && ['Event', 'Commitment', 'Task'].includes(e.type)) ||
        graph.getEntities().some((e) => e.id === r.targetId && ['Event', 'Commitment', 'Task'].includes(e.type))),
    );

    const isCorrect = scenario.expectIntervene && anyIntervention;
    const isFalsePositive = !scenario.expectIntervene && anyIntervention;
    const isFalseNegative = scenario.expectIntervene && !anyIntervention;

    report.push({
      id: scenario.name,
      name: scenario.name,
      category: scenario.category || 'unknown',
      expectIntervene: scenario.expectIntervene,
      understood: scenarioUnderstood,
      connected: appointmentConnected,
      interventionTriggered: anyIntervention,
      reason: lastReason,
    });

    if (scenarioUnderstood) understood++;
    if (appointmentConnected) connected++;
    if (scenario.expectIntervene) requires++;
    if (anyIntervention) interventions++;
    if (isCorrect) correct++;
    if (isFalsePositive) falsePositives++;
    if (isFalseNegative) falseNegatives++;
  }

  console.log('--- Batch scenarios summary ---');
  console.log(`Scenarios: ${scenarios.length}`);
  console.log(`Understood: ${understood}`);
  console.log(`Connected context: ${connected}`);
  console.log(`Require intervention (gold): ${requires}`);
  console.log(`Interventions triggered: ${interventions}`);
  console.log(`Correct interventions: ${correct}`);
  console.log(`False positives: ${falsePositives}`);
  console.log(`False negatives: ${falseNegatives}`);
  console.log(`Precision: ${interventions > 0 ? (Math.round((correct / interventions) * 100) / 100) : 0}`);
  console.log(`Recall: ${requires > 0 ? (Math.round((correct / requires) * 100) / 100) : 0}`);

  const categorySummary = report.reduce<Record<string, { total: number; understood: number; connected: number; correct: number; positive: number }>>((acc, entry) => {
    if (!acc[entry.category]) {
      acc[entry.category] = { total: 0, understood: 0, connected: 0, correct: 0, positive: 0 };
    }
    acc[entry.category].total += 1;
    if (entry.understood) acc[entry.category].understood += 1;
    if (entry.connected) acc[entry.category].connected += 1;
    if (entry.expectIntervene && entry.interventionTriggered) acc[entry.category].correct += 1;
    if (entry.interventionTriggered) acc[entry.category].positive += 1;
    return acc;
  }, {});

  console.log('--- Category breakdown ---');
  for (const [category, stats] of Object.entries(categorySummary)) {
    console.log(`${category}: total=${stats.total}, understood=${stats.understood}, connected=${stats.connected}, correct=${stats.correct}, positives=${stats.positive}`);
  }

  return { scenarios: scenarios.length, understood, connected, requires, interventions, correct, falsePositives, falseNegatives, report };
}

