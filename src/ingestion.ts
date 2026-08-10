import { RawEvent, NormalizedEvent, EventSource } from "./types.js";
import { extractStructuredEntities } from "./entity-extractor.js";
import { ocrFromImage } from "./ocr.js";
import { transcribeAudio } from "./stt.js";

const DEFAULT_CONFIDENCE = 0.75;

export function createRawEvent(
  id: string,
  type: string,
  source: EventSource,
  payload: Record<string, unknown>,
  timestamp = new Date().toISOString(),
): RawEvent {
  return { id, type, source, payload, timestamp };
}

export async function normalizeTextNotification(rawEvent: RawEvent): Promise<NormalizedEvent> {
  const text = String(rawEvent.payload.text ?? "");
  const structured = await extractStructuredEntities(text, {
    text,
    sender: typeof rawEvent.payload.sender === "string" ? rawEvent.payload.sender : undefined,
    threadId: typeof rawEvent.payload.threadId === "string" ? rawEvent.payload.threadId : undefined,
  });

  return {
    id: rawEvent.id,
    event: "message_received",
    source: rawEvent.source,
    timestamp: rawEvent.timestamp,
    entities: structured.rawEntities,
    metadata: {
      text,
      structured,
    },
    confidence: structured.confidence,
  };
}

export async function normalizeImageEvent(rawEvent: RawEvent): Promise<NormalizedEvent> {
  const imagePath = String(rawEvent.payload.imagePath ?? "");
  const text = await ocrFromImage(imagePath);
  const structured = await extractStructuredEntities(text, { text });

  return {
    id: rawEvent.id,
    event: "image_ocr",
    source: rawEvent.source,
    timestamp: rawEvent.timestamp,
    entities: structured.rawEntities,
    metadata: { text, ocrSource: imagePath, structured },
    confidence: structured.confidence,
  };
}

export async function normalizeAudioEvent(rawEvent: RawEvent): Promise<NormalizedEvent> {
  const audioPath = String(rawEvent.payload.audioPath ?? "");
  const text = await transcribeAudio(audioPath);
  const structured = await extractStructuredEntities(text, { text });

  return {
    id: rawEvent.id,
    event: "audio_transcript",
    source: rawEvent.source,
    timestamp: rawEvent.timestamp,
    entities: structured.rawEntities,
    metadata: { text, audioSource: audioPath, structured },
    confidence: structured.confidence,
  };
}

export async function normalizeCalendarEvent(rawEvent: RawEvent): Promise<NormalizedEvent> {
  const title = String(rawEvent.payload.title ?? "");
  const when = String(rawEvent.payload.when ?? "");
  const location = String(rawEvent.payload.location ?? "");
  const text = `${title} ${when} ${location}`.trim();
  const structured = await extractStructuredEntities(text, { text });

  return {
    id: rawEvent.id,
    event: "calendar_event",
    source: rawEvent.source,
    timestamp: rawEvent.timestamp,
    entities: structured.rawEntities,
    metadata: { text, title, when, location, structured },
    confidence: structured.confidence || 0.9,
  };
}

export async function normalizeLocationEvent(rawEvent: RawEvent): Promise<NormalizedEvent> {
  const lat = typeof rawEvent.payload.latitude === "number" ? rawEvent.payload.latitude : Number(rawEvent.payload.latitude ?? NaN);
  const lon = typeof rawEvent.payload.longitude === "number" ? rawEvent.payload.longitude : Number(rawEvent.payload.longitude ?? NaN);
  const place = String(rawEvent.payload.place ?? "");
  const text = `location ${place}`;

  const structured = await extractStructuredEntities(text, { text });

  return {
    id: rawEvent.id,
    event: "location",
    source: rawEvent.source,
    timestamp: rawEvent.timestamp,
    entities: structured.rawEntities,
    metadata: { place, latitude: lat, longitude: lon, structured },
    confidence: 0.9,
  };
}

export async function extractEntitiesFromText(text: string): Promise<string[]> {
  const structured = await extractStructuredEntities(text);
  return structured.rawEntities;
}
