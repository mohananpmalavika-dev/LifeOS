import ContextEngine from "./engine.js";
import { createRawEvent, normalizeTextNotification, normalizeCalendarEvent, normalizeLocationEvent } from "./ingestion.js";
import { runEndToEndScenario, runBatchScenarios } from "./scenario-tests.js";

async function runScenario(engine: ContextEngine, message: string, calendar?: { title: string; when: string; location?: string }, location?: { place: string; latitude?: number; longitude?: number }) {
  const results: any[] = [];

  const msgRaw = createRawEvent(`test:msg:${Math.random().toString(36).slice(2,8)}`, "text_message", "notification", { text: message, sender: "alice" });
  const normMsg = await normalizeTextNotification(msgRaw);
  results.push(await engine.process(normMsg));

  if (calendar) {
    const calRaw = createRawEvent(`test:cal:${Math.random().toString(36).slice(2,8)}`, "calendar_event", "calendar", { title: calendar.title, when: calendar.when, location: calendar.location });
    const normCal = await normalizeCalendarEvent(calRaw);
    results.push(await engine.process(normCal));
  }

  if (location) {
    const locRaw = createRawEvent(`test:loc:${Math.random().toString(36).slice(2,8)}`, "location_event", "location", { place: location.place, latitude: location.latitude, longitude: location.longitude });
    const normLoc = await normalizeLocationEvent(locRaw);
    results.push(await engine.process(normLoc));
  }

  return results;
}

async function main() {
  const engine = new ContextEngine();

  console.log('========================================');
  console.log('     LifeOS Context Engine Benchmark');
  console.log('========================================\n');

  // Run the end-to-end scenario first
  console.log('Running E2E scenario (Mom appointment + insurance + leaving)...');
  const e2e = await runEndToEndScenario();
  if (e2e && e2e.final && e2e.final.intervention) {
    console.log('✓ E2E Intervention:', e2e.final.intervention.surfaces[0].description);
    console.log('  Confidence:', e2e.final.confidence.finalScore.toFixed(3));
    console.log('  Reason:', e2e.final.intervention.reason);
  } else {
    console.log('✗ E2E: No intervention produced');
  }
  console.log();

  console.log('Running comprehensive 50-scenario benchmark...');
  console.log('This tests relationship-based reasoning across 9 real-world categories.\n');
  
  const batch = await runBatchScenarios();
  
  console.log('\n========================================');
  console.log('     BENCHMARK RESULTS');
  console.log('========================================\n');
  
  console.log('Overall Metrics:');
  console.log('─────────────────────────────────────────');
  console.log(`Total Scenarios:           ${batch.scenarios}`);
  console.log(`Correctly Understood:      ${batch.understood} (${((batch.understood / batch.scenarios) * 100).toFixed(1)}%)`);
  console.log(`Context Connected:         ${batch.connected} (${((batch.connected / batch.scenarios) * 100).toFixed(1)}%)`);
  console.log(`Should Intervene (gold):   ${batch.requires}`);
  console.log(`Interventions Triggered:   ${batch.interventions}`);
  console.log();
  
  console.log('Performance:');
  console.log('─────────────────────────────────────────');
  const precision = batch.interventions > 0 ? (batch.correct / batch.interventions) : 0;
  const recall = batch.requires > 0 ? (batch.correct / batch.requires) : 0;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const contextAccuracy = batch.scenarios > 0 ? (batch.connected / batch.scenarios) : 0;
  const understandingAccuracy = batch.scenarios > 0 ? (batch.understood / batch.scenarios) : 0;
  
  console.log(`Context Accuracy:          ${(contextAccuracy * 100).toFixed(1)}%`);
  console.log(`Understanding Accuracy:    ${(understandingAccuracy * 100).toFixed(1)}%`);
  console.log(`Intervention Precision:    ${(precision * 100).toFixed(1)}% (${batch.correct}/${batch.interventions})`);
  console.log(`Intervention Recall:       ${(recall * 100).toFixed(1)}% (${batch.correct}/${batch.requires})`);
  console.log(`F1 Score:                  ${(f1 * 100).toFixed(1)}%`);
  console.log();
  
  console.log('Errors:');
  console.log('─────────────────────────────────────────');
  console.log(`False Positives:           ${batch.falsePositives}`);
  console.log(`False Negatives:           ${batch.falseNegatives}`);
  console.log();
  
  // Category breakdown
  console.log('Category Breakdown:');
  console.log('─────────────────────────────────────────');
  const categorySummary = batch.report.reduce<Record<string, { total: number; understood: number; connected: number; correct: number; positive: number; expected: number }>>((acc, entry) => {
    if (!acc[entry.category]) {
      acc[entry.category] = { total: 0, understood: 0, connected: 0, correct: 0, positive: 0, expected: 0 };
    }
    acc[entry.category].total += 1;
    if (entry.understood) acc[entry.category].understood += 1;
    if (entry.connected) acc[entry.category].connected += 1;
    if (entry.expectIntervene && entry.interventionTriggered) acc[entry.category].correct += 1;
    if (entry.interventionTriggered) acc[entry.category].positive += 1;
    if (entry.expectIntervene) acc[entry.category].expected += 1;
    return acc;
  }, {});
  
  for (const [category, stats] of Object.entries(categorySummary).sort((a, b) => b[1].total - a[1].total)) {
    const catPrecision = stats.positive > 0 ? (stats.correct / stats.positive) * 100 : 0;
    const catRecall = stats.expected > 0 ? (stats.correct / stats.expected) * 100 : 0;
    console.log(`${category.padEnd(12)} | Total: ${stats.total.toString().padStart(2)} | Connected: ${stats.connected.toString().padStart(2)} | Precision: ${catPrecision.toFixed(0).padStart(3)}% | Recall: ${catRecall.toFixed(0).padStart(3)}%`);
  }
  console.log();
  
  // Show some example successful interventions
  console.log('Example Successful Interventions:');
  console.log('─────────────────────────────────────────');
  const successes = batch.report.filter(r => r.expectIntervene && r.interventionTriggered).slice(0, 5);
  for (const success of successes) {
    console.log(`✓ ${success.name}`);
    console.log(`  Category: ${success.category}, Connected: ${success.connected ? 'Yes' : 'No'}`);
    if (success.reason) {
      console.log(`  Reason: ${success.reason}`);
    }
  }
  console.log();
  
  // Show failures for analysis
  console.log('False Negatives (Missed Interventions):');
  console.log('─────────────────────────────────────────');
  const falseNegs = batch.report.filter(r => r.expectIntervene && !r.interventionTriggered).slice(0, 5);
  if (falseNegs.length === 0) {
    console.log('None - Perfect recall!');
  } else {
    for (const miss of falseNegs) {
      console.log(`✗ ${miss.name}`);
      console.log(`  Category: ${miss.category}, Understood: ${miss.understood ? 'Yes' : 'No'}, Connected: ${miss.connected ? 'Yes' : 'No'}`);
    }
  }
  console.log();
  
  console.log('False Positives (Unnecessary Interventions):');
  console.log('─────────────────────────────────────────');
  const falsePos = batch.report.filter(r => !r.expectIntervene && r.interventionTriggered);
  if (falsePos.length === 0) {
    console.log('None - Perfect precision!');
  } else {
    for (const extra of falsePos) {
      console.log(`⚠ ${extra.name}`);
      console.log(`  Category: ${extra.category}`);
    }
  }
  console.log();
  
  // Overall assessment
  console.log('========================================');
  console.log('     ASSESSMENT');
  console.log('========================================\n');
  
  if (precision >= 0.85 && recall >= 0.80) {
    console.log('🎯 EXCELLENT: Ready for real-world testing');
    console.log('   High precision and recall indicate strong relationship-based reasoning.');
  } else if (precision >= 0.75 && recall >= 0.70) {
    console.log('✓ GOOD: Relationship logic working well');
    console.log('  Minor improvements needed before deployment.');
  } else if (precision >= 0.60 || recall >= 0.60) {
    console.log('⚠ FAIR: Needs improvement');
    console.log('  Relationship detection needs tuning.');
  } else {
    console.log('✗ POOR: Major issues detected');
    console.log('  Relationship logic requires significant work.');
  }
  console.log();
  
  return batch;
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('test-harness.js')) {
  void main();
}
