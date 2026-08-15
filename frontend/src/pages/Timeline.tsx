import { useEffect, useState } from 'react';
import { timelineApi, type TimelineEvent } from '../services/api';
import { Clock, MapPin, Bell, Calendar } from 'lucide-react';
import './Timeline.css';

function Timeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'today' | 'week' | 'all'>('today');

  useEffect(() => {
    loadTimeline();
  }, [filter]);

  const loadTimeline = async () => {
    try {
      setLoading(true);
      let response;
      
      if (filter === 'today') {
        response = await timelineApi.getToday();
      } else if (filter === 'week') {
        response = await timelineApi.getWeek();
      } else {
        response = await timelineApi.getAll({ limit: 100 });
      }
      
      setEvents(response.data.data);
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const groupEventsByDate = (events: TimelineEvent[]) => {
    const groups: { [date: string]: TimelineEvent[] } = {};
    
    events.forEach(event => {
      const date = new Date(event.timestamp).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(event);
    });
    
    return Object.entries(groups).sort((a, b) => 
      new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  };

  const getEventIcon = (source: string) => {
    switch (source) {
      case 'calendar':
        return <Calendar size={16} />;
      case 'location':
        return <MapPin size={16} />;
      case 'notification':
        return <Bell size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'var(--accent-success)';
    if (score >= 0.6) return 'var(--accent-warning)';
    return 'var(--text-muted)';
  };

  if (loading) {
    return (
      <div className="timeline-page">
        <div className="timeline-header">
          <div className="skeleton" style={{ width: '200px', height: '40px' }}></div>
        </div>
        <div className="timeline-content">
          <div className="skeleton" style={{ width: '100%', height: '400px' }}></div>
        </div>
      </div>
    );
  }

  const groupedEvents = groupEventsByDate(events);

  return (
    <div className="timeline-page">
      <div className="timeline-header">
        <div>
          <h1>Timeline</h1>
          <p className="subtitle">Automatic reconstruction of your day</p>
        </div>

        <div className="timeline-filters">
          <button 
            className={`filter-btn ${filter === 'today' ? 'active' : ''}`}
            onClick={() => setFilter('today')}
          >
            Today
          </button>
          <button 
            className={`filter-btn ${filter === 'week' ? 'active' : ''}`}
            onClick={() => setFilter('week')}
          >
            This Week
          </button>
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
        </div>
      </div>

      <div className="timeline-content">
        {groupedEvents.length === 0 ? (
          <div className="empty-timeline">
            <Clock size={48} />
            <h3>No events yet</h3>
            <p>Your timeline will appear here as events are processed</p>
          </div>
        ) : (
          groupedEvents.map(([date, dateEvents]) => (
            <div key={date} className="timeline-day">
              <div className="day-header">
                <div className="day-date">
                  {formatDate(dateEvents[0].timestamp)}
                </div>
                <div className="day-count">{dateEvents.length} events</div>
              </div>

              <div className="timeline-track">
                {dateEvents.map((event, idx) => (
                  <div key={idx} className="timeline-event">
                    <div className="event-time">
                      {formatTime(event.timestamp)}
                    </div>
                    
                    <div className="event-indicator">
                      <div className="event-dot"></div>
                      {idx < dateEvents.length - 1 && <div className="event-line"></div>}
                    </div>

                    <div className="event-card">
                      <div className="event-header">
                        <div className="event-icon">
                          {getEventIcon(event.event.source)}
                        </div>
                        <div className="event-title">{event.event.event}</div>
                        {event.intervention && (
                          <div className="event-badge intervention-badge">
                            <Bell size={12} />
                            Intervention
                          </div>
                        )}
                      </div>

                      <div className="event-meta">
                        <span className="event-source">{event.event.source}</span>
                        <span 
                          className="event-confidence"
                          style={{ color: getConfidenceColor(event.confidence.finalScore) }}
                        >
                          {Math.round(event.confidence.finalScore * 100)}% confidence
                        </span>
                      </div>

                      {event.event.entities.length > 0 && (
                        <div className="event-entities">
                          {event.event.entities.slice(0, 5).map((entity, idx) => (
                            <span key={idx} className="entity-tag">{entity}</span>
                          ))}
                          {event.event.entities.length > 5 && (
                            <span className="entity-tag more">
                              +{event.event.entities.length - 5} more
                            </span>
                          )}
                        </div>
                      )}

                      {event.event.metadata?.text && (
                        <div className="event-description">
                          {String(event.event.metadata.text).substring(0, 150)}
                          {String(event.event.metadata.text).length > 150 && '...'}
                        </div>
                      )}

                      {event.intervention && (
                        <div className="event-intervention">
                          <div className="intervention-title">
                            {event.intervention.title}
                          </div>
                          <div className="intervention-summary">
                            {event.intervention.summary}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Timeline;
