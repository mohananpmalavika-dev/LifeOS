/**
 * Location Storage
 * 
 * Manages persistent storage of location data with privacy controls.
 * Implements retention policies and semantic-first storage.
 */

import { Database } from 'better-sqlite3';
import {
  GeoPosition,
  LearnedPlace,
  PlaceVisit,
  PlaceTransition,
  RoutinePattern,
  LocationContext,
  PrivacyMode,
} from '../types';

export class LocationStorage {
  private db: Database;
  
  constructor(db: Database) {
    this.db = db;
    this.initializeTables();
  }
  
  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    // Raw location samples (short retention)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS location_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy_meters REAL NOT NULL,
        altitude REAL,
        heading REAL,
        speed REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_location_samples_timestamp ON location_samples(timestamp);
    `);
    
    // Learned places
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS places (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT,
        center_lat REAL NOT NULL,
        center_lon REAL NOT NULL,
        radius_meters REAL NOT NULL,
        visit_count INTEGER DEFAULT 0,
        total_dwell_minutes INTEGER DEFAULT 0,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        confidence REAL NOT NULL,
        is_private INTEGER DEFAULT 0,
        time_distribution TEXT,
        day_distribution TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Place visits
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS place_visits (
        visit_id TEXT PRIMARY KEY,
        place_id TEXT NOT NULL,
        arrival_time TEXT NOT NULL,
        departure_time TEXT,
        duration_minutes INTEGER,
        arrival_confidence REAL NOT NULL,
        departure_confidence REAL,
        travel_mode TEXT,
        day_of_week INTEGER NOT NULL,
        hour_of_day INTEGER NOT NULL,
        FOREIGN KEY (place_id) REFERENCES places(id)
      );
      CREATE INDEX IF NOT EXISTS idx_place_visits_place ON place_visits(place_id);
      CREATE INDEX IF NOT EXISTS idx_place_visits_time ON place_visits(arrival_time);
    `);
    
    // Place transitions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS place_transitions (
        transition_id TEXT PRIMARY KEY,
        from_place_id TEXT,
        to_place_id TEXT,
        departure_time TEXT NOT NULL,
        arrival_time TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        distance_km REAL,
        travel_mode TEXT,
        confidence REAL NOT NULL,
        average_speed REAL,
        max_speed REAL,
        FOREIGN KEY (from_place_id) REFERENCES places(id),
        FOREIGN KEY (to_place_id) REFERENCES places(id)
      );
      CREATE INDEX IF NOT EXISTS idx_transitions_from ON place_transitions(from_place_id);
      CREATE INDEX IF NOT EXISTS idx_transitions_to ON place_transitions(to_place_id);
      CREATE INDEX IF NOT EXISTS idx_transitions_time ON place_transitions(departure_time);
    `);
    
    // Routine patterns
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS routine_patterns (
        pattern_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        from_place TEXT,
        to_place TEXT,
        day_pattern TEXT NOT NULL,
        time_window TEXT NOT NULL,
        typical_duration INTEGER,
        typical_travel_mode TEXT,
        occurrences INTEGER NOT NULL,
        last_occurrence TEXT NOT NULL,
        probability REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Location contexts (semantic snapshots)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS location_contexts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        current_place TEXT,
        previous_place TEXT,
        destination TEXT,
        travel_mode TEXT NOT NULL,
        movement_state TEXT NOT NULL,
        location_state TEXT NOT NULL,
        dwell_time INTEGER,
        arrival_probability REAL NOT NULL,
        departure_probability REAL NOT NULL,
        movement_intent TEXT,
        confidence REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_location_contexts_timestamp ON location_contexts(timestamp);
    `);
  }
  
  /**
   * Save raw location sample
   */
  saveLocationSample(position: GeoPosition): void {
    const stmt = this.db.prepare(`
      INSERT INTO location_samples (timestamp, latitude, longitude, accuracy_meters, altitude, heading, speed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      position.timestamp.toISOString(),
      position.latitude,
      position.longitude,
      position.accuracyMeters,
      position.altitude || null,
      position.heading || null,
      position.speed || null
    );
  }
  
  /**
   * Save or update place
   */
  savePlace(place: LearnedPlace): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO places (
        id, name, type, center_lat, center_lon, radius_meters,
        visit_count, total_dwell_minutes, first_seen, last_seen,
        confidence, is_private, time_distribution, day_distribution
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      place.id,
      place.name || null,
      place.semanticType || null,
      place.center.latitude,
      place.center.longitude,
      place.radiusMeters,
      place.visitCount,
      place.totalDwellMinutes,
      place.firstSeen.toISOString(),
      place.lastSeen.toISOString(),
      place.confidence,
      place.isPrivate ? 1 : 0,
      JSON.stringify(place.timeDistribution),
      JSON.stringify(place.dayDistribution)
    );
  }
  
  /**
   * Get all places
   */
  getAllPlaces(): LearnedPlace[] {
    const stmt = this.db.prepare('SELECT * FROM places ORDER BY visit_count DESC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      semanticType: row.type,
      center: {
        latitude: row.center_lat,
        longitude: row.center_lon,
      },
      radiusMeters: row.radius_meters,
      visitCount: row.visit_count,
      totalDwellMinutes: row.total_dwell_minutes,
      firstSeen: new Date(row.first_seen),
      lastSeen: new Date(row.last_seen),
      confidence: row.confidence,
      isPrivate: row.is_private === 1,
      timeDistribution: JSON.parse(row.time_distribution),
      dayDistribution: JSON.parse(row.day_distribution),
    }));
  }
  
  /**
   * Get place by ID
   */
  getPlace(placeId: string): LearnedPlace | null {
    const stmt = this.db.prepare('SELECT * FROM places WHERE id = ?');
    const row = stmt.get(placeId) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      name: row.name,
      semanticType: row.type,
      center: {
        latitude: row.center_lat,
        longitude: row.center_lon,
      },
      radiusMeters: row.radius_meters,
      visitCount: row.visit_count,
      totalDwellMinutes: row.total_dwell_minutes,
      firstSeen: new Date(row.first_seen),
      lastSeen: new Date(row.last_seen),
      confidence: row.confidence,
      isPrivate: row.is_private === 1,
      timeDistribution: JSON.parse(row.time_distribution),
      dayDistribution: JSON.parse(row.day_distribution),
    };
  }
  
  /**
   * Save place visit
   */
  savePlaceVisit(visit: PlaceVisit): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO place_visits (
        visit_id, place_id, arrival_time, departure_time, duration_minutes,
        arrival_confidence, departure_confidence, travel_mode, day_of_week, hour_of_day
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      visit.visitId,
      visit.placeId,
      visit.arrivalTime.toISOString(),
      visit.departureTime?.toISOString() || null,
      visit.durationMinutes || null,
      visit.arrivalConfidence,
      visit.departureConfidence || null,
      visit.travelMode || null,
      visit.dayOfWeek,
      visit.hourOfDay
    );
  }
  
  /**
   * Get place visits
   */
  getPlaceVisits(placeId: string, limit = 100): PlaceVisit[] {
    const stmt = this.db.prepare(`
      SELECT * FROM place_visits 
      WHERE place_id = ? 
      ORDER BY arrival_time DESC 
      LIMIT ?
    `);
    
    const rows = stmt.all(placeId, limit) as any[];
    
    return rows.map(row => ({
      visitId: row.visit_id,
      placeId: row.place_id,
      arrivalTime: new Date(row.arrival_time),
      departureTime: row.departure_time ? new Date(row.departure_time) : undefined,
      durationMinutes: row.duration_minutes,
      arrivalConfidence: row.arrival_confidence,
      departureConfidence: row.departure_confidence,
      travelMode: row.travel_mode,
      dayOfWeek: row.day_of_week,
      hourOfDay: row.hour_of_day,
    }));
  }
  
  /**
   * Save place transition
   */
  savePlaceTransition(transition: PlaceTransition): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO place_transitions (
        transition_id, from_place_id, to_place_id, departure_time, arrival_time,
        duration_minutes, distance_km, travel_mode, confidence, average_speed, max_speed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      transition.transitionId,
      transition.fromPlaceId || null,
      transition.toPlaceId || null,
      transition.departureTime.toISOString(),
      transition.arrivalTime.toISOString(),
      transition.durationMinutes,
      transition.distanceKm || null,
      transition.travelMode || null,
      transition.confidence,
      transition.averageSpeed || null,
      transition.maxSpeed || null
    );
  }
  
  /**
   * Get place transitions
   */
  getPlaceTransitions(limit = 500): PlaceTransition[] {
    const stmt = this.db.prepare(`
      SELECT * FROM place_transitions 
      ORDER BY departure_time DESC 
      LIMIT ?
    `);
    
    const rows = stmt.all(limit) as any[];
    
    return rows.map(row => ({
      transitionId: row.transition_id,
      fromPlaceId: row.from_place_id,
      toPlaceId: row.to_place_id,
      departureTime: new Date(row.departure_time),
      arrivalTime: new Date(row.arrival_time),
      durationMinutes: row.duration_minutes,
      distanceKm: row.distance_km,
      travelMode: row.travel_mode,
      confidence: row.confidence,
      averageSpeed: row.average_speed,
      maxSpeed: row.max_speed,
    }));
  }
  
  /**
   * Save routine pattern
   */
  saveRoutinePattern(pattern: RoutinePattern): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO routine_patterns (
        pattern_id, name, type, from_place, to_place, day_pattern, time_window,
        typical_duration, typical_travel_mode, occurrences, last_occurrence, probability
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      pattern.patternId,
      pattern.name,
      pattern.type,
      pattern.fromPlace || null,
      pattern.toPlace || null,
      JSON.stringify(pattern.dayPattern),
      JSON.stringify(pattern.timeWindow),
      pattern.typicalDuration || null,
      pattern.typicalTravelMode || null,
      pattern.occurrences,
      pattern.lastOccurrence.toISOString(),
      pattern.probability
    );
  }
  
  /**
   * Get all routine patterns
   */
  getAllRoutinePatterns(): RoutinePattern[] {
    const stmt = this.db.prepare('SELECT * FROM routine_patterns ORDER BY probability DESC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      patternId: row.pattern_id,
      name: row.name,
      type: row.type,
      fromPlace: row.from_place,
      toPlace: row.to_place,
      dayPattern: JSON.parse(row.day_pattern),
      timeWindow: JSON.parse(row.time_window),
      typicalDuration: row.typical_duration,
      typicalTravelMode: row.typical_travel_mode,
      occurrences: row.occurrences,
      lastOccurrence: new Date(row.last_occurrence),
      probability: row.probability,
    }));
  }
  
  /**
   * Save location context
   */
  saveLocationContext(context: LocationContext): void {
    const stmt = this.db.prepare(`
      INSERT INTO location_contexts (
        timestamp, current_place, previous_place, destination, travel_mode,
        movement_state, location_state, dwell_time, arrival_probability,
        departure_probability, movement_intent, confidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      context.timestamp.toISOString(),
      context.currentPlace?.placeId || null,
      context.previousPlace?.placeId || null,
      context.destination?.placeId || null,
      context.travelMode,
      context.movementState.state,
      context.locationState,
      context.dwellTime || null,
      context.arrivalProbability,
      context.departureProbability,
      context.movementIntent || null,
      context.confidence
    );
  }
  
  /**
   * Clean up old raw location samples
   */
  cleanupOldSamples(retentionDays: number): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const stmt = this.db.prepare('DELETE FROM location_samples WHERE timestamp < ?');
    const result = stmt.run(cutoffDate.toISOString());
    
    console.log(`Cleaned up ${result.changes} old location samples`);
  }
  
  /**
   * Get location context history
   */
  getContextHistory(limit = 100): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM location_contexts 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    
    return stmt.all(limit) as any[];
  }
}
