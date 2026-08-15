import { RawLocation, ResolvedPlace, PlacePreparationProfile } from './types.js';
import Database from 'better-sqlite3';

interface PlaceEntity {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  placeType?: string;
  semanticLabel?: string;
}

export const PLACE_PREPARATION_PROFILES: Record<string, PlacePreparationProfile> = {
  'HOSPITAL': { placeType: 'HOSPITAL', arrivalBufferMin: 15, accessTimeMin: 10, parkingTimeMin: 5 },
  'AIRPORT': { placeType: 'AIRPORT', arrivalBufferMin: 120, accessTimeMin: 60, parkingTimeMin: 15, securityTimeMin: 30, checkInTimeMin: 15 },
  'TRAIN_STATION': { placeType: 'TRAIN_STATION', arrivalBufferMin: 20, accessTimeMin: 10, parkingTimeMin: 5 },
  'BUS_STATION': { placeType: 'BUS_STATION', arrivalBufferMin: 15, accessTimeMin: 5 },
  'OFFICE': { placeType: 'OFFICE', arrivalBufferMin: 10, accessTimeMin: 5, parkingTimeMin: 5, securityTimeMin: 2 },
  'SHOPPING_MALL': { placeType: 'SHOPPING_MALL', arrivalBufferMin: 10, accessTimeMin: 5, parkingTimeMin: 10 },
  'GYM': { placeType: 'GYM', arrivalBufferMin: 5, accessTimeMin: 2, parkingTimeMin: 3 },
  'GOVERNMENT': { placeType: 'GOVERNMENT', arrivalBufferMin: 20, accessTimeMin: 15, parkingTimeMin: 10, securityTimeMin: 10 },
  'BANK': { placeType: 'BANK', arrivalBufferMin: 10, accessTimeMin: 5, parkingTimeMin: 5 },
  'COURT': { placeType: 'COURT', arrivalBufferMin: 30, accessTimeMin: 20, parkingTimeMin: 10, securityTimeMin: 15 },
  'HOME': { placeType: 'HOME', arrivalBufferMin: 0, accessTimeMin: 0 },
  'DEFAULT': { placeType: 'DEFAULT', arrivalBufferMin: 10, accessTimeMin: 5, parkingTimeMin: 5 }
};

export class PlaceResolver {
  constructor(private db: Database.Database) {}
  
  async resolve(location: RawLocation): Promise<ResolvedPlace | null> {
    if (!location.name && !location.address && (!location.latitude || !location.longitude)) {
      return null;
    }
    
    if (location.latitude && location.longitude) {
      const byCoordinates = this.findByCoordinates(location.latitude, location.longitude);
      if (byCoordinates) {
        return {
          placeId: byCoordinates.id,
          name: byCoordinates.name,
          address: byCoordinates.address,
          latitude: byCoordinates.latitude!,
          longitude: byCoordinates.longitude!,
          placeType: byCoordinates.placeType || 'UNKNOWN',
          semanticLabel: byCoordinates.semanticLabel,
          confidence: 0.95
        };
      }
    }
    
    if (location.name) {
      const byName = this.findByName(location.name);
      if (byName) {
        return {
          placeId: byName.id,
          name: byName.name,
          address: byName.address,
          latitude: byName.latitude || 0,
          longitude: byName.longitude || 0,
          placeType: byName.placeType || 'UNKNOWN',
          semanticLabel: byName.semanticLabel,
          confidence: 0.85
        };
      }
      
      const fuzzyMatch = this.findByFuzzyName(location.name);
      if (fuzzyMatch) {
        return {
          placeId: fuzzyMatch.id,
          name: fuzzyMatch.name,
          address: fuzzyMatch.address,
          latitude: fuzzyMatch.latitude || 0,
          longitude: fuzzyMatch.longitude || 0,
          placeType: fuzzyMatch.placeType || 'UNKNOWN',
          semanticLabel: fuzzyMatch.semanticLabel,
          confidence: 0.70
        };
      }
    }
    
    const placeType = this.inferPlaceType(location.name || '');
    const newPlace = this.createPlace(location, placeType);
    
    return {
      placeId: newPlace.id,
      name: newPlace.name,
      address: newPlace.address,
      latitude: newPlace.latitude || 0,
      longitude: newPlace.longitude || 0,
      placeType: newPlace.placeType || 'UNKNOWN',
      semanticLabel: newPlace.semanticLabel,
      confidence: 0.50
    };
  }
  
  private findByCoordinates(lat: number, lon: number, radiusKm: number = 0.1): PlaceEntity | null {
    try {
      const latDelta = radiusKm / 111;
      const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
      const row = this.db.prepare(`
        SELECT id, name, type as placeType, center_lat as latitude, center_lon as longitude
        FROM places
        WHERE center_lat BETWEEN ? AND ? AND center_lon BETWEEN ? AND ?
        LIMIT 1
      `).get(lat - latDelta, lat + latDelta, lon - lonDelta, lon + lonDelta) as any;
      if (row) return row;
      return null;
    } catch {
      return null;
    }
  }
  
  private findByName(name: string): PlaceEntity | null {
    try {
      const row = this.db.prepare(`
        SELECT id, name, type as placeType, center_lat as latitude, center_lon as longitude
        FROM places
        WHERE LOWER(name) = LOWER(?)
        LIMIT 1
      `).get(name) as any;
      if (row) return row;
      return null;
    } catch {
      return null;
    }
  }
  
  private findByFuzzyName(name: string): PlaceEntity | null {
    try {
      const row = this.db.prepare(`
        SELECT id, name, type as placeType, center_lat as latitude, center_lon as longitude
        FROM places
        WHERE LOWER(name) LIKE ? OR ? LIKE ('%' || LOWER(name) || '%')
        LIMIT 1
      `).get(`%${name.toLowerCase()}%`, name.toLowerCase()) as any;
      if (row) return row;
      return null;
    } catch {
      return null;
    }
  }
  
  private createPlace(location: RawLocation, placeType: string): PlaceEntity {
    const placeId = `place_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const name = location.name || location.address || 'Unknown Place';
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO places (
          id, name, type, center_lat, center_lon, radius_meters, visit_count,
          total_dwell_minutes, first_seen, last_seen, confidence, is_private
        ) VALUES (?, ?, ?, ?, ?, 100, 1, 0, datetime('now'), datetime('now'), 0.8, 0)
      `).run(placeId, name, placeType, location.latitude || 0, location.longitude || 0);
    } catch {}
    return {
      id: placeId,
      name,
      address: location.address,
      latitude: location.latitude || 0,
      longitude: location.longitude || 0,
      placeType,
    };
  }
  
  inferPlaceType(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('hospital') || lower.includes('clinic') || lower.includes('doctor')) return 'HOSPITAL';
    if (lower.includes('airport') || lower.includes('terminal')) return 'AIRPORT';
    if (lower.includes('office') || lower.includes('infopark') || lower.includes('work')) return 'OFFICE';
    if (lower.includes('home') || lower.includes('house') || lower.includes('apt')) return 'HOME';
    if (lower.includes('mall') || lower.includes('shop') || lower.includes('market')) return 'SHOPPING_MALL';
    if (lower.includes('gym') || lower.includes('fitness')) return 'GYM';
    if (lower.includes('bank') || lower.includes('atm')) return 'BANK';
    return 'DEFAULT';
  }

  getPreparationProfile(placeType: string): PlacePreparationProfile {
    return PLACE_PREPARATION_PROFILES[placeType] || PLACE_PREPARATION_PROFILES['DEFAULT'];
  }
}
