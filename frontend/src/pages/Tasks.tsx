import { useEffect, useState } from 'react';
import { tasksApi, type Task } from '../services/api';
import { Plus, Trash2, CheckCircle2, Circle, Sparkles, X } from 'lucide-react';
import './Tasks.css';

export function Tasks() {
  const [, setTasks] = useState<Task[]>([]);
  const [eventGroups, setEventGroups] = useState<Record<string, Task[]>>({});
  const [summary, setSummary] = useState<any>(null);
  const [, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskContext, setNewTaskContext] = useState('Doctor Appointment — Dr. Priya Nair');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('high');

  useEffect(() => {
    loadTasks();
  }, [filter]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { priority: filter } : {};
      const response = await tasksApi.getAll(params);
      setTasks(response.data.data);
      setEventGroups(response.data.eventGroups || {});
      setSummary(response.data.summary || {});
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (id: string, currentCompleted?: boolean) => {
    try {
      await tasksApi.update(id, { completed: !currentCompleted });
      loadTasks();
    } catch (e) {
      console.error('Error updating task:', e);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await tasksApi.delete(id);
      loadTasks();
    } catch (e) {
      console.error('Error deleting task:', e);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      await tasksApi.create({
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        eventContext: newTaskContext,
        category: newTaskPriority === 'high' ? 'MUST_DO' : newTaskPriority === 'medium' ? 'SHOULD_DO' : 'NICE_TO_DO',
      });
      setNewTaskTitle('');
      setShowAddModal(false);
      loadTasks();
    } catch (e) {
      console.error('Error creating task:', e);
    }
  };

  return (
    <div className="tasks-screen">
      <div className="tasks-header">
        <div>
          <h2>Context-Aware Tasks & Preparation</h2>
          <p className="subtitle">Automatically grouped around your appointments and commitments</p>
        </div>

        <div className="header-actions">
          <button className="add-task-btn" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Task
          </button>
        </div>
      </div>

      {/* Summary Badges Bar */}
      {summary && (
        <div className="summary-strip">
          <div className="badge-item red" onClick={() => setFilter('high')}>
            <strong>🔴 {summary.mustDo}</strong> <span>Must Do</span>
          </div>
          <div className="badge-item yellow" onClick={() => setFilter('medium')}>
            <strong>🟡 {summary.shouldDo}</strong> <span>Should Do</span>
          </div>
          <div className="badge-item green" onClick={() => setFilter('low')}>
            <strong>🟢 {summary.niceToDo}</strong> <span>Nice To Do</span>
          </div>
          <div className="badge-item neutral" onClick={() => setFilter('all')}>
            <strong>✅ {summary.completed}</strong> <span>Completed</span>
          </div>
        </div>
      )}

      {/* Grouped Task List */}
      <div className="event-groups-container">
        {Object.keys(eventGroups).map(groupName => (
          <div key={groupName} className="event-group-card">
            <div className="group-header">
              <Sparkles size={16} className="text-primary" />
              <h3>{groupName}</h3>
              <span className="count-pill">{eventGroups[groupName].length} items</span>
            </div>

            <div className="group-tasks-list">
              {eventGroups[groupName].map(task => (
                <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                  <button 
                    className="check-toggle" 
                    onClick={() => handleToggleComplete(task.id, task.completed)}
                  >
                    {task.completed ? <CheckCircle2 size={20} className="text-success" /> : <Circle size={20} />}
                  </button>

                  <div className="task-body">
                    <div className="task-title-row">
                      <span className="task-title">{task.title}</span>
                      <span className={`priority-pill ${task.priority}`}>
                        {task.priority === 'high' ? '🔴 MUST DO' : task.priority === 'medium' ? '🟡 SHOULD DO' : '🟢 NICE TO DO'}
                      </span>
                    </div>
                    {task.description && <p className="task-desc">{task.description}</p>}
                  </div>

                  <button className="delete-task-btn" onClick={() => handleDeleteTask(task.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="task-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Contextual Task</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateTask}>
              <div className="input-group">
                <label>Task Title</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Bring Insurance Card & ID Proof" 
                  value={newTaskTitle} 
                  onChange={e => setNewTaskTitle(e.target.value)} 
                />
              </div>

              <div className="input-group">
                <label>Linked Event / Context</label>
                <input 
                  type="text" 
                  placeholder="e.g. Doctor Appointment — Dr. Priya Nair" 
                  value={newTaskContext} 
                  onChange={e => setNewTaskContext(e.target.value)} 
                />
              </div>

              <div className="input-group">
                <label>Priority</label>
                <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)}>
                  <option value="high">🔴 High (Must Do Before Event)</option>
                  <option value="medium">🟡 Medium (Should Do)</option>
                  <option value="low">🟢 Low (Nice to Do)</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default Tasks;
