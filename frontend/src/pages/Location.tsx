/**
 * Location Intelligence Page
 * 
 * Displays current location context, learned places, routines, and movement history.
 */

import React, { useState, useEffect } from 'react';
import './Location.css';
import { api } from '../services/api';

interface LocationContext {
  timestamp: string;
  currentPlace?: {
    placeId: string;
    name?: string;
    type: string;
    confidence: number;
  };
  previousPlace?: {
    placeId: string;
    name?: string;
    type: string;
  };
  destination?: {
    placeId: string;
    name?: string;
    type: string;
    confidence: number;
  };
  travelMode: string;
  movementState: {
    state: string;
    speedKmh?: number;
    heading?: number;
    confidence: number;
  };
  locationState: string;
  dwellTime?: number;
  arrivalProbability: number;
  departureProbability: number;
  routinePattern?: {
    name: string;
    type: string;
    probability: number;
  };
  movementIntent?: string;
  confidence: number;
}

interface Place {
  id: string;
  name?: string;
  type?: string;
  center: { latitude: number; longitude: number };
  radiusMeters: number;
  visitCount: number;
  totalDwellMinutes: number;
  avgDwellMinutes: number;
  confidence: number;
  isPrivate: boolean;
  firstSeen: string;
  lastSeen: string;
}

interface Routine {
  patternId: string;
  name: string;
  type: string;
  fromPlace?: string;
  toPlace?: string;
  dayPattern: {
    daysOfWeek: number[];
  };
  timeWindow: {
    startHour: number;
    startMinute: number;
    flexibilityMinutes: number;
  };
  typicalDuration?: number;
  typicalTravelMode?: string;
  occurrences: number;
  probability: number;
}

interface Stats {
  totalPlaces: number;
  identifiedPlaces: number;
  unknownPlaces: number;
  homeIdentified: boolean;
  workIdentified: boolean;
  totalVisits: number;
  totalDwellHours: number;
  learnedRoutines: number;
  topPlaces: Array<{
    name: string;
    type?: string;
    visits: number;
    avgDwellMinutes: number;
  }>;
}

const Location: React.FC = () => {
  const [context, setContext] = useState<LocationContext | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState<'context' | 'places' | 'routines' | 'stats'>('context');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [editingPlace, setEditingPlace] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [contextRes, placesRes, routinesRes, statsRes] = await Promise.all([
        api.get('/location/context'),
        api.get('/location/places'),
        api.get('/location/routines'),
        api.get('/location/stats'),
      ]);

      if (contextRes.data && contextRes.data.timestamp) {
        setContext(contextRes.data);
      }
      
      setPlaces(placesRes.data.places || []);
      setRoutines(routinesRes.data.routines || []);
      setStats(statsRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading location data:', error);
      setLoading(false);
    }
  };

  const formatMovementState = (state: string): string => {
    return state.replace(/_/g, ' ');
  };

  const formatLocationState = (state: string): string => {
    return state.replace(/_/g, ' ');
  };

  const formatPlaceType = (type?: string): string => {
    if (!type) return 'Unknown';
    return type.charAt(0) + type.slice(1).toLowerCase();
  };

  const formatDayPattern = (daysOfWeek: number[]): string => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return daysOfWeek.map(d => dayNames[d]).join(', ');
  };

  const formatTime = (hour: number, minute: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const updatePlace = async (placeId: string, updates: Partial<Place>) => {
    try {
      await api.put(`/location/places/${placeId}`, updates);
      await loadData();
      setEditingPlace(null);
    } catch (error) {
      console.error('Error updating place:', error);
    }
  };

  const learnRoutines = async () => {
    try {
      const response = await api.post('/location/learn');
      alert(`Learned ${response.data.learnedRoutines} routine patterns!`);
      await loadData();
    } catch (error) {
      console.error('Error learning routines:', error);
    }
  };

  const renderContext = () => {
    if (!context) {
      return (
        <div className="no-data">
          <p>No location context available yet.</p>
          <p className="hint">Location intelligence needs to be started and collect data.</p>
        </div>
      );
    }

    return (
      <div className="context-view">
        <div className="context-card main-context">
          <h3>Current Context</h3>
          
          <div className="context-section">
            <label>Location State</label>
            <div className="state-badge">{formatLocationState(context.locationState)}</div>
          </div>

          {context.currentPlace && (
            <div className="context-section">
              <label>Current Place</label>
              <div className="place-info">
                <span className="place-name">
                  {context.currentPlace.name || `Place ${context.currentPlace.placeId.slice(0, 8)}`}
                </span>
                <span className="place-type">{formatPlaceType(context.currentPlace.type)}</span>
                <span className="confidence">{Math.round(context.currentPlace.confidence * 100)}%</span>
              </div>
              {context.dwellTime !== undefined && (
                <div className="dwell-time">Dwelling for {context.dwellTime} minutes</div>
              )}
            </div>
          )}

          <div className="context-section">
            <label>Movement</label>
            <div className="movement-info">
              <span className="movement-state">{formatMovementState(context.movementState.state)}</span>
              {context.movementState.speedKmh !== undefined && (
                <span className="speed">{Math.round(context.movementState.speedKmh)} km/h</span>
              )}
              <span className="travel-mode">{context.travelMode}</span>
            </div>
          </div>

          {context.destination && (
            <div className="context-section destination">
              <label>Destination</label>
              <div className="place-info">
                <span className="place-name">
                  {context.destination.name || `Place ${context.destination.placeId.slice(0, 8)}`}
                </span>
                <span className="place-type">{formatPlaceType(context.destination.type)}</span>
              </div>
              <div className="probabilities">
                <div className="probability">
                  <span>Arrival: {Math.round(context.arrivalProbability * 100)}%</span>
                </div>
              </div>
            </div>
          )}

          {context.routinePattern && (
            <div className="context-section routine">
              <label>Detected Routine</label>
              <div className="routine-info">
                <span className="routine-name">{context.routinePattern.name}</span>
                <span className="routine-probability">
                  {Math.round(context.routinePattern.probability * 100)}% confidence
                </span>
              </div>
            </div>
          )}

          {context.movementIntent && (
            <div className="context-section">
              <label>Intent</label>
              <div className="intent">{formatMovementState(context.movementIntent)}</div>
            </div>
          )}

          <div className="context-footer">
            <span className="timestamp">
              {new Date(context.timestamp).toLocaleString()}
            </span>
            <span className="overall-confidence">
              {Math.round(context.confidence * 100)}% confidence
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderPlaces = () => {
    const sortedPlaces = [...places].sort((a, b) => b.visitCount - a.visitCount);

    return (
      <div className="places-view">
        <div className="places-header">
          <h3>Learned Places ({places.length})</h3>
        </div>

        <div className="places-grid">
          {sortedPlaces.map(place => (
            <div 
              key={place.id} 
              className={`place-card ${place.isPrivate ? 'private' : ''} ${selectedPlace?.id === place.id ? 'active' : ''}`}
              onClick={() => setSelectedPlace(selectedPlace?.id === place.id ? null : place)}
            >
              <div className="place-header">
                <h4>{place.name || `Place ${place.id.slice(0, 8)}`}</h4>
                {place.type && <span className="type-badge">{formatPlaceType(place.type)}</span>}
              </div>

              <div className="place-stats">
                <div className="stat">
                  <label>Visits</label>
                  <span>{place.visitCount}</span>
                </div>
                <div className="stat">
                  <label>Avg Dwell</label>
                  <span>{place.avgDwellMinutes}m</span>
                </div>
                <div className="stat">
                  <label>Confidence</label>
                  <span>{Math.round(place.confidence * 100)}%</span>
                </div>
              </div>

              {editingPlace === place.id ? (
                <div className="place-edit">
                  <input
                    type="text"
                    placeholder="Place name"
                    defaultValue={place.name || ''}
                    onBlur={(e) => updatePlace(place.id, { name: e.target.value })}
                  />
                  <select
                    defaultValue={place.type || ''}
                    onChange={(e) => updatePlace(place.id, { type: e.target.value as any })}
                  >
                    <option value="">Select type...</option>
                    <option value="HOME">Home</option>
                    <option value="WORK">Work</option>
                    <option value="SCHOOL">School</option>
                    <option value="GYM">Gym</option>
                    <option value="HOSPITAL">Hospital</option>
                    <option value="RESTAURANT">Restaurant</option>
                    <option value="SHOP">Shop</option>
                  </select>
                </div>
              ) : (
                <button 
                  className="edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPlace(place.id);
                  }}
                >
                  Edit
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRoutines = () => {
    return (
      <div className="routines-view">
        <div className="routines-header">
          <h3>Learned Routines ({routines.length})</h3>
          <button onClick={learnRoutines} className="learn-btn">
            Learn from History
          </button>
        </div>

        {routines.length === 0 ? (
          <div className="no-data">
            <p>No routines learned yet.</p>
            <p className="hint">Click "Learn from History" to analyze your location patterns.</p>
          </div>
        ) : (
          <div className="routines-list">
            {routines.map(routine => (
              <div key={routine.patternId} className="routine-card">
                <div className="routine-header">
                  <h4>{routine.name}</h4>
                  <span className="routine-type">{routine.type.replace(/_/g, ' ')}</span>
                </div>

                <div className="routine-details">
                  <div className="detail">
                    <label>Days</label>
                    <span>{formatDayPattern(routine.dayPattern.daysOfWeek)}</span>
                  </div>
                  <div className="detail">
                    <label>Time</label>
                    <span>
                      {formatTime(routine.timeWindow.startHour, routine.timeWindow.startMinute)}
                      {' '}± {routine.timeWindow.flexibilityMinutes}m
                    </span>
                  </div>
                  {routine.typicalDuration && (
                    <div className="detail">
                      <label>Duration</label>
                      <span>{routine.typicalDuration} min</span>
                    </div>
                  )}
                  {routine.typicalTravelMode && (
                    <div className="detail">
                      <label>Mode</label>
                      <span>{routine.typicalTravelMode}</span>
                    </div>
                  )}
                </div>

                <div className="routine-footer">
                  <span className="occurrences">{routine.occurrences} occurrences</span>
                  <span className="probability">{Math.round(routine.probability * 100)}% confidence</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderStats = () => {
    if (!stats) return null;

    return (
      <div className="stats-view">
        <div className="stats-grid">
          <div className="stat-card">
            <h4>Total Places</h4>
            <div className="stat-value">{stats.totalPlaces}</div>
            <div className="stat-breakdown">
              <span>{stats.identifiedPlaces} identified</span>
              <span>{stats.unknownPlaces} unknown</span>
            </div>
          </div>

          <div className="stat-card">
            <h4>Key Places</h4>
            <div className="key-places">
              <div className={`key-place ${stats.homeIdentified ? 'identified' : ''}`}>
                Home {stats.homeIdentified ? '✓' : '✗'}
              </div>
              <div className={`key-place ${stats.workIdentified ? 'identified' : ''}`}>
                Work {stats.workIdentified ? '✓' : '✗'}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <h4>Activity</h4>
            <div className="stat-value">{stats.totalVisits}</div>
            <div className="stat-label">Total Visits</div>
            <div className="stat-secondary">{stats.totalDwellHours}h total dwell time</div>
          </div>

          <div className="stat-card">
            <h4>Routines</h4>
            <div className="stat-value">{stats.learnedRoutines}</div>
            <div className="stat-label">Learned Patterns</div>
          </div>
        </div>

        <div className="top-places">
          <h3>Top Places</h3>
          <div className="places-list">
            {stats.topPlaces.map((place, index) => (
              <div key={index} className="top-place-item">
                <span className="rank">{index + 1}</span>
                <div className="place-info">
                  <span className="name">{place.name}</span>
                  {place.type && <span className="type">{formatPlaceType(place.type)}</span>}
                </div>
                <div className="place-stats">
                  <span>{place.visits} visits</span>
                  <span>{place.avgDwellMinutes}m avg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="location-page loading">Loading location intelligence...</div>;
  }

  return (
    <div className="location-page">
      <div className="page-header">
        <h1>Location Intelligence</h1>
        <p>Contextual understanding from places, movement, and routines</p>
      </div>

      <div className="tabs">
        <button
          className={activeTab === 'context' ? 'active' : ''}
          onClick={() => setActiveTab('context')}
        >
          Current Context
        </button>
        <button
          className={activeTab === 'places' ? 'active' : ''}
          onClick={() => setActiveTab('places')}
        >
          Places ({places.length})
        </button>
        <button
          className={activeTab === 'routines' ? 'active' : ''}
          onClick={() => setActiveTab('routines')}
        >
          Routines ({routines.length})
        </button>
        <button
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => setActiveTab('stats')}
        >
          Statistics
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'context' && renderContext()}
        {activeTab === 'places' && renderPlaces()}
        {activeTab === 'routines' && renderRoutines()}
        {activeTab === 'stats' && renderStats()}
      </div>
    </div>
  );
};

export default Location;
