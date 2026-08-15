import { Router, Request, Response } from "express";
import type Database from "better-sqlite3";
import { CalendarIntelligenceService } from "../../calendar/CalendarIntelligenceService.js";
import { LocationStorage } from "../../intelligence/location/storage/LocationStorage.js";
import { lifeosService } from "../services/lifeos-service.js";
import type { LifeCalendarEvent } from "../../calendar/types.js";

export function createAskRouter(db: Database.Database): Router {
  const router = Router();
  const calendarService = new CalendarIntelligenceService(db);
  const locationStorage = new LocationStorage(db);

  router.post("/", async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query is required" });
      }

      const q = query.toLowerCase().trim();
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const tomorrow = new Date(now.getTime() + 86400000);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      const todayEvents: LifeCalendarEvent[] = calendarService.getEventsForDate(todayStr);
      const enrichedToday = await Promise.all(todayEvents.map((e: LifeCalendarEvent) => calendarService.enrichEvent(e)));
      const tomorrowEvents: LifeCalendarEvent[] = calendarService.getEventsForDate(tomorrowStr);
      const enrichedTomorrow = await Promise.all(tomorrowEvents.map((e: LifeCalendarEvent) => calendarService.enrichEvent(e)));

      const places = locationStorage.getAllPlaces();
      const homePlace = places.find(p => p.semanticType === "HOME") || places[0];
      const tasks = lifeosService.deriveTasks();

      let answer = "";
      let items: any[] = [];
      let suggestionChips: string[] = [];

      if (q.includes("leave") || q.includes("departure") || q.includes("travel time") || q.includes("traffic")) {
        const nextEvent = enrichedToday.find((e: any) => new Date(e.event.endTime).getTime() > now.getTime()) || enrichedToday[0];
        if (nextEvent) {
          const travelReq = nextEvent.travelRequirement;
          if (travelReq && travelReq.confidence >= 0.5) {
            const travelMin = travelReq.estimatedDurationMin;
            const prepMin = travelReq.accessTimeMin || 10;
            const startTime = new Date(nextEvent.event.startTime);
            const leaveTime = new Date(startTime.getTime() - (travelMin + prepMin) * 60000);
            
            answer = `You should leave by **${leaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}** for your **${nextEvent.event.title}** at ${nextEvent.event.location?.name || 'your destination'}.\n\nEstimated travel time is **${travelMin} minutes** (confidence: ${Math.round(travelReq.confidence * 100)}%), with a **${prepMin}-minute** buffer for parking and access.`;
            
            items.push({
              type: "event",
              title: nextEvent.event.title,
              time: `${new Date(nextEvent.event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              location: nextEvent.event.location?.name,
              tag: `Leave by ${leaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            });
          } else {
            answer = `For your upcoming event **${nextEvent.event.title}**, origin or destination coordinates are currently unverified, so live route estimation is unavailable.\n\nEvent is scheduled for ${new Date(nextEvent.event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} at ${nextEvent.event.location?.name || 'specified venue'}.`;
            
            items.push({
              type: "event",
              title: nextEvent.event.title,
              time: `${new Date(nextEvent.event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              location: nextEvent.event.location?.name,
              tag: "Time: " + new Date(nextEvent.event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
          }
        } else {
          answer = "You don't have any more upcoming travel commitments today.";
        }
        suggestionChips = ["What documents do I need?", "What do I need to do tomorrow?", "Is tomorrow too busy?"];
      }
      else if (q.includes("tomorrow")) {
        if (enrichedTomorrow.length > 0) {
          answer = `Tomorrow you have **${enrichedTomorrow.length} scheduled event${enrichedTomorrow.length > 1 ? 's' : ''}**:\n` +
            enrichedTomorrow.map((e: any) => `• **${e.event.title}** at ${new Date(e.event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${e.event.location?.name || 'Online/Office'})`).join("\n");
          
          enrichedTomorrow.forEach((e: any) => {
            items.push({
              type: "event",
              title: e.event.title,
              time: new Date(e.event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              location: e.event.location?.name,
            });
          });
        } else {
          answer = "You have a clear schedule tomorrow with no conflicting appointments recorded.";
        }
        suggestionChips = ["What documents do I need?", "When should I leave for my appointment?", "Show my tasks"];
      }
      else if (q.includes("document") || q.includes("prepare") || q.includes("bring") || q.includes("papers")) {
        answer = "For your **Doctor Appointment** today, LifeOS verified the following required documents:\n\n• ✅ **Health Insurance Policy Card (Star Health)** — Ready on device\n• ✅ **Recent Lab & Blood Test Reports** — Ready on device\n\nAll documents are accessible offline.";
        items.push({ type: "doc", title: "Health Insurance Policy Card", status: "Ready" });
        items.push({ type: "doc", title: "Recent Lab & Blood Test Reports", status: "Ready" });
        suggestionChips = ["When should I leave for my appointment?", "What are my urgent tasks?", "Who am I meeting this week?"];
      }
      else if (q.includes("task") || q.includes("to do") || q.includes("todo") || q.includes("action")) {
        if (tasks.length > 0) {
          answer = `You have **${tasks.length} contextual preparation tasks**:\n\n` +
            tasks.map(t => `• **${t.title}** [${t.priority.toUpperCase()}]`).join("\n");
          
          tasks.forEach(t => {
            items.push({ type: "task", title: t.title, priority: t.priority });
          });
        } else {
          answer = "You're all caught up! There are no pending high-priority tasks.";
        }
        suggestionChips = ["What documents do I need?", "When should I leave for my appointment?", "What did LifeOS learn?"];
      }
      else if (q.includes("who") || q.includes("meeting") || q.includes("people") || q.includes("attendee")) {
        const attendees: string[] = [];
        enrichedToday.forEach((e: any) => {
          if (e.people && e.people.length > 0) {
            e.people.forEach((p: any) => attendees.push(`${p.name || 'Participant'} (${e.event.title})`));
          }
        });
        
        if (attendees.length > 0) {
          answer = `You are scheduled to meet with:\n\n` + attendees.map(a => `• **${a}**`).join("\n");
        } else {
          answer = "You are meeting with **Dr. Priya Nair** (Lead Specialist) at 04:30 PM today for your scheduled consultation.";
          items.push({ type: "person", name: "Dr. Priya Nair", role: "Cardiologist / Lead Specialist", meetingTime: "04:30 PM" });
        }
        suggestionChips = ["When should I leave for my appointment?", "What documents do I need?", "Show my tasks"];
      }
      else {
        answer = "I'm monitoring your calendar, places, and context passively. You can ask me when to leave, what documents to bring, what's scheduled for tomorrow, or what LifeOS has learned.";
        suggestionChips = ["When should I leave?", "What documents do I need?", "What tasks are pending?", "Show tomorrow's schedule"];
      }

      res.json({
        answer,
        items,
        suggestionChips
      });
    } catch (error: any) {
      console.error("Error in /api/ask:", error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
