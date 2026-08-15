/**
 * Location Intelligence API Routes
 * 
 * Provides REST endpoints for location context, places, visits, and routines.
 */

import { Router, Request, Response } from 'express';
import { Database } from 'better-sqlite3';
import { LocationContextEngine } from '../../intelligence/location/LocationContextEngine.js';
import { LocationStorage } from '../../intelligence/location/storage/LocationStorage.js';
import { PlaceType, PrivacyMode } from '../../intelligence/location/types.js';

export function createLocationRouter(db: Database): Router {
  const router = Router();
  const storage = new LocationStorage(db);
  
  // Initialize location context engine
  const locationEngine = new LocationContextEngine({
    onContextUpdate: (context) => {
      // Save context to storage
      storage.saveLocationContext(context);
    },
    onLocationEvent: (event) => {
      console.log('Location event:', event.type, event.data);
    },
  });
  
  // Load existing data
  const places = storage.getAllPlaces();
  locationEngine.getPlaceEngine().loadPlaces(places);
  
  const routines = storage.getAllRoutinePatterns();
  locationEngine.getRoutineEngine().loadRoutines(routines);
  
  /**
   * GET /api/location/context
   * Get current location context
   */
  router.get('/context', (req: Request, res: Response) => {
    try {
      const context = locationEngine.getCurrentContext();
      
      if (!context) {
        return res.json({
          status: 'no_data',
          message: 'No location context available yet',
        });
      }
      
      res.json({
        timestamp: context.timestamp,
        currentPlace: context.currentPlace,
        previousPlace: context.previousPlace,
        destination: context.destination,
        travelMode: context.travelMode,
        movementState: {
          state: context.movementState.state,
          speedKmh: context.movementState.speedKmh,
          heading: context.movementState.heading,
          confidence: context.movementState.confidence,
        },
        locationState: context.locationState,
        dwellTime: context.dwellTime,
        arrivalProbability: context.arrivalProbability,
        departureProbability: context.departureProbability,
        routinePattern: context.routinePattern ? {
          name: context.routinePattern.name,
          type: context.routinePattern.type,
          probability: context.routinePattern.probability,
        } : null,
        movementIntent: context.movementIntent,
        confidence: context.confidence,
      });
    } catch (error) {
      console.error('Error getting location context:', error);
      res.status(500).json({ error: 'Failed to get location context' });
    }
  });
  
  /**
   * GET /api/location/places
   * Get all learned places
   */
  router.get('/places', (req: Request, res: Response) => {
    try {
      const places = storage.getAllPlaces();
      
      res.json({
        places: places.map(place => ({
          id: place.id,
          name: place.name,
          type: place.semanticType,
          center: place.center,
          radiusMeters: place.radiusMeters,
          visitCount: place.visitCount,
          totalDwellMinutes: place.totalDwellMinutes,
          firstSeen: place.firstSeen,
          lastSeen: place.lastSeen,
          confidence: place.confidence,
          isPrivate: place.isPrivate,
          avgDwellMinutes: place.visitCount > 0 
            ? Math.round(place.totalDwellMinutes / place.visitCount) 
            : 0,
        })),
      });
    } catch (error) {
      console.error('Error getting places:', error);
      res.status(500).json({ error: 'Failed to get places' });
    }
  });
  
  /**
   * GET /api/location/places/:placeId
   * Get specific place details
   */
  router.get('/places/:placeId', (req: Request, res: Response) => {
    try {
      const { placeId } = req.params;
      const id = placeId as string;
      const place = storage.getPlace(id);
      
      if (!place) {
        return res.status(404).json({ error: 'Place not found' });
      }
      
      // Get recent visits
      const visits = storage.getPlaceVisits(id, 50);
      
      res.json({
        place: {
          ...place,
          avgDwellMinutes: place.visitCount > 0 
            ? Math.round(place.totalDwellMinutes / place.visitCount) 
            : 0,
        },
        recentVisits: visits.map(visit => ({
          visitId: visit.visitId,
          arrivalTime: visit.arrivalTime,
          departureTime: visit.departureTime,
          durationMinutes: visit.durationMinutes,
          travelMode: visit.travelMode,
        })),
      });
    } catch (error) {
      console.error('Error getting place:', error);
      res.status(500).json({ error: 'Failed to get place' });
    }
  });
  
  /**
   * PUT /api/location/places/:placeId
   * Update place details
   */
  router.put('/places/:placeId', (req: Request, res: Response) => {
    try {
      const { placeId } = req.params;
      const id = placeId as string;
      const { name, type, isPrivate } = req.body;
      
      const place = storage.getPlace(id);
      if (!place) {
        return res.status(404).json({ error: 'Place not found' });
      }
      
      // Update place
      if (name !== undefined) {
        locationEngine.setPlaceName(id, name);
        place.name = name;
      }
      
      if (type !== undefined) {
        locationEngine.setPlaceType(id, type as PlaceType);
        place.semanticType = type as PlaceType;
      }
      
      if (isPrivate !== undefined) {
        locationEngine.getPlaceEngine().setPlacePrivacy(id, isPrivate);
        place.isPrivate = isPrivate;
      }
      
      // Save to storage
      storage.savePlace(place);
      
      res.json({
        success: true,
        place,
      });
    } catch (error) {
      console.error('Error updating place:', error);
      res.status(500).json({ error: 'Failed to update place' });
    }
  });
  
  /**
   * GET /api/location/visits
   * Get recent place visits
   */
  router.get('/visits', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      
      // Get all places and their recent visits
      const places = storage.getAllPlaces();
      const allVisits: any[] = [];
      
      for (const place of places) {
        const visits = storage.getPlaceVisits(place.id, 10);
        allVisits.push(...visits.map(visit => ({
          ...visit,
          placeName: place.name,
          placeType: place.semanticType,
        })));
      }
      
      // Sort by arrival time
      allVisits.sort((a, b) => 
        new Date(b.arrivalTime).getTime() - new Date(a.arrivalTime).getTime()
      );
      
      res.json({
        visits: allVisits.slice(0, limit),
      });
    } catch (error) {
      console.error('Error getting visits:', error);
      res.status(500).json({ error: 'Failed to get visits' });
    }
  });
  
  /**
   * GET /api/location/routines
   * Get learned routine patterns
   */
  router.get('/routines', (req: Request, res: Response) => {
    try {
      const routines = storage.getAllRoutinePatterns();
      
      res.json({
        routines: routines.map(routine => ({
          patternId: routine.patternId,
          name: routine.name,
          type: routine.type,
          fromPlace: routine.fromPlace,
          toPlace: routine.toPlace,
          dayPattern: routine.dayPattern,
          timeWindow: routine.timeWindow,
          typicalDuration: routine.typicalDuration,
          typicalTravelMode: routine.typicalTravelMode,
          occurrences: routine.occurrences,
          lastOccurrence: routine.lastOccurrence,
          probability: routine.probability,
        })),
      });
    } catch (error) {
      console.error('Error getting routines:', error);
      res.status(500).json({ error: 'Failed to get routines' });
    }
  });
  
  /**
   * GET /api/location/transitions
   * Get place transitions (trips)
   */
  router.get('/transitions', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const transitions = storage.getPlaceTransitions(limit);
      
      // Enrich with place names
      const enriched = transitions.map(transition => {
        const fromPlace = transition.fromPlaceId 
          ? storage.getPlace(transition.fromPlaceId) 
          : null;
        const toPlace = transition.toPlaceId 
          ? storage.getPlace(transition.toPlaceId) 
          : null;
        
        return {
          transitionId: transition.transitionId,
          fromPlace: fromPlace ? {
            id: fromPlace.id,
            name: fromPlace.name,
            type: fromPlace.semanticType,
          } : null,
          toPlace: toPlace ? {
            id: toPlace.id,
            name: toPlace.name,
            type: toPlace.semanticType,
          } : null,
          departureTime: transition.departureTime,
          arrivalTime: transition.arrivalTime,
          durationMinutes: transition.durationMinutes,
          distanceKm: transition.distanceKm,
          travelMode: transition.travelMode,
          confidence: transition.confidence,
        };
      });
      
      res.json({
        transitions: enriched,
      });
    } catch (error) {
      console.error('Error getting transitions:', error);
      res.status(500).json({ error: 'Failed to get transitions' });
    }
  });
  
  /**
   * GET /api/location/timeline
   * Get location timeline (contextual sequence)
   */
  router.get('/timeline', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const contexts = storage.getContextHistory(limit);
      
      // Build timeline from contexts
      const timeline = contexts.map((ctx: any) => ({
        timestamp: ctx.timestamp,
        currentPlace: ctx.current_place,
        locationState: ctx.location_state,
        movementState: ctx.movement_state,
        travelMode: ctx.travel_mode,
        movementIntent: ctx.movement_intent,
        dwellTime: ctx.dwell_time,
        confidence: ctx.confidence,
      }));
      
      res.json({
        timeline,
      });
    } catch (error) {
      console.error('Error getting timeline:', error);
      res.status(500).json({ error: 'Failed to get timeline' });
    }
  });
  
  /**
   * POST /api/location/learn
   * Trigger routine learning from historical data
   */
  router.post('/learn', (req: Request, res: Response) => {
    try {
      const transitions = storage.getPlaceTransitions(1000);
      
      locationEngine.getRoutineEngine().learnFromTransitions(transitions);
      
      const routines = locationEngine.getAllRoutines();
      
      // Save learned routines
      for (const routine of routines) {
        storage.saveRoutinePattern(routine);
      }
      
      res.json({
        success: true,
        learnedRoutines: routines.length,
        routines: routines.map(r => ({
          name: r.name,
          type: r.type,
          occurrences: r.occurrences,
          probability: r.probability,
        })),
      });
    } catch (error) {
      console.error('Error learning routines:', error);
      res.status(500).json({ error: 'Failed to learn routines' });
    }
  });
  
  /**
   * GET /api/location/stats
   * Get location intelligence statistics
   */
  router.get('/stats', (req: Request, res: Response) => {
    try {
      const places = storage.getAllPlaces();
      const routines = storage.getAllRoutinePatterns();
      
      const homePlace = places.find(p => p.semanticType === PlaceType.HOME);
      const workPlace = places.find(p => p.semanticType === PlaceType.WORK);
      
      const totalVisits = places.reduce((sum, p) => sum + p.visitCount, 0);
      const totalDwellHours = places.reduce((sum, p) => sum + p.totalDwellMinutes, 0) / 60;
      
      res.json({
        totalPlaces: places.length,
        identifiedPlaces: places.filter(p => p.semanticType).length,
        unknownPlaces: places.filter(p => !p.semanticType).length,
        homeIdentified: !!homePlace,
        workIdentified: !!workPlace,
        totalVisits,
        totalDwellHours: Math.round(totalDwellHours),
        learnedRoutines: routines.length,
        topPlaces: places
          .sort((a, b) => b.visitCount - a.visitCount)
          .slice(0, 5)
          .map(p => ({
            name: p.name || `Place ${p.id.slice(0, 8)}`,
            type: p.semanticType,
            visits: p.visitCount,
            avgDwellMinutes: Math.round(p.totalDwellMinutes / p.visitCount),
          })),
      });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });
  
  /**
   * POST /api/location/start
   * Start location intelligence engine
   */
  router.post('/start', async (req: Request, res: Response) => {
    try {
      await locationEngine.start();
      
      res.json({
        success: true,
        message: 'Location intelligence started',
      });
    } catch (error) {
      console.error('Error starting location engine:', error);
      res.status(500).json({ error: 'Failed to start location engine' });
    }
  });
  
  /**
   * POST /api/location/stop
   * Stop location intelligence engine
   */
  router.post('/stop', (req: Request, res: Response) => {
    try {
      locationEngine.stop();
      
      res.json({
        success: true,
        message: 'Location intelligence stopped',
      });
    } catch (error) {
      console.error('Error stopping location engine:', error);
      res.status(500).json({ error: 'Failed to stop location engine' });
    }
  });
  
  /**
   * POST /api/location/cleanup
   * Clean up old location data
   */
  router.post('/cleanup', (req: Request, res: Response) => {
    try {
      const retentionDays = parseInt(req.body.retentionDays) || 7;
      
      storage.cleanupOldSamples(retentionDays);
      
      res.json({
        success: true,
        message: `Cleaned up location samples older than ${retentionDays} days`,
      });
    } catch (error) {
      console.error('Error cleaning up data:', error);
      res.status(500).json({ error: 'Failed to clean up data' });
    }
  });
  
  return router;
}
