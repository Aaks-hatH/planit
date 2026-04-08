import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Plus, Trash2, Calendar, User, AlertCircle } from 'lucide-react';
import { taskAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function Tasks({ eventId, socket }) {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: '',
    priority: 'medium'
  });

  useEffect(() => {
    loadTasks();
    
    if (socket) {
      socket.on('tasks_updated', ({ tasks: newTasks }) => {
        setTasks(newTasks);
        calculateStats(newTasks);
      });
    }

    return () => {
      if (socket) socket.off('tasks_updated');
    };
  }, [eventId, socket]);

  const loadTasks = async () => {
    try {
      const res = await taskAPI.getAll(eventId);
      setTasks(res.data.tasks);
      setStats(res.data.stats);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const calculateStats = (taskList) => {
    const total = taskList.length;
    const completed = taskList.filter(t => t.completed).length;
    setStats({ total, completed, pending: total - completed });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await taskAPI.create(eventId, formData);
      setFormData({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'medium' });
      setShowForm(false);
      toast.success('Task created');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create task');
    }
  };

  const toggleTask = async (taskId) => {
    try {
      await taskAPI.toggle(eventId, taskId);
    } catch (error) {
      toast.error('Failed to toggle task');
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      await taskAPI.delete(eventId, taskId);
      toast.success('Task deleted');
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-amber-600 bg-amber-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-neutral-600 bg-neutral-50';
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div className="h-full flex flex-col">
      {/* Stats */}
      <div className="p-4 border-b border-neutral-100">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-neutral-900">{stats.total}</div>
            <div className="text-xs text-neutral-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-xs text-neutral-500">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-xs text-neutral-500">Pending</div>
          </div>
        </div>

        {stats.total > 0 && (
          <div className="mt-3">
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(stats.completed / stats.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
        <h3 className="font-semibold text-neutral-900">Tasks</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-sm btn-primary"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="p-4 border-b border-neutral-100 bg-neutral-50">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              required
              placeholder="Task title"
              className="input input-sm"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            <textarea
              placeholder="Description (optional)"
              className="input input-sm resize-none"
              rows="2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Assign to (optional)"
                className="input input-sm"
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
              />
              <input
                type="date"
                className="input input-sm"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <select
                className="input input-sm flex-1"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <button type="submit" className="btn btn-sm btn-primary">Create</button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {sortedTasks.length === 0 ? (
          <div className="text-center text-neutral-400 py-12">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No tasks yet</p>
            <p className="text-sm mt-1">Create your first task to get started</p>
          </div>
        ) : (
          sortedTasks.map(task => (
            <div
              key={task.id}
              className={`p-3 rounded-lg border ${
                task.completed ? 'bg-neutral-50 border-neutral-200' : 'bg-white border-neutral-200'
              } hover:shadow-sm transition-shadow`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleTask(task.id)}
                  className="flex-shrink-0 mt-0.5 hover:scale-110 transition-transform"
                >
                  {task.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-neutral-300" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={`font-medium ${task.completed ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>
                      {task.title}
                    </h4>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="flex-shrink-0 text-neutral-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {task.description && (
                    <p className="text-sm text-neutral-500 mt-1">{task.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    {task.assignedTo && (
                      <span className="text-xs text-neutral-500 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {task.assignedTo}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="text-xs text-neutral-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {task.completed && task.completedBy && (
                    <p className="text-xs text-neutral-400 mt-2">
                      Completed by {task.completedBy} • {new Date(task.completedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
