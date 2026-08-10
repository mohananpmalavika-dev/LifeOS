import { extractEntities } from "./ner.js";
import { parseNaturalDateTime } from "./temporal.js";
import { NormalizedEventMetadata } from "./types.js";
import { extractWithSLM } from "./slm.js";

export interface StructuredExtraction {
  person?: string;
  object?: string;
  place?: string;
  time?: string; // ISO timestamp when resolvable
  action?: string;
  intent?: string;
  confidence: number; // 0..1
  rawEntities: string[];
}

export async function extractStructuredEntities(text: string, metadata: NormalizedEventMetadata = {}): Promise<StructuredExtraction> {
  // Try SLM first (async). If not available/fails, fall back to rule-based NER.
  try {
    const slm = await extractWithSLM(text, metadata as Record<string, unknown>);
    if (slm && (slm.structured || (slm.entities && slm.entities.length > 0) || (slm.confidence && slm.confidence > 0.5))) {
      const raw = slm.entities ?? [];
      // If the SLM provided a `structured` response, prefer it.
      if (slm.structured) {
        const s = slm.structured;
        return {
          person: s.person,
          object: s.object,
          place: s.place,
          time: s.time,
          action: s.action,
          intent: s.intent,
          confidence: s.confidence ?? (slm.confidence ?? 0.8),
          rawEntities: raw,
        };
      }
      // otherwise fall through to rule-based resolution with SLM hints
      const ner = extractEntities(text, metadata);
      const mergedRaw = Array.from(new Set([...(ner.entities || []), ...raw]));
      // continue below using mergedRaw
      const rawEntities = mergedRaw;

      // continue building structured response using rule heuristics below
      // basic heuristics
      const lower = text.toLowerCase();
      const personFromPossessive = text.match(/\b([A-Z][a-z]+)'s\b/);
      const person = ner.details.people && ner.details.people.length ? ner.details.people[0] : metadata.sender || personFromPossessive?.[1];
      const locations = ner.details.locations || [];
      let place = locations.length ? locations[0] : undefined;
      const explicitPlace = text.match(/location\s*=\s*([A-Za-z ]+)/i);
      if (!place && explicitPlace) place = explicitPlace[1].trim();
      if (!place) {
        const placeMatch = text.match(/\b(home|office|hospital|clinic|pharmacy|store|bank|school)\b/i);
        if (placeMatch) place = placeMatch[1].toLowerCase();
      }

      let object: string | undefined;
      if (/insurance papers?|insurance card|insurance/i.test(lower)) object = 'insurance papers';
      else if (/permission form|permission slip|consent form/i.test(lower)) object = 'permission form';
      else if (/passport|id card|driver'?s? license|license|birth certificate/i.test(lower)) object = text.match(/passport|id card|driver'?s? license|license|birth certificate/i)?.[0];
      else if (/registration|title|deed|contract|lease/i.test(lower)) object = text.match(/registration|title|deed|contract|lease/i)?.[0];
      else if (/x-?ray|xray|medical records?|health records?|vaccination records?|immunization records?/i.test(lower)) {
        object = text.match(/x-?ray|xray|medical records?|health records?|vaccination records?|immunization records?/i)?.[0];
      }
      else if (/prescription|medication|pills|medicine/i.test(lower)) object = 'prescription';
      else if (/resume|cv|portfolio|certificates?/i.test(lower)) object = text.match(/resume|cv|portfolio|certificates?/i)?.[0];
      else if (/ticket|e-?ticket|boarding pass|confirmation/i.test(lower)) object = text.match(/ticket|e-?ticket|boarding pass|confirmation/i)?.[0];
      else if (/report card|homework|assignment|school supplies/i.test(lower)) object = text.match(/report card|homework|assignment|school supplies/i)?.[0];
      else if (/tax documents?|w-?2|1099|tax returns?/i.test(lower)) object = text.match(/tax documents?|w-?2|1099|tax returns?/i)?.[0];
      else if (/bank statement|account statement|proof of|income statement/i.test(lower)) object = text.match(/bank statement|account statement|proof of [a-z]+|income statement/i)?.[0];
      else if (/gift|present|cake|dessert|flowers/i.test(lower)) object = text.match(/gift|present|cake|dessert|flowers/i)?.[0];
      else if (/notes|notebook|manual|book|materials?/i.test(lower)) object = text.match(/notes|notebook|manual|book|materials?/i)?.[0];
      else if (/business cards?|name cards?/i.test(lower)) object = 'business cards';
      else if (/form|paperwork|application|documents?/i.test(lower)) {
        // Generic document - try to capture more context
        const docMatch = text.match(/(?:the |bring |take |get )([a-z\-]+ (?:form|paperwork|application|documents?))/i);
        object = docMatch ? docMatch[1] : text.match(/form|paperwork|application|documents?/i)?.[0];
      }
      else {
        const objectMatch = text.match(/(?:take|bring|pick up|collect|buy|prepare|pack|print|get|grab)\s+(?:the |your |my |our )?([a-zA-Z0-9 \-']{3,60}?)(?:\s+(?:for|to|at|before|tomorrow|today)|\.|$)/i);
        if (objectMatch) object = objectMatch[1].trim();
      }

      const actionMatch = text.match(/\b(take|bring|pick up|buy|collect|prepare|pack|submit|pay|call|book|schedule|leave with)\b/i);
      const action = actionMatch ? actionMatch[1].toLowerCase() : undefined;

      const intent = /remind|don't forget|dont forget|remember|please|need to|should|must/i.test(lower) ? 'reminder' : undefined;

      const temporal = parseNaturalDateTime(text);
      const time = temporal.datetime;

      let confidence = 0.5;
      if (rawEntities.length >= 2) confidence += 0.2;
      if (person) confidence += 0.05;
      if (place) confidence += 0.05;
      if (object) confidence += 0.05;
      if (temporal.confidence > 0) confidence = Math.min(1, confidence + temporal.confidence * 0.2);

      return {
        person: person as string | undefined,
        object,
        place,
        time,
        action,
        intent,
        confidence,
        rawEntities,
      };
    }
  } catch (err) {
    // SLM failed — continue with local NER
  }

  const ner = extractEntities(text, metadata);
  const raw = ner.entities;

  // basic heuristics
  const lower = text.toLowerCase();
  const personFromPossessive = text.match(/\b([A-Z][a-z]+)'s\b/);
  const person = ner.details.people && ner.details.people.length ? ner.details.people[0] : metadata.sender || personFromPossessive?.[1];
  const locations = ner.details.locations || [];
  let place = locations.length ? locations[0] : undefined;
  
  // Enhanced place detection
  const explicitPlace = text.match(/location\s*=\s*([A-Za-z ]+)/i);
  if (!place && explicitPlace) place = explicitPlace[1].trim();
  if (!place) {
    const placeMatch = text.match(/\b(home|office|hospital|clinic|pharmacy|store|bank|school|airport|station|hotel|restaurant|court|dmv)\b/i);
    if (placeMatch) place = placeMatch[1].toLowerCase();
  }

  // Enhanced object/document detection - same comprehensive patterns as SLM path
  let object: string | undefined;
  if (/insurance papers?|insurance card|insurance/i.test(lower)) object = 'insurance papers';
  else if (/permission form|permission slip|consent form/i.test(lower)) object = 'permission form';
  else if (/passport|id card|driver'?s? license|license|birth certificate/i.test(lower)) object = text.match(/passport|id card|driver'?s? license|license|birth certificate/i)?.[0];
  else if (/registration|title|deed|contract|lease/i.test(lower)) object = text.match(/registration|title|deed|contract|lease/i)?.[0];
  else if (/x-?ray|xray|medical records?|health records?|vaccination records?|immunization records?/i.test(lower)) {
    object = text.match(/x-?ray|xray|medical records?|health records?|vaccination records?|immunization records?/i)?.[0];
  }
  else if (/prescription|medication|pills|medicine/i.test(lower)) object = 'prescription';
  else if (/resume|cv|portfolio|certificates?/i.test(lower)) object = text.match(/resume|cv|portfolio|certificates?/i)?.[0];
  else if (/ticket|e-?ticket|boarding pass|confirmation/i.test(lower)) object = text.match(/ticket|e-?ticket|boarding pass|confirmation/i)?.[0];
  else if (/report card|homework|assignment|school supplies/i.test(lower)) object = text.match(/report card|homework|assignment|school supplies/i)?.[0];
  else if (/tax documents?|w-?2|1099|tax returns?/i.test(lower)) object = text.match(/tax documents?|w-?2|1099|tax returns?/i)?.[0];
  else if (/bank statement|account statement|proof of|income statement/i.test(lower)) object = text.match(/bank statement|account statement|proof of [a-z]+|income statement/i)?.[0];
  else if (/gift|present|cake|dessert|flowers/i.test(lower)) object = text.match(/gift|present|cake|dessert|flowers/i)?.[0];
  else if (/notes|notebook|manual|book|materials?/i.test(lower)) object = text.match(/notes|notebook|manual|book|materials?/i)?.[0];
  else if (/business cards?|name cards?/i.test(lower)) object = 'business cards';
  else if (/form|paperwork|application|documents?/i.test(lower)) {
    // Generic document - try to capture more context
    const docMatch = text.match(/(?:the |bring |take |get )([a-z\-]+ (?:form|paperwork|application|documents?))/i);
    object = docMatch ? docMatch[1] : text.match(/form|paperwork|application|documents?/i)?.[0];
  }
  else {
    const objectMatch = text.match(/(?:take|bring|pick up|collect|buy|prepare|pack|print|get|grab)\s+(?:the |your |my |our )?([a-zA-Z0-9 \-']{3,60}?)(?:\s+(?:for|to|at|before|tomorrow|today)|\.|$)/i);
    if (objectMatch) object = objectMatch[1].trim();
  }

  // action verb - expanded to catch more action types
  const actionMatch = text.match(/\b(take|bring|pick up|buy|submit|pay|call|book|schedule|prepare|pack|print|get|grab|collect)\b/i);
  const action = actionMatch ? actionMatch[1].toLowerCase() : undefined;

  // intent heuristic - expanded
  const intent = /remind|don't forget|dont forget|remember|please|need to|should|must|make sure/i.test(text.toLowerCase()) ? 'reminder' : undefined;

  const temporal = parseNaturalDateTime(text);
  const time = temporal.datetime;

  // confidence: combine ner confidence proxies and temporal confidence
  let confidence = 0.5;
  if (raw.length >= 2) confidence += 0.2;
  if (person) confidence += 0.05;
  if (place) confidence += 0.05;
  if (object) confidence += 0.05;
  if (temporal.confidence > 0) confidence = Math.min(1, confidence + temporal.confidence * 0.2);

  return {
    person: person as string | undefined,
    object,
    place,
    time,
    action,
    intent,
    confidence,
    rawEntities: raw,
  };
}
