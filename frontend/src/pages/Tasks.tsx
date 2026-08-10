import { useEffect, useState } from 'react';
import { tasksApi, type Task } from '../services/api';
import { CheckSquare, Clock, AlertCircle, Sparkles } from 'lucide-react';
import './Tasks.css';

function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    loadTasks();
  }, [filter]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { priority: filter } : {};
      const response = await tasksApi.getAll(params);
      setTasks(response.data.data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'var(--accent-danger)';
      case 'medium':
        return 'var(--accent-warning)';
      case 'low':
        return 'var(--accent-success)';
      default:
        return 'var(--text-muted)';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertCircle size={20} />;
      case 'medium':
        return <Clock size={20} />;
      case 'low':
        return <CheckSquare size={20} />;
      default:
        return <CheckSquare size={20} />;
    }
  };

  const formatDueDate = (dueDate?: string) => {
    if (!dueDate) return null;
    
    const date = new Date(dueDate);
    const now = new Date();
    const diffHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 0) {
      return { text: 'Overdue', urgent: true };
    } else if (diffHours < 6) {
      return { text: `In ${Math.round(diffHours)}h`, urgent: true };
    } else if (diffHours < 24) {
      return { text: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), urgent: false };
    } else {
      return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), urgent: false };
    }
  };

  if (loading) {
    return (
      <div className="tasks-page">
        <div className="tasks-header">
          <div className="skeleton" style={{ width: '200px', height: '40px' }}></div>
        </div>
        <div className="tasks-content">
          <div className="skeleton" style={{ width: '100%', height: '400px' }}></div>
        </div>
      </div>
    );
  }

  const groupedTasks = {
    high: tasks.filter(t => t.priority === 'high'),
    medium: tasks.filter(t => t.priority === 'medium'),
    low: tasks.filter(t => t.priority === 'low'),
  };

  return (
    <div className="tasks-page">
      <div className="tasks-header">
        <div>
          <h1>Tasks</h1>
          <p className="subtitle">
            <Sparkles size={16} />
            Automatically derived from your context
          </p>
        </div>

        <div className="tasks-filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({tasks.length})
          </button>
          <button 
            className={`filter-btn ${filter === 'high' ? 'active' : ''}`}
            onClick={() => setFilter('high')}
          >
            High ({groupedTasks.high.length})
          </button>
          <button 
            className={`filter-btn ${filter === 'medium' ? 'active' : ''}`}
            onClick={() => setFilter('medium')}
          >
            Medium ({groupedTasks.medium.length})
          </button>
          <button 
            className={`filter-btn ${filter === 'low' ? 'active' : ''}`}
            onClick={() => setFilter('low')}
          >
            Low ({groupedTasks.low.length})
          </button>
        </div>
      </div>

      <div className="tasks-content">
        {tasks.length === 0 ? (
          <div className="empty-tasks">
            <CheckSquare size={48} />
            <h3>No tasks yet</h3>
            <p>Tasks will be automatically derived from your context and events</p>
          </div>
        ) : (
          <div className="tasks-list">
            {(filter === 'all' ? 
              [...groupedTasks.high, ...groupedTasks.medium, ...groupedTasks.low] : 
              tasks
            ).map((task) => {
              const dueInfo = formatDueDate(task.dueDate);
              
              return (
                <div 
                  key={task.id} 
                  className="task-card"
                  style={{ borderLeftColor: getPriorityColor(task.priority) }}
                >
                  <div className="task-header">
                    <div 
                      className="task-priority-badge"
                      style={{ backgroundColor: getPriorityColor(task.priority) }}
                    >
                      {getPriorityIcon(task.priority)}
                      <span>{task.priority}</span>
                    </div>
                    
                    {dueInfo && (
                      <div className={`task-due ${dueInfo.urgent ? 'urgent' : ''}`}>
                        <Clock size={14} />
                        {dueInfo.text}
                      </div>
                    )}
                  </div>

                  <h3 className="task-title">{task.title}</h3>
                  <p className="task-description">{task.description}</p>

                  {task.context.length > 0 && (
                    <div className="task-context">
                      <div className="context-label">Related to:</div>
                      <div className="context-tags">
                        {task.context.map((ctx, idx) => (
                          <span key={idx} className="context-tag">{ctx}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="task-footer">
                    <div className="task-derived">
                      <Sparkles size={14} />
                      Derived from {task.derivedFrom.length} entities
                    </div>
                    <div className="task-actions">
                      <button className="task-action-btn secondary">
                        View Context
                      </button>
                      <button className="task-action-btn primary">
                        Mark Complete
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

export default Tasks;
