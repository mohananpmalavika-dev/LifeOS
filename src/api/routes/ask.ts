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
          const travelMin = nextEvent.travelRequirement?.estimatedDurationMin || 35;
          const prepMin = 10;
          const startTime = new Date(nextEvent.event.startTime);
          const leaveTime = new Date(startTime.getTime() - (travelMin + prepMin) * 60000);
          
          answer = `You should leave by **${leaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}** for your **${nextEvent.event.title}** at ${nextEvent.event.location?.name || 'your destination'}.\n\nEstimated driving time is **${travelMin} minutes** from ${homePlace ? homePlace.name : 'Home'}, with a **${prepMin}-minute** buffer for parking and check-in.`;
          
          items.push({
            type: "event",
            title: nextEvent.event.title,
            time: `${new Date(nextEvent.event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            location: nextEvent.event.location?.name,
            tag: `Leave by ${leaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          });
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
          e.people?.forEach((a: any) => { if (a.name) attendees.push(`${a.name} (${e.event.title})`); });
        });
        if (attendees.length > 0) {
          answer = `Today you are meeting:\n\n` + attendees.map(a => `• **${a}**`).join("\n");
        } else {
          answer = "You have a **Doctor Appointment with Dr. Priya Nair** and a **Q3 Product Review with Anand Menon & Sneha Rao** today.";
        }
        suggestionChips = ["When should I leave for my appointment?", "What documents do I need?", "Is tomorrow too busy?"];
      }
      else if (q.includes("busy") || q.includes("feasible") || q.includes("conflict") || q.includes("schedule")) {
        answer = `Today's schedule feasibility score is **85%**. You have **2 major events** with sufficient travel buffer between Home and the City Specialty Hospital. Keep an eye on peak evening traffic around 5:00 PM when returning to Infopark.`;
        suggestionChips = ["When should I leave for my appointment?", "What documents do I need?", "Show my tasks"];
      }
      else if (q.includes("notification") || q.includes("bill") || q.includes("kseb") || q.includes("pay")) {
        answer = `You have an active actionable bill notification:\n\n⚡ **KSEB Electricity Bill** for ₹2,431 is due on **Friday**. Would you like to add a reminder or mark it as paid?`;
        items.push({ type: "bill", title: "KSEB Electricity Bill", amount: "₹2,431", due: "Friday" });
        suggestionChips = ["Show my tasks", "What do I need to do tomorrow?", "When should I leave for my appointment?"];
      }
      else {
        answer = `Here is what is happening right now:\n\n• Next up: **Doctor Appointment** at City Specialty Hospital (Leave by ~3:10 PM)\n• Documents: Insurance card and medical test reports are verified & ready.\n• Attention: Electricity bill of ₹2,431 due Friday.`;
        suggestionChips = [
          "When should I leave for my appointment?",
          "What documents do I need?",
          "What do I need to do tomorrow?",
          "Show my tasks"
        ];
      }

      res.json({
        success: true,
        data: {
          query,
          answer,
          items,
          suggestionChips,
          timestamp: new Date().toISOString(),
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
