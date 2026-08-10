// Pluggable SLM interface. Register a real local model client with `setSLMClient`.
// If a local model is available, it will be used; otherwise the dev fallback remains.

import { extractEntities } from "./ner.js";
import { parseNaturalDateTime } from "./temporal.js";

type SLMResponse = {
  structured?: any;
  entities?: string[];
  details?: any;
  confidence?: number;
};

type SLMClient = {
  extract: (text: string, metadata?: Record<string, unknown>) => Promise<SLMResponse>;
};

let client: SLMClient | null = null;

export function setSLMClient(c: SLMClient) {
  client = c;
}

export async function extractWithSLM(text: string, metadata?: Record<string, unknown>): Promise<SLMResponse> {
  if (client) return client.extract(text, metadata);

  await new Promise((resolve) => setTimeout(resolve, 20));
  return { entities: [], details: {}, confidence: 0.0 };
}

export async function createLocalSLMClient(modelPath?: string): Promise<SLMClient | null> {
  try {
    const transformers = await import("@xenova/transformers");
    const pipeline = transformers.pipeline || transformers.default?.pipeline;
    if (typeof pipeline !== "function") return null;

    const model = await pipeline("text-generation", modelPath || "Xenova/gpt2", {
      task: "text-generation",
      max_new_tokens: 128,
    });

    return {
      async extract(text: string, metadata?: Record<string, unknown>) {
        const prompt = `Extract structured fields from the following note:\nText: ${text}\nReturn JSON with keys person, place, object, time, action, intent.`;
        const response = await model(prompt, {
          max_new_tokens: 128,
          return_full_text: false,
        });
        const output = Array.isArray(response) ? response[0]?.generated_text || "" : String(response?.generated_text || "");
        let parsed: any = {};
        try {
          parsed = JSON.parse(output.replace(/^[^\{]*/s, ""));
        } catch (e) {
          parsed = {};
        }

        const ner = extractEntities(text, metadata as any);
        const temporal = parseNaturalDateTime(text);
        const structured = {
          person: parsed.person || (ner.details.people && ner.details.people[0]) || (metadata && (metadata as any).sender),
          place: parsed.place || (ner.details.locations && ner.details.locations[0]),
          object: parsed.object || undefined,
          time: parsed.time || temporal.datetime,
          action: parsed.action || undefined,
          intent: parsed.intent || undefined,
          confidence: 0.7,
        };

        return {
          structured,
          entities: Array.from(new Set([...(ner.entities || []), ...(parsed.entities || [])].filter(Boolean))),
          details: ner.details,
          confidence: structured.confidence,
        };
      },
    };
  } catch (err) {
    return null;
  }
}

const devStub: SLMClient = {
  async extract(text: string, metadata?: Record<string, unknown>) {
    const ner = extractEntities(text, metadata as any);
    const temporal = parseNaturalDateTime(text);

    const person = (ner.details.people && ner.details.people[0]) || (metadata && (metadata as any).sender) || undefined;
    const place = ner.details.locations && ner.details.locations.length ? ner.details.locations[0] : undefined;
    const objectMatch = text.match(/(?:take|bring|pick up|collect|buy)\s+([a-zA-Z0-9 \-']{3,60})/i);
    const object = objectMatch ? objectMatch[1].trim() : undefined;
    const actionMatch = text.match(/\b(take|bring|pick up|buy|submit|pay|call|book|schedule)\b/i);
    const action = actionMatch ? actionMatch[1].toLowerCase() : undefined;
    const intent = /remind|dont forget|remember|please/.test(text.toLowerCase()) ? 'reminder' : undefined;

    const structured = {
      person,
      object,
      place,
      time: temporal.datetime,
      action,
      intent,
      confidence: Math.min(0.95, 0.5 + (ner.entities.length * 0.05) + (temporal.confidence * 0.2)),
    };

    return {
      structured,
      entities: ner.entities,
      details: ner.details,
      confidence: structured.confidence,
    };
  },
};

setSLMClient(devStub);

export type { SLMResponse, SLMClient };
