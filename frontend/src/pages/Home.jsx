import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, MessageSquare, BarChart3, FileText, Shield, Copy, Check, Lock, ArrowRight, Link } from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';

// Auto-generate a URL-safe slug from a title
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40);
}

// Add a short random suffix to avoid collisions
function makeSubdomain(title) {
  const slug = slugify(title);
  if (!slug) return '';
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${slug}-${suffix}`;
}

function FeatureItem({ icon: Icon, label, description }) {
  return (
    <div className="flex items-start gap-3 py-4 border-b border-neutral-100 last:border-0">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center mt-0.5">
        <Icon className="w-4 h-4 text-neutral-600" />
      </div>
      <div>
        <p className="text-sm font-medium text-neutral-900">{label}</p>
        <p className="text-sm text-neutral-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function CopyLinkBox({ eventId, subdomain }) {
  const [copied, setCopied] = useState(false);
  const link = subdomain
    ? `${window.location.origin}/e/${subdomain}`
    : `${window.location.origin}/event/${eventId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-2 rounded-lg border border-neutral-200 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-neutral-50">
        <Link className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
        <span className="flex-1 text-sm text-neutral-700 font-mono truncate text-xs">{link}</span>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('standard');
  const [formData, setFormData] = useState({
    subdomain: '',
    title: '',
    description: '',
    date: '',
    location: '',
    organizerName: '',
    organizerEmail: '',
    password: '',
    isEnterpriseMode: false,
    maxParticipants: 100
  });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setFormData(prev => ({
      ...prev,
      title,
      // Auto-generate subdomain when user hasn't manually set one yet
      subdomain: prev._subdomainTouched ? prev.subdomain : makeSubdomain(title)
    }));
  };

  const update = (field) => (e) =>
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value,
      ...(field === 'subdomain' ? { _subdomainTouched: true } : {})
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...formData,
      subdomain: formData.subdomain || makeSubdomain(formData.title) || `event-${Date.now()}`,
      isEnterpriseMode: mode === 'enterprise'
    };
    delete payload._subdomainTouched;

    try {
      const response = await eventAPI.create(payload);
      localStorage.setItem('eventToken', response.data.token);
      localStorage.setItem('username', formData.organizerName);
      setCreated(response.data.event);
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to create event';
      // If subdomain collision, retry with a fresh slug
      if (msg.includes('already taken')) {
        setFormData(prev => ({ ...prev, subdomain: makeSubdomain(prev.title) }));
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-neutral-100">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="logo-text">PlanIt</span>
          </div>
          <nav className="flex items-center gap-1">
            <a href="/terms" className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors rounded-md hover:bg-neutral-50">Terms</a>
            <a href="/privacy" className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors rounded-md hover:bg-neutral-50">Privacy</a>
            <a href="/admin" className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors rounded-md hover:bg-neutral-50">Admin</a>
            <a href="/support" className="ml-2 px-4 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 transition-all rounded-md shadow-sm flex items-center gap-1.5">
              <span>❤️</span>
              Support Us
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-2 gap-16 items-start">

          {/* Left — hero + features */}
          <div>
            <div className="mb-8">
              <h1 className="text-4xl font-semibold text-neutral-900 mb-4 tracking-tight text-balance">
                Private event spaces for groups
              </h1>
              <p className="text-neutral-500 text-lg leading-relaxed">
                Create a shared space for your event. No accounts, no friction.
              </p>
            </div>

            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-neutral-900">Enterprise Mode</h3>
              </div>
              <p className="text-sm text-neutral-600 mb-3">
                Hosting a large event? Use Enterprise Mode for QR-based check-in, personalized invites, and attendance analytics.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
                <span className="px-2 py-1 bg-white rounded border border-blue-200">QR Check-in</span>
                <span className="px-2 py-1 bg-white rounded border border-blue-200">Personalized Invites</span>
                <span className="px-2 py-1 bg-white rounded border border-blue-200">Attendance Tracking</span>
                <span className="px-2 py-1 bg-white rounded border border-blue-200">Analytics Dashboard</span>
              </div>
            </div>

            <div className="card p-1 divide-y divide-neutral-100">
              <FeatureItem icon={MessageSquare} label="Real-time chat" description="Instant messaging with typing indicators" />
              <FeatureItem icon={BarChart3} label="Live polls" description="Vote and decide together instantly" />
              <FeatureItem icon={FileText} label="File sharing" description="Share documents and images securely" />
              <FeatureItem icon={Shield} label="Password protection" description="Keep events private with an optional password" />
              <FeatureItem icon={Users} label="Up to 100 participants" description="Per event by default, configurable" />
            </div>

            <div className="mt-6 flex items-center gap-6 text-sm text-neutral-400">
              <span>No account required</span>
              <span>Free forever</span>
              <span>Hosted securely</span>
            </div>
          </div>

          {/* Right — create form or success */}
          <div>
            {!created ? (
              <div className="card p-8 animate-fade-in">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-neutral-900">Create an event</h2>
                  <p className="text-sm text-neutral-500 mt-1">Set up your event space in under a minute.</p>
                </div>

                <div className="mb-5 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                  <label className="block text-xs font-medium text-neutral-600 mb-2">Event Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('standard')}
                      className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                        mode === 'standard' 
                          ? 'bg-neutral-900 text-white border-neutral-900' 
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      <div className="text-xs font-semibold mb-0.5">Standard</div>
                      <div className="text-xs opacity-80">Planning & collaboration</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('enterprise')}
                      className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                        mode === 'enterprise' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      <div className="text-xs font-semibold mb-0.5">Enterprise</div>
                      <div className="text-xs opacity-80">QR check-in & invites</div>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Title — drives subdomain auto-gen */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                      Event title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      placeholder="Summer BBQ 2025"
                      value={formData.title}
                      onChange={handleTitleChange}
                    />
                    {/* Live URL preview */}
                    {formData.title && formData.subdomain && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Link className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                        <span className="text-xs text-neutral-400 font-mono truncate">
                          {window.location.origin}/e/<span className="text-neutral-600">{formData.subdomain}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                      Description
                    </label>
                    <textarea
                      className="input resize-none"
                      rows="2"
                      placeholder="What's this event about?"
                      value={formData.description}
                      onChange={update('description')}
                    />
                  </div>

                  {/* Date + Location */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                        Date &amp; time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        required
                        className="input"
                        value={formData.date}
                        onChange={update('date')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                        Location
                      </label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Central Park, NYC"
                        value={formData.location}
                        onChange={update('location')}
                      />
                    </div>
                  </div>

                  {/* Name + Email */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                        Your name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="input"
                        placeholder="Alex Smith"
                        value={formData.organizerName}
                        onChange={update('organizerName')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                        Your email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        className="input"
                        placeholder="alex@example.com"
                        value={formData.organizerEmail}
                        onChange={update('organizerEmail')}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-neutral-400" />
                        Event Password <span className="text-neutral-400 font-normal">(optional{mode === 'enterprise' ? ', for entry control' : ''})</span>
                      </span>
                    </label>
                    <input
                      type="password"
                      className="input"
                      placeholder={mode === 'enterprise' ? 'Protect event access' : 'Leave empty for a public event'}
                      value={formData.password}
                      onChange={update('password')}
                    />
                    {mode === 'enterprise' && (
                      <p className="text-xs text-neutral-400 mt-1.5">
                        Enterprise mode uses personalized QR invites for check-in. This password adds extra security.
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full py-3 mt-1"
                  >
                    {loading ? (
                      <>
                        <span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Create event
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* ── Success ── */
              <div className="card p-8 animate-fade-in">
                <div className="mb-6">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4">
                    <Check className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-neutral-900">Event created</h2>
                  <p className="text-sm text-neutral-500 mt-1">
                    {mode === 'enterprise' 
                      ? 'Your enterprise event is ready. Set up guest invites and check-in.' 
                      : `Share the link below so others can join${created.isPasswordProtected ? ' — they will be asked for the password' : ''}.`
                    }
                  </p>
                </div>

                {mode === 'enterprise' ? (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <p className="text-sm font-semibold text-blue-900">Next Steps for Enterprise Mode:</p>
                    </div>
                    <ol className="text-xs text-blue-800 space-y-1 ml-6 list-decimal">
                      <li>Enter your event and click "Manage Invites & Check-in"</li>
                      <li>Add your guests with their names and group sizes</li>
                      <li>Copy and send personalized invite links to each guest</li>
                      <li>On event day, use the check-in dashboard to scan QR codes</li>
                    </ol>
                  </div>
                ) : (
                  <div className="mb-6">
                    <p className="text-sm font-medium text-neutral-700">Your event link</p>
                    <CopyLinkBox eventId={created.id} subdomain={created.subdomain} />
                  </div>
                )}

                <div className="pt-5 border-t border-neutral-100">
                  <button
                    onClick={() => navigate(created.subdomain ? `/e/${created.subdomain}` : `/event/${created.id}`)}
                    className="btn btn-primary w-full py-3"
                  >
                    {mode === 'enterprise' ? 'Set Up Invites' : 'Enter your event'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-xs text-neutral-400 text-center mt-3">
                    You are the organizer of this event
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-neutral-100 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-neutral-400">
          <span>2026 PlanIt</span>
          <span>By Aakshat Hariharan</span>
          <span>Made with 👨🏼‍💻 not ❤️</span>
          <div className="flex items-center gap-6">
            <a href="/terms" className="hover:text-neutral-600 transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-neutral-600 transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
