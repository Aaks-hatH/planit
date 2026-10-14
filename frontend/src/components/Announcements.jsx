import { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, AlertCircle, Bell } from 'lucide-react';
import { announcementAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function Announcements({ eventId, socket, isOrganizer }) {
  const [announcements, setAnnouncements] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    important: false
  });

  useEffect(() => {
    loadAnnouncements();

    if (socket) {
      socket.on('announcement_created', ({ announcement }) => {
        setAnnouncements(prev => [announcement, ...prev]);
        toast.success('New announcement', { icon: '📢' });
      });

      socket.on('announcements_updated', ({ announcements: newAnnouncements }) => {
        setAnnouncements(newAnnouncements);
      });
    }

    return () => {
      if (socket) {
        socket.off('announcement_created');
        socket.off('announcements_updated');
      }
    };
  }, [eventId, socket]);

  const loadAnnouncements = async () => {
    try {
      const res = await announcementAPI.getAll(eventId);
      setAnnouncements(res.data.announcements);
    } catch (error) {
      console.error('Failed to load announcements:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await announcementAPI.create(eventId, formData);
      setFormData({ title: '', content: '', important: false });
      setShowForm(false);
      toast.success('Announcement posted');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create announcement');
    }
  };

  const deleteAnnouncement = async (announcementId) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await announcementAPI.delete(eventId, announcementId);
      toast.success('Announcement deleted');
    } catch (error) {
      toast.error('Failed to delete announcement');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-neutral-600" />
          <h3 className="font-semibold text-neutral-900">Announcements</h3>
        </div>
        {isOrganizer && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn btn-sm btn-primary"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && isOrganizer && (
        <div className="p-4 border-b border-neutral-100 bg-neutral-50">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              required
              placeholder="Announcement title"
              className="input input-sm"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            <textarea
              required
              placeholder="What do you want to announce?"
              className="input input-sm resize-none"
              rows="4"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.important}
                  onChange={(e) => setFormData({ ...formData, important: e.target.checked })}
                  className="rounded border-neutral-300"
                />
                <span className="text-sm text-neutral-700 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Mark as important
                </span>
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-sm btn-primary">Post</button>
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

      {/* Announcements List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {announcements.length === 0 ? (
          <div className="text-center text-neutral-400 py-12">
            <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No announcements yet</p>
            {isOrganizer && (
              <p className="text-sm mt-1">Share important updates with participants</p>
            )}
          </div>
        ) : (
          announcements.map(announcement => (
            <div
              key={announcement.id}
              className={`p-4 rounded-lg border ${
                announcement.important
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-neutral-200'
              } shadow-sm`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {announcement.important && (
                    <div className="flex items-center gap-1 text-amber-600 text-sm mb-2">
                      <Bell className="w-4 h-4" />
                      <span className="font-medium">Important</span>
                    </div>
                  )}
                  <h4 className="font-semibold text-neutral-900 mb-2">{announcement.title}</h4>
                  <p className="text-neutral-700 whitespace-pre-wrap">{announcement.content}</p>
                  <div className="flex items-center gap-2 mt-3 text-sm text-neutral-500">
                    <span className="font-medium">{announcement.author}</span>
                    <span>•</span>
                    <span>{new Date(announcement.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {isOrganizer && (
                  <button
                    onClick={() => deleteAnnouncement(announcement.id)}
                    className="flex-shrink-0 text-neutral-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
