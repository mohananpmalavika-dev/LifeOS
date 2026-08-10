// Simple rule-based NER as a fallback before integrating a local SLM/NER model.
import { NormalizedEventMetadata } from "./types.js";

const LOCATION_KEYWORDS = ["hospital", "cvs", "pharmacy", "store", "office", "clinic"];

function findDates(text: string): string[] {
  const results: string[] = [];
  const dateRegex = /\b(?:today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
  const matches = text.match(dateRegex);
  if (matches) results.push(...matches.map((m) => m.toLowerCase()));

  const explicitDate = text.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g);
  if (explicitDate) results.push(...explicitDate);

  return results;
}

function findTimes(text: string): string[] {
  const results: string[] = [];
  const timeRegex = /\b\d{1,2}:\d{2}\b/g;
  const matches = text.match(timeRegex);
  if (matches) results.push(...matches);
  return results;
}

function findLocations(text: string): string[] {
  const normalized = text.toLowerCase();
  return LOCATION_KEYWORDS.filter((kw) => normalized.includes(kw));
}

function findPeople(text: string, metadata: NormalizedEventMetadata): string[] {
  const results: string[] = [];
  if (metadata.sender && typeof metadata.sender === "string") results.push(metadata.sender);

  // crude capitalized word detection
  const caps = text.match(/\b([A-Z][a-z]{1,20})\b/g);
  if (caps) {
    for (const c of caps) {
      if (!results.includes(c)) results.push(c);
    }
  }

  return results;
}

export function extractEntities(text: string, metadata: NormalizedEventMetadata = {}) {
  const lower = text.toLowerCase();
  const entities: string[] = [];

  const dates = findDates(lower);
  const times = findTimes(lower);
  const locs = findLocations(lower);
  const people = findPeople(text, metadata);

  if (dates.length) entities.push(...dates);
  if (times.length) entities.push(...times);
  if (locs.length) entities.push(...locs);
  if (people.length) entities.push(...people.map((p) => p.toLowerCase()));

  // dedupe
  const unique = Array.from(new Set(entities));

  return {
    entities: unique,
    details: {
      dates,
      times,
      locations: locs,
      people,
    },
  };
}
