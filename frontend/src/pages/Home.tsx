import { useEffect, useState } from 'react';
import { interventionsApi, tasksApi, timelineApi, stateApi, type Intervention, type Task, type SensorState } from '../services/api';
import { AlertTriangle, Clock, CheckCircle, MapPin, Battery, Focus } from 'lucide-react';
import './Home.css';

function Home() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [sensorState, setSensorState] = useState<SensorState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load high-priority interventions
      const interventionsRes = await interventionsApi.getAll({ priority: 'high', limit: 3 });
      setInterventions(interventionsRes.data.data);

      // Load high-priority tasks
      const tasksRes = await tasksApi.getHighPriority();
      setTasks(tasksRes.data.data.slice(0, 5));

      // Load recent timeline events
      const timelineRes = await timelineApi.getToday();
      setRecentEvents(timelineRes.data.data.slice(0, 5));

      // Load sensor state
      const stateRes = await stateApi.get();
      setSensorState(stateRes.data.data);
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissIntervention = async (id: string) => {
    try {
      await interventionsApi.dismiss(id);
      setInterventions(interventions.filter(i => i.id !== id));
    } catch (error) {
      console.error('Error dismissing intervention:', error);
    }
  };

  const handleSnoozeIntervention = async (id: string) => {
    try {
      await interventionsApi.snooze(id, 60); // Snooze for 1 hour
      setInterventions(interventions.filter(i => i.id !== id));
    } catch (error) {
      console.error('Error snoozing intervention:', error);
    }
  };

  const getPriorityColor = (score: number) => {
    if (score >= 0.80) return 'var(--accent-danger)';
    if (score >= 0.65) return 'var(--accent-warning)';
    return 'var(--accent-success)';
  };

  const getPriorityLabel = (score: number) => {
    if (score >= 0.80) return 'HIGH';
    if (score >= 0.65) return 'MEDIUM';
    return 'LOW';
  };

  if (loading) {
    return (
      <div className="home-page">
        <div className="home-header">
          <div className="skeleton" style={{ width: '200px', height: '40px' }}></div>
          <div className="skeleton" style={{ width: '300px', height: '24px', marginTop: '0.5rem' }}></div>
        </div>
        <div className="home-content">
          <div className="skeleton" style={{ width: '100%', height: '200px' }}></div>
        </div>
      </div>
    );
  }

  const primaryIntervention = interventions[0];

  return (
    <div className="home-page">
      {/* Header */}
      <div className="home-header">
        <div>
          <h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'} 👋</h1>
          <p className="subtitle">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Sensor state indicators */}
        {sensorState && (
          <div className="sensor-indicators">
            <div className="sensor-item">
              <Battery size={16} />
              <span>{Math.round(sensorState.batteryLevel * 100)}%</span>
            </div>
            <div className="sensor-item">
              <Focus size={16} />
              <span>{sensorState.focusState}</span>
            </div>
            {sensorState.location.placeLabel && (
              <div className="sensor-item">
                <MapPin size={16} />
                <span>{sensorState.location.placeLabel}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="home-content">
        {/* Primary Intervention Card */}
        {primaryIntervention ? (
          <div className="primary-intervention-card">
            <div className="intervention-header">
              <div className="intervention-icon">
                <AlertTriangle size={24} />
              </div>
              <div className="intervention-meta">
                <div 
                  className="intervention-priority"
                  style={{ color: getPriorityColor(primaryIntervention.score) }}
                >
                  {getPriorityLabel(primaryIntervention.score)} PRIORITY
                </div>
                <div className="intervention-confidence">
                  {Math.round(primaryIntervention.score * 100)}% confidence
                </div>
              </div>
            </div>

            <h2 className="intervention-title">{primaryIntervention.title}</h2>
            <p className="intervention-summary">{primaryIntervention.summary}</p>

            <div className="intervention-reason">
              <h4>Why am I seeing this?</h4>
              <p>{primaryIntervention.reason}</p>
            </div>

            <div className="intervention-actions">
              <button 
                className="btn-primary"
                onClick={() => handleDismissIntervention(primaryIntervention.id)}
              >
                I'll take it
              </button>
              <button 
                className="btn-secondary"
                onClick={() => handleSnoozeIntervention(primaryIntervention.id)}
              >
                Not needed
              </button>
            </div>
          </div>
        ) : (
          <div className="no-interventions-card">
            <CheckCircle size={48} />
            <h3>All caught up</h3>
            <p>No urgent interventions right now</p>
          </div>
        )}

        {/* Quick View Grid */}
        <div className="quick-view-grid">
          {/* High Priority Tasks */}
          <div className="quick-view-card">
            <h3>
              <CheckCircle size={20} />
              High Priority Tasks
            </h3>
            {tasks.length > 0 ? (
              <ul className="task-list">
                {tasks.map((task) => (
                  <li key={task.id} className="task-item">
                    <div className="task-content">
                      <div className="task-title">{task.title}</div>
                      <div className="task-meta">
                        {task.dueDate && (
                          <span className="task-due">
                            <Clock size={12} />
                            {new Date(task.dueDate).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No high-priority tasks</p>
            )}
          </div>

          {/* Recent Activity */}
          <div className="quick-view-card">
            <h3>
              <Clock size={20} />
              Recent Activity
            </h3>
            {recentEvents.length > 0 ? (
              <ul className="activity-list">
                {recentEvents.map((event, idx) => (
                  <li key={idx} className="activity-item">
                    <div className="activity-dot"></div>
                    <div className="activity-content">
                      <div className="activity-title">{event.event.event}</div>
                      <div className="activity-time">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No recent activity</p>
            )}
          </div>

          {/* Other Interventions */}
          {interventions.length > 1 && (
            <div className="quick-view-card">
              <h3>
                <AlertTriangle size={20} />
                Other Alerts
              </h3>
              <ul className="intervention-list">
                {interventions.slice(1).map((intervention) => (
                  <li key={intervention.id} className="intervention-item">
                    <div className="intervention-content">
                      <div className="intervention-title-small">{intervention.title}</div>
                      <div className="intervention-score">
                        {Math.round(intervention.score * 100)}%
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
