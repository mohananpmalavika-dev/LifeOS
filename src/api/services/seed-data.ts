import type Database from "better-sqlite3";
import { lifeosService } from "./lifeos-service.js";
import { CalendarIntelligenceService } from "../../calendar/CalendarIntelligenceService.js";
import { LocationStorage } from "../../intelligence/location/storage/LocationStorage.js";
import { PlaceType } from "../../intelligence/location/types.js";
import { EventStatus, CalendarSource, EventVisibility, LifeCalendarEvent } from "../../calendar/types.js";

export async function seedInitialDemoData(db: Database.Database) {
  try {
    const calendarService = new CalendarIntelligenceService(db);
    const locationStorage = new LocationStorage(db);

    const existingPlaces = locationStorage.getAllPlaces();
    if (existingPlaces.length === 0) {
      locationStorage.savePlace({
        id: "place_home",
        center: { latitude: 9.9816, longitude: 76.2999 },
        radiusMeters: 80,
        visitCount: 42,
        totalDwellMinutes: 18400,
        firstSeen: new Date(Date.now() - 30 * 86400000),
        lastSeen: new Date(),
        timeDistribution: { hourlyVisits: Array(24).fill(2), morning: 30, afternoon: 10, evening: 35, night: 42 },
        dayDistribution: { weeklyVisits: Array(7).fill(6), weekday: 30, weekend: 12 },
        semanticType: PlaceType.HOME,
        name: "Home (Riverside Apts)",
        confidence: 0.98,
        isPrivate: true,
      });

      locationStorage.savePlace({
        id: "place_office",
        center: { latitude: 10.0159, longitude: 76.3419 },
        radiusMeters: 120,
        visitCount: 22,
        totalDwellMinutes: 9800,
        firstSeen: new Date(Date.now() - 28 * 86400000),
        lastSeen: new Date(),
        timeDistribution: { hourlyVisits: Array(24).fill(1), morning: 20, afternoon: 22, evening: 5, night: 0 },
        dayDistribution: { weeklyVisits: [0, 5, 5, 5, 4, 3, 0], weekday: 22, weekend: 0 },
        semanticType: PlaceType.WORK,
        name: "Office (Infopark Phase 2)",
        confidence: 0.95,
        isPrivate: false,
      });

      locationStorage.savePlace({
        id: "place_hospital",
        center: { latitude: 9.9984, longitude: 76.3125 },
        radiusMeters: 100,
        visitCount: 3,
        totalDwellMinutes: 180,
        firstSeen: new Date(Date.now() - 14 * 86400000),
        lastSeen: new Date(),
        timeDistribution: { hourlyVisits: Array(24).fill(0), morning: 3, afternoon: 0, evening: 0, night: 0 },
        dayDistribution: { weeklyVisits: Array(7).fill(0), weekday: 3, weekend: 0 },
        semanticType: PlaceType.HOSPITAL,
        name: "City Specialty Hospital",
        confidence: 0.92,
        isPrivate: false,
      });
    }

    const today = new Date();
    const eventTime1 = new Date(today.getTime() + 2.5 * 3600000);
    const eventTime1End = new Date(eventTime1.getTime() + 60 * 60000);
    const eventTime2 = new Date(today.getTime() + 5.5 * 3600000);
    const eventTime2End = new Date(eventTime2.getTime() + 60 * 60000);

    const existingEvents = calendarService.getEventsForDate(today.toISOString().split("T")[0]);
    if (existingEvents.length === 0) {
      const docEvent: LifeCalendarEvent = {
        id: "evt_doctor_appt",
        source: CalendarSource.MANUAL,
        sourceEventId: "evt_doc_01",
        title: "Doctor Appointment — Dr. Priya Nair",
        description: "Annual health checkup and consultation. Bring insurance card and recent lab reports.",
        startTime: eventTime1.toISOString(),
        endTime: eventTime1End.toISOString(),
        location: {
          name: "City Specialty Hospital",
          address: "Room 304, OPD Wing, City Hospital, MG Road",
          latitude: 9.9984,
          longitude: 76.3125,
        },
        attendees: [{ name: "Dr. Priya Nair", email: "dr.priya@cityhospital.org" }],
        status: EventStatus.CONFIRMED,
        visibility: EventVisibility.PUBLIC,
        reminders: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncState: "NEW",
      };
      await calendarService.storeEvent(docEvent);

      const reviewEvent: LifeCalendarEvent = {
        id: "evt_product_review",
        source: CalendarSource.MANUAL,
        sourceEventId: "evt_prod_02",
        title: "Q3 Product & Architecture Review",
        description: "Review progress on LifeOS passive agent and plan milestone 2 release.",
        startTime: eventTime2.toISOString(),
        endTime: eventTime2End.toISOString(),
        location: {
          name: "Office (Infopark Phase 2)",
          address: "Building Beta, 4th Floor Conference Room",
          latitude: 10.0159,
          longitude: 76.3419,
        },
        attendees: [{ name: "Anand Menon", email: "anand@company.com" }, { name: "Sneha Rao", email: "sneha@company.com" }],
        status: EventStatus.CONFIRMED,
        visibility: EventVisibility.PUBLIC,
        reminders: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncState: "NEW",
      };
      await calendarService.storeEvent(reviewEvent);
    }

    const graph = (lifeosService as any).engine.getGraph();
    const entities = graph.getEntities();
    if (entities.length === 0) {
      graph.addEntity({
        id: "doc_insurance",
        type: "Document",
        title: "Health Insurance Policy Card (Star Health)",
        properties: { category: "Medical", expires: "2027-12-31", ready: true },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      graph.addEntity({
        id: "doc_lab_report",
        type: "Document",
        title: "Recent Blood Test Reports",
        properties: { category: "Medical", date: "2026-08-10", ready: true },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      graph.addEntity({
        id: "person_doctor",
        type: "Person",
        title: "Dr. Priya Nair",
        properties: { specialty: "General Physician", hospital: "City Specialty Hospital" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      graph.addEntity({
        id: "evt_doc_entity",
        type: "Event",
        title: "Doctor Appointment — Dr. Priya Nair",
        properties: { iso: eventTime1.toISOString() },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      graph.addRelation({
        id: "rel_req_1",
        sourceId: "evt_doc_entity",
        targetId: "doc_insurance",
        type: "REQUIRES",
        confidence: 0.95,
        createdAt: new Date().toISOString(),
      });

      graph.addRelation({
        id: "rel_req_2",
        sourceId: "evt_doc_entity",
        targetId: "doc_lab_report",
        type: "REQUIRES",
        confidence: 0.92,
        createdAt: new Date().toISOString(),
      });

      await lifeosService.processNotificationEvent({
        eventId: "notif_kseb_bill",
        timestamp: new Date().toISOString(),
        data: {
          title: "KSEB Electricity Bill",
          text: "Your electricity bill of Rs 2,431 for Consumer #104928 is due on Friday. Pay before due date to avoid disconnection.",
          package: "com.kseb.quickpay",
          appName: "KSEB QuickPay",
        },
        metadata: {
          category: "FINANCIAL",
          actionable: true,
          amount: 2431,
          dueDate: "Friday",
        },
        confidence: 0.96,
      });

      await lifeosService.processNotificationEvent({
        eventId: "notif_pharmacy",
        timestamp: new Date().toISOString(),
        data: {
          title: "Apollo Pharmacy",
          text: "Your prescription order #RX-9921 is packed and ready for pickup at MG Road branch.",
          package: "com.apollo.pharmacy",
          appName: "Apollo 24/7",
        },
        metadata: {
          category: "HEALTHCARE",
          actionable: true,
        },
        confidence: 0.94,
      });
    }

    console.log("✅ Seed demo data initialized successfully");
  } catch (err) {
    console.error("Error seeding initial data:", err);
  }
}
