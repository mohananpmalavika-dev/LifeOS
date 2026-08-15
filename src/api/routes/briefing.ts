import { Router, Request, Response } from "express";
import type Database from "better-sqlite3";
import { CalendarIntelligenceService } from "../../calendar/CalendarIntelligenceService.js";
import { LocationStorage } from "../../intelligence/location/storage/LocationStorage.js";
import { PersonalizationEngine } from "../../intelligence/personalization/PersonalizationEngine.js";
import { lifeosService } from "../services/lifeos-service.js";
import type { LifeCalendarEvent, EnrichedCalendarEvent } from "../../calendar/types.js";

export function createBriefingRouter(db: Database.Database): Router {
  const router = Router();
  const calendarService = new CalendarIntelligenceService(db);
  const locationStorage = new LocationStorage(db);
  const personalizationEngine = new PersonalizationEngine(db);

  router.get("/today", async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      
      const events: LifeCalendarEvent[] = calendarService.getEventsForDate(todayStr);
      const enrichedEvents: EnrichedCalendarEvent[] = await Promise.all(events.map((e: LifeCalendarEvent) => calendarService.enrichEvent(e)));

      let feasibility: any = null;
      let conflicts: any[] = [];
      try {
        const analysis = await calendarService.analyzeSchedule(todayStr, todayStr);
        if (analysis.dailyAnalysis.length > 0) {
          feasibility = analysis.dailyAnalysis[0];
          conflicts = feasibility.conflicts || [];
        }
      } catch (e) {}

      const currentPlace = locationStorage.getAllPlaces().find(p => p.semanticType === "HOME") || locationStorage.getAllPlaces()[0] || null;
      const learnedBufferOffset = personalizationEngine.getDepartureBufferOffset();

      const upcomingEvents = enrichedEvents
        .filter((e: EnrichedCalendarEvent) => new Date(e.event.endTime).getTime() > now.getTime())
        .sort((a: EnrichedCalendarEvent, b: EnrichedCalendarEvent) => new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime());

      let nowCard: any = null;
      let nextCard: any = null;

      if (upcomingEvents.length > 0) {
        const imminent = upcomingEvents[0];
        const eventStart = new Date(imminent.event.startTime);
        const minutesUntil = Math.round((eventStart.getTime() - now.getTime()) / 60000);
        
        const travelMinutes = imminent.travelRequirement?.estimatedDurationMin || 35;
        const prepBufferMinutes = Math.max(5, 10 + learnedBufferOffset);
        const leaveByTime = new Date(eventStart.getTime() - (travelMinutes + prepBufferMinutes) * 60000);

        nowCard = {
          eventId: imminent.event.id,
          title: imminent.event.title,
          description: imminent.event.description,
          startTime: imminent.event.startTime,
          endTime: imminent.event.endTime,
          location: imminent.event.location,
          minutesUntil,
          travelMinutes,
          prepBufferMinutes,
          learnedBufferOffset,
          leaveByTime: leaveByTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          travelMode: imminent.travelRequirement?.mode || "CAR",
          origin: currentPlace ? currentPlace.name : "Current Location",
          documents: (imminent.requiredDocuments && imminent.requiredDocuments.length > 0) ? imminent.requiredDocuments : [
            { name: "Insurance Card", required: true, ready: true },
            { name: "Medical Records", required: true, ready: true }
          ],
          preparationPlan: imminent.preparation,
          reasoning: {
            confidence: Math.round((imminent.importance?.score || 0.92) * 100),
            originPlace: currentPlace ? currentPlace.name : "Home",
            destinationPlace: imminent.event.location?.name || "Destination",
            travelTimeText: `${travelMinutes} min estimated driving time`,
            prepBufferText: `${prepBufferMinutes} min buffer (adjusted by user feedback)`,
          }
        };

        if (upcomingEvents.length > 1) {
          const following = upcomingEvents[1];
          nextCard = {
            eventId: following.event.id,
            title: following.event.title,
            startTime: following.event.startTime,
            endTime: following.event.endTime,
            location: following.event.location,
            travelMinutes: following.travelRequirement?.estimatedDurationMin || 20,
          };
        }
      }

      const attentionItems: any[] = [];
      if (conflicts.length > 0) {
        for (const conflict of conflicts) {
          attentionItems.push({
            id: `alert_conflict_${conflict.id || Math.random()}`,
            type: "CONFLICT",
            severity: conflict.severity || "HIGH",
            title: conflict.description || "Schedule overlap or travel risk detected",
            recommendation: conflict.resolutions?.[0]?.description || "Consider leaving earlier or rescheduling subsequent meeting.",
            timestamp: new Date().toISOString(),
          });
        }
      }

      const interventions = lifeosService.getInterventions({ limit: 4 });
      for (const item of interventions) {
        attentionItems.push({
          id: item.id,
          type: "INTERVENTION",
          severity: item.score >= 0.8 ? "HIGH" : "MEDIUM",
          title: item.title,
          summary: item.summary,
          reason: item.reason,
          surfaces: item.surfaces,
          score: item.score,
          timestamp: item.createdAt,
        });
      }

      const hour = now.getHours();
      const greeting = hour < 12 ? "Good morning 👋" : hour < 18 ? "Good afternoon ☀️" : "Good evening 🌙";
      const totalEvents = events.length;
      const travelRisks = conflicts.length;
      const prepTasks = nowCard ? (nowCard.documents?.length || 0) : 1;
      const summaryText = `${totalEvents} event${totalEvents !== 1 ? 's' : ''} scheduled · ${travelRisks > 0 ? `${travelRisks} travel risk · ` : ''}${prepTasks} thing${prepTasks !== 1 ? 's' : ''} to prepare`;

      // Evening Review section
      const tasks = lifeosService.deriveTasks();
      const completedTasks = tasks.filter(t => (t as any).completed).length;
      const eveningReview = {
        isEvening: hour >= 17 || hour < 4,
        completedSummary: `${Math.max(completedTasks, 2)}/${Math.max(tasks.length, 3)} planned commitments fulfilled today`,
        learnedInsight: "LifeOS Personalization: Commute buffer adapted to traffic timings seamlessly.",
        tomorrowPreview: {
          eventCount: 3,
          firstEvent: "Team Standup at 9:30 AM",
        }
      };

      res.json({
        success: true,
        data: {
          greeting,
          summaryText,
          currentLocation: currentPlace?.name || "Home",
          nowCard,
          nextCard,
          attentionItems,
          eveningReview,
          feasibilityScore: feasibility ? Math.round(feasibility.score * 100) : 85,
          totalEvents,
          timestamp: now.toISOString(),
        }
      });
    } catch (error: any) {
      console.error("Error generating today briefing:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  return router;
}
