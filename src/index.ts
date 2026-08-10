import { eventBus } from "./event-bus.js";
import { createRawEvent, normalizeTextNotification, normalizeImageEvent, normalizeAudioEvent, normalizeCalendarEvent } from "./ingestion.js";
import ContextEngine from "./engine.js";

const engine = new ContextEngine();

eventBus.subscribe((e) => {
  void engine.process(e as any).then((r) => {
    if (r.intervention) console.log("Ambient intervention triggered:", r.intervention);
    else console.log("Intervention suppressed: score below 0.90", r.confidence.finalScore);

    console.log("Confidence breakdown:", { baseScore: r.confidence.baseScore.toFixed(3), penalties: r.penalties, finalScore: r.confidence.finalScore.toFixed(3) });
    console.log("Context entities:", engine.getGraph().getEntities());
  });
});

const rawEvent = createRawEvent(
  "raw:1",
  "text_message",
  "notification",
  {
    text: "Mom: Don't forget to take the insurance papers to the hospital tomorrow.",
    sender: "Mom",
    threadId: "family-1",
  },
);

const normalized = await normalizeTextNotification(rawEvent);
eventBus.publish(normalized);

// Image event pipeline (reads OCR via ocr.ts)
const imageRaw = createRawEvent("raw:2", "image_ocr", "photo", { imagePath: "./test.png" });
const normalizedImage = await normalizeImageEvent(imageRaw);
eventBus.publish(normalizedImage);

// Audio event pipeline (reads STT via stt.ts)
const audioRaw = createRawEvent("raw:3", "audio_transcript", "voice", { audioPath: "./voice.wav" });
const normalizedAudio = await normalizeAudioEvent(audioRaw);
eventBus.publish(normalizedAudio);

// --- CVS location-based simulation to trigger a high-confidence intervention ---
const pickupEvent = createRawEvent("raw:4", "text_message", "notification", {
  text: "Pick up prescription at CVS tomorrow",
  sender: "self",
  threadId: "reminders-1",
});

const normalizedPickup = await normalizeTextNotification(pickupEvent);
// create a calendar appointment that matches the pickup (simulating cross-event evidence)
const calRaw = createRawEvent("raw:cal1", "calendar_event", "calendar", { title: "Hospital appointment", when: "tomorrow 16:00", location: "hospital" });
const normalizedCal = await normalizeCalendarEvent(calRaw);
eventBus.publish(normalizedCal);

eventBus.publish(normalizedPickup);

// emulate sensor state updated to be near CVS using engine API
engine.updateSensorState({ motionState: "walking", location: { placeLabel: "CVS Pharmacy", geofence: "cvs_geofence", latitude: 40.7128, longitude: -74.006 } });

// bump confidence + history for the pickup event and process through engine directly to demonstrate cross-event reasoning
normalizedPickup.confidence = 0.99;
normalizedPickup.metadata.structured = { ...(normalizedPickup.metadata.structured || {}), confidence: 0.99 };
normalizedPickup.metadata.history = { shown: 200, accepted: 200 };
const res = await engine.process(normalizedPickup as any);
console.log("Direct engine run result:", res.confidence.finalScore, res.intervention ? "INTERVENTION" : "suppressed");
