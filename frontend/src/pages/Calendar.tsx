/**
 * Calendar Intelligence Page
 * 
 * Displays calendar with intelligent conflict detection, travel analysis, and feasibility scoring
 */

import React, { useState, useEffect } from 'react';
import './Calendar.css';

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location?: {
    name?: string;
  };
  description?: string;
}

interface EnrichedEvent {
  event: CalendarEvent;
  eventType?: string;
  eventTypeConfidence?: number;
  place?: {
    name: string;
    placeType: string;
  };
  travelRequirement?: {
    required: boolean;
    estimatedDurationMin: number;
    requiredDepartureTime: string;
    mode: string;
    distanceKm: number;
  };
  preparation?: {
    required: boolean;
    estimatedMinutes: number;
    items: Array<{
      type: string;
      description: string;
      completed: boolean;
    }>;
  };
  requiredDocuments: Array<{
    type: string;
    name: string;
    required: boolean;
    available: boolean;
  }>;
  conflicts: Array<{
    conflictId: string;
    type: string;
    severity: string;
    description: string;
    reason: string;
  }>;
  importance: {
    score: number;
  };
  flexibility: {
    score: number;
  };
}

interface ScheduleFeasibility {
  date: string;
  score: number;
  events: string[];
  conflicts: any[];
  warnings: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  analysis: {
    totalEvents: number;
    totalConflicts: number;
    totalTravelTimeMin: number;
    totalPreparationMin: number;
    availableBufferMin: number;
  };
}

const Calendar: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [events, setEvents] = useState<EnrichedEvent[]>([]);
  const [feasibility, setFeasibility] = useState<ScheduleFeasibility | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  useEffect(() => {
    loadSchedule();
  }, [selectedDate, viewMode]);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const endDate = viewMode === 'week'
        ? new Date(new Date(selectedDate).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : selectedDate;

      const response = await fetch(
        `http://localhost:3001/api/calendar/schedule?startDate=${selectedDate}&endDate=${endDate}`
      );
      
      if (!response.ok) throw new Error('Failed to load schedule');
      
      const data = await response.json();
      setEvents(data.analysis.events || []);
      
      // Get day-specific feasibility
      if (viewMode === 'day' && data.analysis.dailyAnalysis?.[0]) {
        setFeasibility(data.analysis.dailyAnalysis[0]);
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFeasibilityColor = (score: number): string => {
    if (score >= 0.9) return '#10b981'; // Green
    if (score >= 0.75) return '#3b82f6'; // Blue
    if (score >= 0.6) return '#f59e0b'; // Orange
    if (score >= 0.4) return '#ef4444'; // Red
    return '#991b1b'; // Dark red
  };

  const getFeasibilityLabel = (score: number): string => {
    if (score >= 0.9) return 'Excellent';
    if (score >= 0.75) return 'Good';
    if (score >= 0.6) return 'Fair';
    if (score >= 0.4) return 'Poor';
    return 'Critical';
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'LOW': return '#3b82f6';
      case 'MEDIUM': return '#f59e0b';
      case 'HIGH': return '#ef4444';
      case 'CRITICAL': return '#991b1b';
      default: return '#6b7280';
    }
  };

  const formatTime = (isoString: string): string => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const navigateDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <h1>Calendar Intelligence</h1>
        <p className="calendar-subtitle">
          Intelligent schedule analysis with conflict detection and travel estimation
        </p>
      </div>

      {/* Date Navigation */}
      <div className="calendar-controls">
        <div className="date-navigation">
          <button onClick={() => navigateDate(-1)} className="nav-button">
            ← Previous
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-input"
          />
          <button onClick={() => navigateDate(1)} className="nav-button">
            Next →
          </button>
        </div>

        <div className="view-toggle">
          <button
            onClick={() => setViewMode('day')}
            className={`toggle-button ${viewMode === 'day' ? 'active' : ''}`}
          >
            Day
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`toggle-button ${viewMode === 'week' ? 'active' : ''}`}
          >
            Week
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading schedule...</p>
        </div>
      ) : (
        <>
          {/* Feasibility Score */}
          {feasibility && viewMode === 'day' && (
            <div className="feasibility-card">
              <div className="feasibility-header">
                <h2>Schedule Feasibility</h2>
                <div 
                  className="feasibility-score"
                  style={{ backgroundColor: getFeasibilityColor(feasibility.score) }}
                >
                  {Math.round(feasibility.score * 100)}%
                </div>
              </div>
              
              <div className="feasibility-label">
                {getFeasibilityLabel(feasibility.score)}
              </div>

              <div className="feasibility-metrics">
                <div className="metric">
                  <span className="metric-label">Events</span>
                  <span className="metric-value">{feasibility.analysis.totalEvents}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Travel Time</span>
                  <span className="metric-value">
                    {formatDuration(feasibility.analysis.totalTravelTimeMin)}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Buffer Time</span>
                  <span className="metric-value">
                    {formatDuration(feasibility.analysis.availableBufferMin)}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Conflicts</span>
                  <span className="metric-value conflict">
                    {feasibility.analysis.totalConflicts}
                  </span>
                </div>
              </div>

              {/* Warnings */}
              {feasibility.warnings.length > 0 && (
                <div className="warnings-section">
                  <h3>⚠️ Schedule Warnings</h3>
                  {feasibility.warnings.map((warning, idx) => (
                    <div 
                      key={idx}
                      className="warning-item"
                      style={{ borderLeftColor: getSeverityColor(warning.severity) }}
                    >
                      <div className="warning-type">{warning.type.replace(/_/g, ' ')}</div>
                      <div className="warning-description">{warning.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Events List */}
          <div className="events-section">
            <h2>
              {viewMode === 'day' 
                ? `Events for ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
                : 'Week View'
              }
            </h2>

            {events.length === 0 ? (
              <div className="empty-state">
                <p>No events scheduled</p>
              </div>
            ) : (
              <div className="events-list">
                {events.map((enrichedEvent) => (
                  <div key={enrichedEvent.event.id} className="event-card">
                    {/* Event Header */}
                    <div className="event-header">
                      <div className="event-time">
                        {formatTime(enrichedEvent.event.startTime)} - {formatTime(enrichedEvent.event.endTime)}
                      </div>
                      <div className="event-badges">
                        {enrichedEvent.eventType && (
                          <span className="event-type-badge">
                            {enrichedEvent.eventType.replace(/_/g, ' ')}
                          </span>
                        )}
                        {enrichedEvent.importance.score >= 0.8 && (
                          <span className="importance-badge high">High Priority</span>
                        )}
                      </div>
                    </div>

                    {/* Event Title */}
                    <h3 className="event-title">{enrichedEvent.event.title}</h3>

                    {/* Location */}
                    {enrichedEvent.place && (
                      <div className="event-location">
                        📍 {enrichedEvent.place.name}
                        {enrichedEvent.place.placeType !== 'UNKNOWN' && (
                          <span className="place-type"> ({enrichedEvent.place.placeType})</span>
                        )}
                      </div>
                    )}

                    {/* Travel Requirements */}
                    {enrichedEvent.travelRequirement?.required && (
                      <div className="travel-section">
                        <div className="travel-header">🚗 Travel Required</div>
                        <div className="travel-details">
                          <div className="travel-item">
                            <span>Mode:</span>
                            <span>{enrichedEvent.travelRequirement.mode}</span>
                          </div>
                          <div className="travel-item">
                            <span>Duration:</span>
                            <span>{formatDuration(enrichedEvent.travelRequirement.estimatedDurationMin)}</span>
                          </div>
                          <div className="travel-item">
                            <span>Distance:</span>
                            <span>{enrichedEvent.travelRequirement.distanceKm.toFixed(1)} km</span>
                          </div>
                          <div className="travel-item departure-time">
                            <span>Depart by:</span>
                            <span className="highlight">
                              {formatTime(enrichedEvent.travelRequirement.requiredDepartureTime)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Preparation */}
                    {enrichedEvent.preparation?.required && (
                      <div className="preparation-section">
                        <div className="preparation-header">
                          ✓ Preparation Required ({formatDuration(enrichedEvent.preparation.estimatedMinutes)})
                        </div>
                        {enrichedEvent.preparation.items.length > 0 && (
                          <ul className="preparation-list">
                            {enrichedEvent.preparation.items.slice(0, 3).map((item, idx) => (
                              <li key={idx} className={item.completed ? 'completed' : ''}>
                                {item.description}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Required Documents */}
                    {enrichedEvent.requiredDocuments.filter(d => d.required).length > 0 && (
                      <div className="documents-section">
                        <div className="documents-header">📄 Required Documents</div>
                        <div className="documents-list">
                          {enrichedEvent.requiredDocuments
                            .filter(d => d.required)
                            .map((doc, idx) => (
                              <div key={idx} className={`document-item ${doc.available ? 'available' : 'missing'}`}>
                                <span className="document-name">{doc.name}</span>
                                <span className="document-status">
                                  {doc.available ? '✓ Available' : '✗ Missing'}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Conflicts */}
                    {enrichedEvent.conflicts.length > 0 && (
                      <div className="conflicts-section">
                        <div className="conflicts-header">⚠️ Conflicts Detected</div>
                        {enrichedEvent.conflicts.map((conflict) => (
                          <div 
                            key={conflict.conflictId}
                            className="conflict-item"
                            style={{ borderLeftColor: getSeverityColor(conflict.severity) }}
                          >
                            <div className="conflict-type">
                              {conflict.type.replace(/_/g, ' ')} - {conflict.severity}
                            </div>
                            <div className="conflict-description">{conflict.description}</div>
                            <div className="conflict-reason">{conflict.reason}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Scores */}
                    <div className="event-scores">
                      <div className="score-item">
                        <span className="score-label">Importance:</span>
                        <div className="score-bar">
                          <div 
                            className="score-fill importance"
                            style={{ width: `${enrichedEvent.importance.score * 100}%` }}
                          />
                        </div>
                        <span className="score-value">{Math.round(enrichedEvent.importance.score * 100)}%</span>
                      </div>
                      <div className="score-item">
                        <span className="score-label">Flexibility:</span>
                        <div className="score-bar">
                          <div 
                            className="score-fill flexibility"
                            style={{ width: `${enrichedEvent.flexibility.score * 100}%` }}
                          />
                        </div>
                        <span className="score-value">{Math.round(enrichedEvent.flexibility.score * 100)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Calendar;
