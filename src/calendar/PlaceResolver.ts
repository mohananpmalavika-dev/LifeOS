/**
 * Place Resolver
 * 
 * Resolves calendar locations to known place entities with confidence scoring
 */

import { RawLocation, ResolvedPlace, PlacePreparationProfile } from './types';
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

/**
 * Place Type Preparation Profiles
 */
export const PLACE_PREPARATION_PROFILES: Record<string, PlacePreparationProfile> = {
  'HOSPITAL': {
    placeType: 'HOSPITAL',
    arrivalBufferMin: 15,
    accessTimeMin: 10,
    parkingTimeMin: 5
  },
  
  'AIRPORT': {
    placeType: 'AIRPORT',
    arrivalBufferMin: 120,
    accessTimeMin: 60,
    parkingTimeMin: 15,
    securityTimeMin: 30,
    checkInTimeMin: 15
  },
  
  'TRAIN_STATION': {
    placeType: 'TRAIN_STATION',
    arrivalBufferMin: 20,
    accessTimeMin: 10,
    parkingTimeMin: 5
  },
  
  'BUS_STATION': {
    placeType: 'BUS_STATION',
    arrivalBufferMin: 15,
    accessTimeMin: 5
  },
  
  'OFFICE': {
    placeType: 'OFFICE',
    arrivalBufferMin: 10,
    accessTimeMin: 5,
    parkingTimeMin: 5,
    securityTimeMin: 2
  },
  
  'SCHOOL': {
    placeType: 'SCHOOL',
    arrivalBufferMin: 10,
    accessTimeMin: 5,
    parkingTimeMin: 5
  },
  
  'UNIVERSITY': {
    placeType: 'UNIVERSITY',
    arrivalBufferMin: 15,
    accessTimeMin: 10,
    parkingTimeMin: 10
  },
  
  'RESTAURANT': {
    placeType: 'RESTAURANT',
    arrivalBufferMin: 5,
    accessTimeMin: 2,
    parkingTimeMin: 5
  },
  
  'SHOPPING_MALL': {
    placeType: 'SHOPPING_MALL',
    arrivalBufferMin: 10,
    accessTimeMin: 5,
    parkingTimeMin: 10
  },
  
  'GYM': {
    placeType: 'GYM',
    arrivalBufferMin: 5,
    accessTimeMin: 2,
    parkingTimeMin: 3
  },
  
  'GOVERNMENT': {
    placeType: 'GOVERNMENT',
    arrivalBufferMin: 20,
    accessTimeMin: 15,
    parkingTimeMin: 10,
    securityTimeMin: 10
  },
  
  'BANK': {
    placeType: 'BANK',
    arrivalBufferMin: 10,
    accessTimeMin: 5,
    parkingTimeMin: 5
  },
  
  'COURT': {
    placeType: 'COURT',
    arrivalBufferMin: 30,
    accessTimeMin: 20,
    parkingTimeMin: 10,
    securityTimeMin: 15
  },
  
  'HOME': {
    placeType: 'HOME',
    arrivalBufferMin: 0,
    accessTimeMin: 0
  },
  
  'DEFAULT': {
    placeType: 'DEFAULT',
    arrivalBufferMin: 10,
    accessTimeMin: 5,
    parkingTimeMin: 5
  }
};

export class PlaceResolver {
  constructor(private db: Database.Database) {}
  
  /**
   * Resolve a location to a known place entity
   */
  async resolve(location: RawLocation): Promise<ResolvedPlace | null> {
    if (!location.name && !location.address && (!location.latitude || !location.longitude)) {
      return null;
    }
    
    // Try coordinate match first (most precise)
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
    
    // Try exact address match
    if (location.address) {
      const byAddress = this.findByAddress(location.address);
      if (byAddress) {
        return {
          placeId: byAddress.id,
          name: byAddress.name,
          address: byAddress.address,
          latitude: byAddress.latitude || 0,
          longitude: byAddress.longitude || 0,
          placeType: byAddress.placeType || 'UNKNOWN',
          semanticLabel: byAddress.semanticLabel,
          confidence: 0.90
        };
      }
    }
    
    // Try name match (check semantic labels first)
    if (location.name) {
      const bySemanticLabel = this.findBySemanticLabel(location.name);
      if (bySemanticLabel) {
        return {
          placeId: bySemanticLabel.id,
          name: bySemanticLabel.name,
          address: bySemanticLabel.address,
          latitude: bySemanticLabel.latitude || 0,
          longitude: bySemanticLabel.longitude || 0,
          placeType: bySemanticLabel.placeType || 'UNKNOWN',
          semanticLabel: bySemanticLabel.semanticLabel,
          confidence: 0.92
        };
      }
      
      // Try exact name match
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
      
      // Try fuzzy name match
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
    
    // No match found - create new place
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
      confidence: 0.50 // Low confidence for new entity
    };
  }
  
  /**
   * Find place by coordinates (within ~100m radius)
   */
  private findByCoordinates(lat: number, lon: number, radiusKm: number = 0.1): PlaceEntity | null {
    try {
      // Simple bounding box search
      const latDelta = radiusKm / 111; // Rough conversion
      const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
      
      const result = this.db.prepare(`
        SELECT 
          e.entity_id as id,
          e.name,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'address' THEN ea.value END) as address,
          CAST(GROUP_CONCAT(CASE WHEN ea.attribute_type = 'latitude' THEN ea.value END) AS REAL) as latitude,
          CAST(GROUP_CONCAT(CASE WHEN ea.attribute_type = 'longitude' THEN ea.value END) AS REAL) as longitude,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'placeType' THEN ea.value END) as placeType,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'semanticLabel' THEN ea.value END) as semanticLabel
        FROM entities e
        LEFT JOIN entity_attributes ea ON e.entity_id = ea.entity_id
        WHERE e.entity_type = 'PLACE'
        GROUP BY e.entity_id
        HAVING latitude IS NOT NULL 
        AND longitude IS NOT NULL
        AND latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
        LIMIT 1
      `).get(
        lat - latDelta, lat + latDelta,
        lon - lonDelta, lon + lonDelta
      ) as PlaceEntity | undefined;
      
      return result || null;
    } catch (error) {
      console.error('Error finding place by coordinates:', error);
      return null;
    }
  }
  
  /**
   * Find place by address
   */
  private findByAddress(address: string): PlaceEntity | null {
    try {
      const result = this.db.prepare(`
        SELECT 
          e.entity_id as id,
          e.name,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'address' THEN ea.value END) as address,
          CAST(GROUP_CONCAT(CASE WHEN ea.attribute_type = 'latitude' THEN ea.value END) AS REAL) as latitude,
          CAST(GROUP_CONCAT(CASE WHEN ea.attribute_type = 'longitude' THEN ea.value END) AS REAL) as longitude,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'placeType' THEN ea.value END) as placeType,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'semanticLabel' THEN ea.value END) as semanticLabel
        FROM entities e
        LEFT JOIN entity_attributes ea ON e.entity_id = ea.entity_id
        WHERE e.entity_type = 'PLACE'
        AND e.entity_id IN (
          SELECT entity_id FROM entity_attributes 
          WHERE attribute_type = 'address' 
          AND LOWER(value) = LOWER(?)
        )
        GROUP BY e.entity_id
        LIMIT 1
      `).get(address) as PlaceEntity | undefined;
      
      return result || null;
    } catch (error) {
      console.error('Error finding place by address:', error);
      return null;
    }
  }
  
  /**
   * Find place by semantic label (Home, Office, etc.)
   */
  private findBySemanticLabel(label: string): PlaceEntity | null {
    try {
      const result = this.db.prepare(`
        SELECT 
          e.entity_id as id,
          e.name,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'address' THEN ea.value END) as address,
          CAST(GROUP_CONCAT(CASE WHEN ea.attribute_type = 'latitude' THEN ea.value END) AS REAL) as latitude,
          CAST(GROUP_CONCAT(CASE WHEN ea.attribute_type = 'longitude' THEN ea.value END) AS REAL) as longitude,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'placeType' THEN ea.value END) as placeType,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'semanticLabel' THEN ea.value END) as semanticLabel
        FROM entities e
        LEFT JOIN entity_attributes ea ON e.entity_id = ea.entity_id
        WHERE e.entity_type = 'PLACE'
        AND e.entity_id IN (
          SELECT entity_id FROM entity_attributes 
          WHERE attribute_type = 'semanticLabel' 
          AND LOWER(value) = LOWER(?)
        )
        GROUP BY e.entity_id
        LIMIT 1
      `).get(label) as PlaceEntity | undefined;
      
      return result || null;
    } catch (error) {
      console.error('Error finding place by semantic label:', error);
      return null;
    }
  }
  
  /**
   * Find place by exact name
   */
  private findByName(name: string): PlaceEntity | null {
    try {
      const result = this.db.prepare(`
        SELECT 
          e.entity_id as id,
          e.name,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'address' THEN ea.value END) as address,
          CAST(GROUP_CONCAT(CASE WHEN ea.attribute_type = 'latitude' THEN ea.value END) AS REAL) as latitude,
          CAST(GROUP_CONCAT(CASE WHEN ea.attribute_type = 'longitude' THEN ea.value END) AS REAL) as longitude,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'placeType' THEN ea.value END) as placeType,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'semanticLabel' THEN ea.value END) as semanticLabel
        FROM entities e
        LEFT JOIN entity_attributes ea ON e.entity_id = ea.entity_id
        WHERE e.entity_type = 'PLACE'
        AND LOWER(e.name) = LOWER(?)
        GROUP BY e.entity_id
        LIMIT 1
      `).get(name) as PlaceEntity | undefined;
      
      return result || null;
    } catch (error) {
      console.error('Error finding place by name:', error);
      return null;
    }
  }
  
  /**
   * Find place by fuzzy name matching
   */
  private findByFuzzyName(name: string): PlaceEntity | null {
    try {
      const result = this.db.prepare(`
        SELECT 
          e.entity_id as id,
          e.name,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'address' THEN ea.value END) as address,
          CAST(GROUP_CONCAT(CASE WHEN ea.attribute_type = 'latitude' THEN ea.value END) AS REAL) as latitude,
          CAST(GROUP_CONCAT(CASE WHEN ea.attribute_type = 'longitude' THEN ea.value END) AS REAL) as longitude,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'placeType' THEN ea.value END) as placeType,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'semanticLabel' THEN ea.value END) as semanticLabel
        FROM entities e
        LEFT JOIN entity_attributes ea ON e.entity_id = ea.entity_id
        WHERE e.entity_type = 'PLACE'
        AND LOWER(e.name) LIKE LOWER(?)
        GROUP BY e.entity_id
        LIMIT 1
      `).get(`%${name}%`) as PlaceEntity | undefined;
      
      return result || null;
    } catch (error) {
      console.error('Error finding place by fuzzy name:', error);
      return null;
    }
  }
  
  /**
   * Infer place type from name
   */
  private inferPlaceType(name: string): string {
    const nameLower = name.toLowerCase();
    
    const typeKeywords: Record<string, string[]> = {
      'HOSPITAL': ['hospital', 'clinic', 'medical center', 'health'],
      'AIRPORT': ['airport', 'terminal'],
      'TRAIN_STATION': ['station', 'railway', 'rail'],
      'BUS_STATION': ['bus station', 'bus stop'],
      'OFFICE': ['office', 'workplace', 'work'],
      'SCHOOL': ['school', 'academy'],
      'UNIVERSITY': ['university', 'college', 'campus'],
      'RESTAURANT': ['restaurant', 'cafe', 'diner', 'bistro'],
      'SHOPPING_MALL': ['mall', 'shopping center'],
      'GYM': ['gym', 'fitness', 'health club'],
      'GOVERNMENT': ['embassy', 'consulate', 'government', 'city hall', 'dmv'],
      'BANK': ['bank', 'branch'],
      'COURT': ['court', 'courthouse'],
      'HOME': ['home'],
    };
    
    for (const [type, keywords] of Object.entries(typeKeywords)) {
      if (keywords.some(keyword => nameLower.includes(keyword))) {
        return type;
      }
    }
    
    return 'UNKNOWN';
  }
  
  /**
   * Create new place entity
   */
  private createPlace(location: RawLocation, placeType: string): PlaceEntity {
    const entityId = `place_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const name = location.name || location.address || 'Unknown Place';
    
    try {
      // Insert place entity
      this.db.prepare(`
        INSERT INTO entities (entity_id, entity_type, name, created_at)
        VALUES (?, 'PLACE', ?, datetime('now'))
      `).run(entityId, name);
      
      // Insert attributes
      if (location.address) {
        this.db.prepare(`
          INSERT INTO entity_attributes (entity_id, attribute_type, value, confidence)
          VALUES (?, 'address', ?, 0.8)
        `).run(entityId, location.address);
      }
      
      if (location.latitude && location.longitude) {
        this.db.prepare(`
          INSERT INTO entity_attributes (entity_id, attribute_type, value, confidence)
          VALUES (?, 'latitude', ?, 0.9)
        `).run(entityId, location.latitude.toString());
        
        this.db.prepare(`
          INSERT INTO entity_attributes (entity_id, attribute_type, value, confidence)
          VALUES (?, 'longitude', ?, 0.9)
        `).run(entityId, location.longitude.toString());
      }
      
      if (placeType !== 'UNKNOWN') {
        this.db.prepare(`
          INSERT INTO entity_attributes (entity_id, attribute_type, value, confidence)
          VALUES (?, 'placeType', ?, 0.7)
        `).run(entityId, placeType);
      }
      
      return {
        id: entityId,
        name,
        address: location.address,
        latitude: location.latitude,
        longitude: location.longitude,
        placeType
      };
    } catch (error) {
      console.error('Error creating place entity:', error);
      throw error;
    }
  }
  
  /**
   * Get place preparation profile
   */
  getPreparationProfile(placeType: string): PlacePreparationProfile {
    return PLACE_PREPARATION_PROFILES[placeType] || PLACE_PREPARATION_PROFILES['DEFAULT'];
  }
  
  /**
   * Get user's most visited places
   */
  getMostVisitedPlaces(limit: number = 10): PlaceEntity[] {
    try {
      const results = this.db.prepare(`
        SELECT 
          e.entity_id as id,
          e.name,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'address' THEN ea.value END) as address,
          CAST(GROUP_CONCAT(CASE WHEN ea.attribute_type = 'latitude' THEN ea.value END) AS REAL) as latitude,
          CAST(GROUP_CONCAT(CASE WHEN ea.attribute_type = 'longitude' THEN ea.value END) AS REAL) as longitude,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'placeType' THEN ea.value END) as placeType,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'semanticLabel' THEN ea.value END) as semanticLabel,
          COUNT(le.event_id) as visit_count
        FROM entities e
        LEFT JOIN entity_attributes ea ON e.entity_id = ea.entity_id
        LEFT JOIN life_events le ON json_extract(le.metadata, '$.placeId') = e.entity_id
        WHERE e.entity_type = 'PLACE'
        GROUP BY e.entity_id
        ORDER BY visit_count DESC
        LIMIT ?
      `).all(limit) as PlaceEntity[];
      
      return results;
    } catch (error) {
      console.error('Error getting most visited places:', error);
      return [];
    }
  }
}
