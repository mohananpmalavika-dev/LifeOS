import { 
  ResolvedPlace, 
  TravelRequirement, 
  TransportMode 
} from './types.js';
import { PlaceResolver } from './PlaceResolver.js';
import Database from 'better-sqlite3';

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  trafficDelayMinutes?: number;
  confidence: number;
  provider: 'ONLINE_MAPS' | 'LOCAL_ROUTER' | 'ESTIMATED_OFFLINE' | 'UNAVAILABLE';
  fetchedAt: string;
}

export interface RoutingProvider {
  getRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode?: TransportMode
  ): Promise<RouteResult>;
}

export class OfflineRoutingProvider implements RoutingProvider {
  async getRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode: TransportMode = TransportMode.CAR
  ): Promise<RouteResult> {
    const distanceKm = this.calculateDistanceKm(
      origin.latitude, 
      origin.longitude, 
      destination.latitude, 
      destination.longitude
    );

    const speeds: Record<TransportMode, number> = {
      [TransportMode.WALK]: 4.5,
      [TransportMode.BIKE]: 15,
      [TransportMode.CAR]: 28, // Realistic city average
      [TransportMode.BUS]: 18,
      [TransportMode.TRAIN]: 35,
      [TransportMode.FLIGHT]: 600,
      [TransportMode.UNKNOWN]: 25
    };

    const speed = speeds[mode] || 25;
    const durationMinutes = Math.max(1, Math.round((distanceKm / speed) * 60));

    return {
      distanceKm,
      durationMinutes,
      trafficDelayMinutes: 0,
      confidence: 0.88,
      provider: 'LOCAL_ROUTER',
      fetchedAt: new Date().toISOString()
    };
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
}

export class TravelEngine {
  private routingProvider: RoutingProvider;

  constructor(
    private db: Database.Database,
    private placeResolver: PlaceResolver,
    routingProvider?: RoutingProvider
  ) {
    this.routingProvider = routingProvider || new OfflineRoutingProvider();
  }
  
  async calculateTravelRequirement(
    originOverride: ResolvedPlace | undefined,
    destination: ResolvedPlace,
    departureTime: string,
    preferredMode?: TransportMode
  ): Promise<TravelRequirement | null> {
    if (!destination) return null;
    
    const origin = originOverride || await this.inferOrigin(departureTime);
    
    // Check if valid coordinates exist on both ends
    const hasValidCoords = origin && 
      origin.latitude !== undefined && origin.longitude !== undefined &&
      destination.latitude !== undefined && destination.longitude !== undefined &&
      (origin.latitude !== 0 || origin.longitude !== 0) &&
      (destination.latitude !== 0 || destination.longitude !== 0);

    let route: RouteResult;

    if (hasValidCoords && origin) {
      const mode = preferredMode || this.inferTravelMode(10, destination.placeType);
      route = await this.routingProvider.getRoute(
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: destination.latitude, longitude: destination.longitude },
        mode
      );
    } else {
      // Traceable Low Confidence Estimate: No coordinates available
      route = {
        distanceKm: 0,
        durationMinutes: 20,
        confidence: 0.35, // Explicit low confidence
        provider: 'ESTIMATED_OFFLINE',
        fetchedAt: new Date().toISOString()
      };
    }
    
    const mode = preferredMode || this.inferTravelMode(route.distanceKm, destination.placeType);
    const destProfile = this.placeResolver.getPreparationProfile(destination.placeType);
    const accessTimeMin = destProfile?.accessTimeMin || 5;
    const bufferMin = destProfile?.arrivalBufferMin || 10;
    const requiredDurationMin = route.durationMinutes + accessTimeMin + bufferMin;
    
    const arrivalTime = new Date(departureTime);
    const requiredDepartureTime = new Date(arrivalTime.getTime() - requiredDurationMin * 60 * 1000);
    
    return {
      required: true,
      origin: origin || undefined,
      destination,
      mode,
      modeConfidence: route.confidence,
      distanceKm: route.distanceKm,
      estimatedDurationMin: route.durationMinutes,
      bufferMin,
      accessTimeMin,
      requiredDurationMin,
      requiredDepartureTime: requiredDepartureTime.toISOString(),
      confidence: route.confidence
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
  
  private inferTravelMode(distanceKm: number, _placeType?: string): TransportMode {
    if (distanceKm < 1.0 && distanceKm > 0) return TransportMode.WALK;
    if (distanceKm < 3.0 && distanceKm > 0) return TransportMode.BIKE;
    if (distanceKm > 200) return TransportMode.FLIGHT;
    return TransportMode.CAR;
  }
}
