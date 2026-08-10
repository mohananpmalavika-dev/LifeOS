import { ContextGraph } from "./context-engine.js";
import type { NormalizedEvent } from "./types.js";

function idFor(type: string, title: string) {
  return `${type.toLowerCase()}:${String(title).toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

export async function resolveEntitiesForEvent(graph: ContextGraph, event: NormalizedEvent) {
  const structured = (event.metadata && (event.metadata as any).structured) || {};
  const createdAt = event.timestamp;

  // create person node
  let personId: string | null = null;
  if (structured.person) {
    const pid = idFor("person", structured.person);
    graph.addEntity({ id: pid, type: "Person", title: String(structured.person), properties: { inferredFrom: event.id }, createdAt, updatedAt: createdAt });
    personId = pid;
    graph.addRelation({ id: `rel:${event.id}:${pid}`, sourceId: `event:${event.id}`, targetId: pid, type: "MENTIONED_IN", confidence: event.confidence, createdAt: new Date().toISOString() });
  }

  // handle appointment / commitment creation
  const text = (event.metadata && (event.metadata as any).text) || "";
  const looksLikeAppointment = /appointment|appointment\b|visit|consultation|checkup|meeting|event|flight|departure|boarding|check-in|pickup/i.test(String(text));
  if (looksLikeAppointment || event.event === "calendar_event") {
    const title = structured.place ? `Appointment at ${structured.place}` : `Appointment`;
    const apptId = idFor("appointment", `${structured.person || 'person'}_${event.id}`);
    const apptProps: any = { inferredFrom: event.id };
    if (structured.time) apptProps.iso = structured.time;
    if (structured.place) apptProps.place = structured.place;
    if (structured.person) apptProps.person = structured.person;

    graph.addEntity({ id: apptId, type: "Event", title: title, properties: apptProps, createdAt, updatedAt: createdAt });

    // link person -> appointment
    if (personId) {
      graph.addRelation({ id: `rel:${personId}:${apptId}`, sourceId: personId, targetId: apptId, type: "MENTIONED_IN", confidence: event.confidence, createdAt: new Date().toISOString() });
    }

    // link appointment -> planned time
    if (structured.time) {
      const timeId = idFor("time", structured.time);
      graph.addEntity({ id: timeId, type: "Commitment", title: String(new Date(structured.time).toISOString()), properties: { iso: structured.time, inferredFrom: event.id }, createdAt, updatedAt: createdAt });
      graph.addRelation({ id: `rel:${apptId}:time`, sourceId: apptId, targetId: timeId, type: "PLANNED_FOR", confidence: event.confidence, createdAt: new Date().toISOString() });
    }

    return { appointmentId: apptId, personId };
  }

  // if this event looks like a document reminder, attach it to nearest appointment for same person/day
  const looksLikeDocument = /insurance|papers|document|passport|id card|insurance papers/i.test(String(text));
  if (looksLikeDocument) {
    const docTitle = (structured.object || text.match(/insurance papers|insurance/i)?.[0] || 'document');
    const docId = idFor("document", docTitle);
    graph.addEntity({ id: docId, type: "Document", title: String(docTitle), properties: { inferredFrom: event.id }, createdAt, updatedAt: createdAt });

    const ents = graph.getEntities();
    const samePersonAppointments = ents.filter((e) => e.type === "Event" && e.properties && (e.properties as any).person === structured.person);
    const samePlaceAppointments = structured.place ? ents.filter((e) => e.type === "Event" && e.properties && String((e.properties as any).place || "").toLowerCase() === String(structured.place).toLowerCase()) : [];
    const soonestAppt = (list: any[]) => {
      let best: any = null;
      let bestDiff = Infinity;
      const now = new Date();
      for (const a of list) {
        const iso = (a.properties && (a.properties as any).iso);
        if (!iso) continue;
        try {
          const d = new Date(iso);
          const diff = Math.abs(d.getTime() - now.getTime());
          if (diff < bestDiff) { best = a; bestDiff = diff; }
        } catch (e) { /* skip */ }
      }
      return best;
    };

    let target = samePersonAppointments.length ? soonestAppt(samePersonAppointments) : null;
    if (!target && samePlaceAppointments.length) {
      target = soonestAppt(samePlaceAppointments);
    }
    if (!target) {
      const allEvents = ents.filter((e) => e.type === 'Event' && e.properties && (e.properties as any).iso);
      target = soonestAppt(allEvents);
    }
    if (target) {
      graph.addRelation({ id: `rel:${target.id}:requires:${docId}`, sourceId: target.id, targetId: docId, type: "REQUIRES", confidence: event.confidence, createdAt: new Date().toISOString() });
      return { documentId: docId, attachedTo: target.id };
    }

    return { documentId: docId };
  }

  return {};
}

export default { resolveEntitiesForEvent };
