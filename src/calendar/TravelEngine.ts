import { 
  ResolvedPlace, 
  TravelRequirement, 
  TransportMode 
} from './types.js';
import { PlaceResolver } from './PlaceResolver.js';
import Database from 'better-sqlite3';

export class TravelEngine {
  constructor(
    private db: Database.Database,
    private placeResolver: PlaceResolver
  ) {}
  
  async calculateTravelRequirement(
    originOverride: ResolvedPlace | undefined,
    destination: ResolvedPlace,
    departureTime: string,
    preferredMode?: TransportMode
  ): Promise<TravelRequirement | null> {
    if (!destination) return null;
    
    const origin = originOverride || await this.inferOrigin(departureTime);
    
    const distanceKm = origin 
      ? this.calculateDistanceKm(origin.latitude, origin.longitude, destination.latitude, destination.longitude)
      : 10;
    
    const mode = preferredMode || this.inferTravelMode(distanceKm, destination.placeType);
    const estimatedDurationMin = this.estimateDurationMin(distanceKm, mode);
    
    const destProfile = this.placeResolver.getPreparationProfile(destination.placeType);
    const accessTimeMin = destProfile?.accessTimeMin || 5;
    const bufferMin = destProfile?.arrivalBufferMin || 10;
    const requiredDurationMin = estimatedDurationMin + accessTimeMin + bufferMin;
    
    const arrivalTime = new Date(departureTime);
    const requiredDepartureTime = new Date(arrivalTime.getTime() - requiredDurationMin * 60 * 1000);
    
    return {
      required: true,
      origin: origin || undefined,
      destination,
      mode,
      modeConfidence: 0.9,
      distanceKm,
      estimatedDurationMin,
      bufferMin,
      accessTimeMin,
      requiredDurationMin,
      requiredDepartureTime: requiredDepartureTime.toISOString(),
      confidence: 0.88
    };
  }

  isTravelFeasible(travelRequirement: TravelRequirement, availableMinutes: number): { feasible: boolean; bufferMin: number; shortfallMin: number } {
    const required = travelRequirement.requiredDurationMin || 0;
    const diff = availableMinutes - required;
    return {
      feasible: diff >= 0,
      bufferMin: diff > 0 ? diff : 0,
      shortfallMin: diff < 0 ? Math.abs(diff) : 0
    };
  }
  
  private async inferOrigin(departureTime: string): Promise<ResolvedPlace | null> {
    try {
      const hour = new Date(departureTime).getHours();
      if (hour >= 9 && hour <= 17) {
        const office = await this.findSemanticPlace('Office') || await this.findSemanticPlace('Work');
        if (office) return office;
      }
      return await this.findSemanticPlace('Home');
    } catch {
      return null;
    }
  }
  
  private async findSemanticPlace(label: string): Promise<ResolvedPlace | null> {
    try {
      const row = this.db.prepare(`
        SELECT id as placeId, name, type as placeType, center_lat as latitude, center_lon as longitude
        FROM places
        WHERE LOWER(type) = LOWER(?) OR LOWER(name) LIKE LOWER(?)
        LIMIT 1
      `).get(label, `%${label}%`) as any;

      if (!row) return null;

      return {
        placeId: row.placeId,
        name: row.name,
        address: row.name,
        latitude: row.latitude || 0,
        longitude: row.longitude || 0,
        placeType: row.placeType || label.toUpperCase(),
        semanticLabel: label,
        confidence: 0.90
      };
    } catch {
      return null;
    }
  }
  
  private calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }
  
  private inferTravelMode(distanceKm: number, _placeType?: string): TransportMode {
    if (distanceKm < 1.0) return TransportMode.WALK;
    if (distanceKm < 3.0) return TransportMode.BIKE;
    if (distanceKm > 200) return TransportMode.FLIGHT;
    return TransportMode.CAR;
  }
  
  private estimateDurationMin(distanceKm: number, mode: TransportMode): number {
    const speeds: Record<TransportMode, number> = {
      [TransportMode.WALK]: 5,
      [TransportMode.BIKE]: 15,
      [TransportMode.CAR]: 30,
      [TransportMode.BUS]: 20,
      [TransportMode.TRAIN]: 40,
      [TransportMode.FLIGHT]: 600,
      [TransportMode.UNKNOWN]: 30
    };
    const speed = speeds[mode] || 30;
    return Math.round((distanceKm / speed) * 60);
  }
}
