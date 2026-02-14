# Integration Guide - Adding New Features to EventSpace

This guide shows you exactly how to integrate all the new features into your EventSpace component.

## Quick Start

### Step 1: Import All New Components

Add these imports to your `EventSpace.jsx`:

```javascript
// New feature components
import Tasks from '../components/Tasks';
import Announcements from '../components/Announcements';
import Expenses from '../components/Expenses';
import Notes from '../components/Notes';
import Analytics from '../components/Analytics';
import Utilities from '../components/Utilities';
import Countdown from '../components/Countdown';
```

### Step 2: Add Navigation Tabs

Update your tab navigation to include the new features:

```javascript
const tabs = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'polls', label: 'Polls', icon: BarChart3 },
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'tasks', label: 'Tasks', icon: CheckCircle2 },          // NEW
  { id: 'announcements', label: 'Announcements', icon: Megaphone }, // NEW
  { id: 'expenses', label: 'Budget', icon: DollarSign },        // NEW
  { id: 'notes', label: 'Notes', icon: StickyNote },            // NEW
  ...(isOrganizer ? [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },   // NEW
  ] : []),
  { id: 'utilities', label: 'Share', icon: Share2 },            // NEW
];
```

### Step 3: Add Tab Content Rendering

In your tab content rendering section:

```javascript
{activeTab === 'overview' && (
  <div className="p-6 space-y-6">
    {/* Add countdown at the top */}
    <Countdown eventDate={event.date} />
    
    {/* Your existing overview content */}
    <EventDetails event={event} />
    <ParticipantsList participants={event.participants} />
    <AgendaView agenda={event.agenda} />
  </div>
)}

{activeTab === 'chat' && (
  <Chat eventId={eventId} socket={socket} />
)}

{activeTab === 'polls' && (
  <Polls eventId={eventId} socket={socket} />
)}

{activeTab === 'files' && (
  <Files eventId={eventId} socket={socket} />
)}

{/* NEW TABS */}
{activeTab === 'tasks' && (
  <Tasks eventId={eventId} socket={socket} />
)}

{activeTab === 'announcements' && (
  <Announcements 
    eventId={eventId} 
    socket={socket} 
    isOrganizer={isOrganizer} 
  />
)}

{activeTab === 'expenses' && (
  <Expenses 
    eventId={eventId} 
    socket={socket} 
    isOrganizer={isOrganizer} 
  />
)}

{activeTab === 'notes' && (
  <Notes eventId={eventId} socket={socket} />
)}

{activeTab === 'analytics' && isOrganizer && (
  <Analytics eventId={eventId} />
)}

{activeTab === 'utilities' && (
  <Utilities 
    eventId={eventId} 
    subdomain={event.subdomain}
    isOrganizer={isOrganizer} 
  />
)}
```

## Complete EventSpace Example

Here's a complete example of an enhanced EventSpace component:

```javascript
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Home, MessageSquare, BarChart3, FileText, Settings,
  CheckCircle2, Megaphone, DollarSign, StickyNote, Share2
} from 'lucide-react';
import { eventAPI } from '../services/api';
import { initSocket } from '../services/socket';

// Existing components
import Chat from '../components/Chat';
import Polls from '../components/Polls';
import Files from '../components/Files';

// New components
import Tasks from '../components/Tasks';
import Announcements from '../components/Announcements';
import Expenses from '../components/Expenses';
import Notes from '../components/Notes';
import Analytics from '../components/Analytics';
import Utilities from '../components/Utilities';
import Countdown from '../components/Countdown';

export default function EventSpace() {
  const { subdomain, eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [socket, setSocket] = useState(null);

  const username = localStorage.getItem('username');
  const isOrganizer = event?.participants?.some(
    p => p.username === username && p.role === 'organizer'
  );

  useEffect(() => {
    loadEvent();
  }, [subdomain, eventId]);

  useEffect(() => {
    if (event) {
      const newSocket = initSocket(event._id);
      setSocket(newSocket);
      return () => newSocket.disconnect();
    }
  }, [event]);

  const loadEvent = async () => {
    try {
      const res = await eventAPI.getById(eventId);
      setEvent(res.data.event);
    } catch (error) {
      console.error('Failed to load event:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'polls', label: 'Polls', icon: BarChart3 },
    { id: 'files', label: 'Files', icon: FileText },
    { id: 'tasks', label: 'Tasks', icon: CheckCircle2 },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'expenses', label: 'Budget', icon: DollarSign },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    ...(isOrganizer ? [
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    ] : []),
    { id: 'utilities', label: 'Share', icon: Share2 },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <p className="text-neutral-500">{event.description}</p>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-neutral-900 text-neutral-900'
                      : 'border-transparent text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full">
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            <Countdown eventDate={event.date} />
            {/* Your existing overview content */}
          </div>
        )}

        {activeTab === 'chat' && (
          <Chat eventId={event._id} socket={socket} />
        )}

        {activeTab === 'polls' && (
          <Polls eventId={event._id} socket={socket} />
        )}

        {activeTab === 'files' && (
          <Files eventId={event._id} socket={socket} />
        )}

        {activeTab === 'tasks' && (
          <Tasks eventId={event._id} socket={socket} />
        )}

        {activeTab === 'announcements' && (
          <Announcements 
            eventId={event._id} 
            socket={socket} 
            isOrganizer={isOrganizer} 
          />
        )}

        {activeTab === 'expenses' && (
          <Expenses 
            eventId={event._id} 
            socket={socket} 
            isOrganizer={isOrganizer} 
          />
        )}

        {activeTab === 'notes' && (
          <Notes eventId={event._id} socket={socket} />
        )}

        {activeTab === 'analytics' && isOrganizer && (
          <Analytics eventId={event._id} />
        )}

        {activeTab === 'utilities' && (
          <Utilities 
            eventId={event._id} 
            subdomain={event.subdomain}
            isOrganizer={isOrganizer} 
          />
        )}
      </main>
    </div>
  );
}
```

## Styling Requirements

All new components use the existing CSS classes from your `index.css`. Make sure you have these utility classes:

```css
/* If not already present, add these */
.card {
  @apply bg-white rounded-lg border border-neutral-200 shadow-sm;
}

.btn {
  @apply inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors;
}

.btn-primary {
  @apply bg-neutral-900 text-white hover:bg-neutral-800;
}

.btn-sm {
  @apply px-3 py-1.5 text-sm;
}

.input {
  @apply w-full px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900;
}

.input-sm {
  @apply px-3 py-1.5 text-sm;
}

.spinner {
  @apply inline-block w-6 h-6 border-4 border-neutral-200 border-t-neutral-900 rounded-full animate-spin;
}
```

## Mobile Responsiveness

All components are responsive out of the box:
- Use horizontal scrolling for tabs on mobile
- Grid layouts adapt to screen size
- Touch-friendly tap targets
- Optimized form inputs for mobile

## Socket.IO Events

The socket connection is shared across all components. Make sure to:

1. Initialize socket once in EventSpace
2. Pass socket instance to child components
3. Clean up on unmount

```javascript
useEffect(() => {
  if (event) {
    const newSocket = initSocket(event._id);
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  }
}, [event]);
```

## Testing

Test each feature:

1. **Tasks:** Create, toggle, delete
2. **Announcements:** Create as organizer, view as participant
3. **Expenses:** Add expenses, set budget
4. **Notes:** Create, edit, delete with different colors
5. **Analytics:** View as organizer (should show all metrics)
6. **Utilities:** Copy link, generate QR, download ICS and CSV
7. **Countdown:** Verify timer updates every second

## Troubleshooting

**Components not showing:**
- Check import paths
- Verify eventId is being passed correctly

**Real-time updates not working:**
- Verify socket connection is established
- Check browser console for socket errors

**Downloads not working:**
- Check authentication token in localStorage
- Verify API base URL is correct

**Permission errors:**
- Ensure isOrganizer is calculated correctly
- Check user role in event.participants

## Next Steps

1. Test all features thoroughly
2. Customize styling to match your brand
3. Add any additional features you need
4. Deploy and enjoy!

---

**Need help?** Check the `NEW_FEATURES.md` file for detailed documentation on each feature.
