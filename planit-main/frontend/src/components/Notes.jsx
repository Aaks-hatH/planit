import { useState, useEffect } from 'react';
import { StickyNote, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { noteAPI } from '../services/api';
import toast from 'react-hot-toast';

const NOTE_COLORS = [
  '#fef3c7', // yellow
  '#dbeafe', // blue
  '#fecaca', // red
  '#d1fae5', // green
  '#e9d5ff', // purple
  '#fed7aa', // orange
  '#fbcfe8'  // pink
];

export default function Notes({ eventId, socket }) {
  const [notes, setNotes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    color: NOTE_COLORS[0]
  });

  useEffect(() => {
    loadNotes();

    if (socket) {
      socket.on('notes_updated', ({ notes: newNotes }) => {
        setNotes(newNotes);
      });
    }

    return () => {
      if (socket) socket.off('notes_updated');
    };
  }, [eventId, socket]);

  const loadNotes = async () => {
    try {
      const res = await noteAPI.getAll(eventId);
      setNotes(res.data.notes);
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingNote) {
        await noteAPI.update(eventId, editingNote.id, formData);
        toast.success('Note updated');
        setEditingNote(null);
      } else {
        await noteAPI.create(eventId, formData);
        toast.success('Note created');
      }
      setFormData({ title: '', content: '', color: NOTE_COLORS[0] });
      setShowForm(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save note');
    }
  };

  const startEdit = (note) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content,
      color: note.color
    });
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingNote(null);
    setFormData({ title: '', content: '', color: NOTE_COLORS[0] });
    setShowForm(false);
  };

  const deleteNote = async (noteId) => {
    if (!confirm('Delete this note?')) return;
    try {
      await noteAPI.delete(eventId, noteId);
      toast.success('Note deleted');
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-neutral-600" />
          <h3 className="font-semibold text-neutral-900">Notes</h3>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            if (editingNote) cancelEdit();
          }}
          className="btn btn-sm btn-primary"
        >
          <Plus className="w-4 h-4" />
          New Note
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="p-4 border-b border-neutral-100" style={{ backgroundColor: formData.color }}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              required
              placeholder="Note title"
              className="input input-sm bg-white"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            <textarea
              required
              placeholder="Write your note..."
              className="input input-sm resize-none bg-white"
              rows="6"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            />
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">Color</label>
              <div className="flex gap-2">
                {NOTE_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                      formData.color === color ? 'border-neutral-900 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn btn-sm btn-primary">
                <Save className="w-4 h-4" />
                {editingNote ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="btn btn-sm"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notes Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {notes.length === 0 ? (
          <div className="text-center text-neutral-400 py-12">
            <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No notes yet</p>
            <p className="text-sm mt-1">Create sticky notes for quick reference</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {notes.map(note => (
              <div
                key={note.id}
                className="p-4 rounded-lg shadow-sm border border-neutral-200 hover:shadow-md transition-shadow"
                style={{ backgroundColor: note.color }}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h4 className="font-semibold text-neutral-900 flex-1">{note.title}</h4>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(note)}
                      className="text-neutral-600 hover:text-blue-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="text-neutral-600 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-neutral-700 whitespace-pre-wrap text-sm mb-3">{note.content}</p>

                <div className="text-xs text-neutral-500 border-t border-neutral-300 pt-2">
                  <div>{note.author}</div>
                  <div>Updated {new Date(note.updatedAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
