import { useEffect, useState } from 'react';
import { interventionsApi, type Intervention } from '../services/api';
import { AlertTriangle, Bell, CheckCircle, Clock, X } from 'lucide-react';
import './Interventions.css';

function Interventions() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    loadInterventions();
  }, [filter]);

  const loadInterventions = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { priority: filter } : {};
      const response = await interventionsApi.getAll(params);
      setInterventions(response.data.data);
    } catch (error) {
      console.error('Error loading interventions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await interventionsApi.dismiss(id);
      setInterventions(interventions.filter(i => i.id !== id));
    } catch (error) {
      console.error('Error dismissing intervention:', error);
    }
  };

  const handleSnooze = async (id: string) => {
    try {
      await interventionsApi.snooze(id, 60);
      setInterventions(interventions.filter(i => i.id !== id));
    } catch (error) {
      console.error('Error snoozing intervention:', error);
    }
  };

  const getPriorityInfo = (score: number) => {
    if (score >= 0.80) {
      return {
        label: 'HIGH PRIORITY',
        color: 'var(--accent-danger)',
        icon: <AlertTriangle size={20} />
      };
    } else if (score >= 0.65) {
      return {
        label: 'MEDIUM PRIORITY',
        color: 'var(--accent-warning)',
        icon: <Bell size={20} />
      };
    } else {
      return {
        label: 'LOW PRIORITY',
        color: 'var(--accent-success)',
        icon: <CheckCircle size={20} />
      };
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="interventions-page">
        <div className="interventions-header">
          <div className="skeleton" style={{ width: '200px', height: '40px' }}></div>
        </div>
        <div className="interventions-content">
          <div className="skeleton" style={{ width: '100%', height: '200px' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="interventions-page">
      <div className="interventions-header">
        <div>
          <h1>Interventions</h1>
          <p className="subtitle">Proactive alerts and recommendations</p>
        </div>

        <div className="interventions-filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${filter === 'high' ? 'active' : ''}`}
            onClick={() => setFilter('high')}
          >
            High
          </button>
          <button 
            className={`filter-btn ${filter === 'medium' ? 'active' : ''}`}
            onClick={() => setFilter('medium')}
          >
            Medium
          </button>
          <button 
            className={`filter-btn ${filter === 'low' ? 'active' : ''}`}
            onClick={() => setFilter('low')}
          >
            Low
          </button>
        </div>
      </div>

      <div className="interventions-content">
        {interventions.length === 0 ? (
          <div className="empty-interventions">
            <CheckCircle size={48} />
            <h3>All caught up!</h3>
            <p>No interventions match your current filter</p>
          </div>
        ) : (
          <div className="interventions-grid">
            {interventions.map((intervention) => {
              const priority = getPriorityInfo(intervention.score);
              
              return (
                <div key={intervention.id} className="intervention-card">
                  <button 
                    className="dismiss-btn"
                    onClick={() => handleDismiss(intervention.id)}
                    aria-label="Dismiss"
                  >
                    <X size={18} />
                  </button>

                  <div className="intervention-card-header">
                    <div 
                      className="intervention-card-icon"
                      style={{ backgroundColor: priority.color }}
                    >
                      {priority.icon}
                    </div>
                    <div className="intervention-card-meta">
                      <div 
                        className="intervention-card-priority"
                        style={{ color: priority.color }}
                      >
                        {priority.label}
                      </div>
                      <div className="intervention-card-confidence">
                        {Math.round(intervention.score * 100)}% confidence
                      </div>
                    </div>
                  </div>

                  <h3 className="intervention-card-title">{intervention.title}</h3>
                  <p className="intervention-card-summary">{intervention.summary}</p>

                  <div className="intervention-card-reason">
                    <h4>Why am I seeing this?</h4>
                    <p>{intervention.reason}</p>
                  </div>

                  <div className="intervention-card-surfaces">
                    <h4>Action Surfaces</h4>
                    <ul>
                      {intervention.surfaces.map((surface, idx) => (
                        <li key={idx}>
                          <span className="surface-type">{surface.type}</span>
                          <span className="surface-trigger">{surface.trigger}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="intervention-card-footer">
                    <div className="intervention-card-time">
                      <Clock size={14} />
                      {formatDate(intervention.createdAt)}
                    </div>
                    <div className="intervention-card-actions">
                      <button 
                        className="action-btn secondary"
                        onClick={() => handleSnooze(intervention.id)}
                      >
                        Snooze 1h
                      </button>
                      <button 
                        className="action-btn primary"
                        onClick={() => handleDismiss(intervention.id)}
                      >
                        I'll take it
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Interventions;
