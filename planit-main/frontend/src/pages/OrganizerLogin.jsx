import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function OrganizerLogin() {
  // The page is mounted at both /event/:eventId/login and /e/:subdomain/login.
  // When arriving via subdomain we need to look up the real eventId first.
  const { eventId: eventIdParam, subdomain } = useParams();
  const navigate = useNavigate();

  const [resolvedEventId, setResolvedEventId] = useState(eventIdParam || null);
  const [formData, setFormData] = useState({
    username: '',
    eventPassword: '',
    accountPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [error, setError] = useState('');
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [showEventPass, setShowEventPass] = useState(false);
  const [showAccountPass, setShowAccountPass] = useState(false);
  const [needsAccountPassword, setNeedsAccountPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const loadEvent = async () => {
      try {
        let eid = eventIdParam;

        // Resolve subdomain → eventId when arriving via /e/:subdomain/login
        if (!eid && subdomain) {
          const subRes = await eventAPI.getBySubdomain(subdomain);
          eid = subRes.data.event?.id;
          if (!eid) throw new Error('Event not found');
          setResolvedEventId(eid);
        }

        if (!eid) {
          toast.error('Event not found');
          navigate('/');
          return;
        }

        const res = await eventAPI.getPublicInfo(eid);
        setIsPasswordProtected(res.data.event.isPasswordProtected);
        setEventTitle(res.data.event.title);
        setResolvedEventId(eid);
      } catch {
        toast.error('Event not found');
        navigate('/');
      } finally {
        setLoadingEvent(false);
      }
    };
    loadEvent();
  }, [eventIdParam, subdomain]);

  const handleChange = (field) => (e) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // ── Client-side field validation ──────────────────────────────────────
    const errs = {};
    const trimmedUsername = formData.username.trim();
    if (!trimmedUsername)
      errs.username = 'Please enter your organizer name.';
    if (isPasswordProtected && !formData.eventPassword)
      errs.eventPassword = 'Please enter the event password.';
    if (needsAccountPassword && !formData.accountPassword)
      errs.accountPassword = 'Account password is required for this username.';

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);

    try {
      let res;
      if (isPasswordProtected) {
        res = await eventAPI.verifyPassword(resolvedEventId, {
          username: trimmedUsername,
          password: formData.eventPassword,
          accountPassword: formData.accountPassword || undefined
        });
      } else {
        res = await eventAPI.join(resolvedEventId, {
          username: trimmedUsername,
          accountPassword: formData.accountPassword || undefined
        });
      }

      // Validate the returned token belongs to this event before storing it
      try {
        const b64 = res.data.token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = b64 ? JSON.parse(atob(b64)) : null;
        if (!decoded || decoded.eventId !== resolvedEventId) {
          throw new Error('Token mismatch');
        }
      } catch {
        setError('Server returned an unexpected response. Please try again.');
        setLoading(false);
        return;
      }

      localStorage.setItem('eventToken', res.data.token);
      localStorage.setItem('username', trimmedUsername);

      toast.success('Logged in successfully!');
      navigate(`/event/${resolvedEventId}`);
    } catch (err) {
      const data = err.response?.data;
      const errorMsg = data?.error || 'Login failed. Please check your credentials.';

      if (data?.requiresAccountPassword && !needsAccountPassword) {
        setNeedsAccountPassword(true);
        setFieldErrors({ accountPassword: 'This username has an account — enter your account password.' });
        setLoading(false);
        return;
      }

      // Map server field errors to specific fields when possible
      if (errorMsg.toLowerCase().includes('password') && isPasswordProtected) {
        setFieldErrors({ eventPassword: errorMsg });
      } else if (errorMsg.toLowerCase().includes('account password')) {
        setFieldErrors({ accountPassword: errorMsg });
      } else if (errorMsg.toLowerCase().includes('name') || errorMsg.toLowerCase().includes('username')) {
        setFieldErrors({ username: errorMsg });
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loadingEvent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center">
        <span className="spinner w-6 h-6 border-2 border-neutral-300 border-t-neutral-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-neutral-900 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">Organizer Login</h1>
          {eventTitle && (
            <p className="text-sm text-neutral-600 font-medium mb-1">{eventTitle}</p>
          )}
          <p className="text-sm text-neutral-500">
            Log back in to access your event from this device
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Your Organizer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className={`input ${fieldErrors.username ? 'border-red-400 focus:border-red-500 bg-red-50' : ''}`}
                placeholder="Enter your organizer name"
                value={formData.username}
                onChange={(e) => { handleChange('username')(e); setFieldErrors(p => ({...p, username: ''})); }}
                autoComplete="off"
                autoFocus
              />
              {fieldErrors.username && (
                <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{fieldErrors.username}
                </p>
              )}
            </div>

            {isPasswordProtected && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Event Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showEventPass ? 'text' : 'password'}
                    required
                    className={`input pr-10 ${fieldErrors.eventPassword ? 'border-red-400 focus:border-red-500 bg-red-50' : ''}`}
                    placeholder="The shared event password"
                    value={formData.eventPassword}
                    onChange={(e) => { handleChange('eventPassword')(e); setFieldErrors(p => ({...p, eventPassword: ''})); }}
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowEventPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                    {showEventPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.eventPassword ? (
                  <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{fieldErrors.eventPassword}
                  </p>
                ) : (
                  <p className="text-xs text-neutral-400 mt-1.5">
                    The password that guests use to enter this event
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Account Password
                {needsAccountPassword && <span className="text-red-500 ml-1">*</span>}
              </label>
              <div className="relative">
                <input
                  type={showAccountPass ? 'text' : 'password'}
                  required={needsAccountPassword}
                  className={`input pr-10 ${fieldErrors.accountPassword ? 'border-red-400 focus:border-red-500 bg-red-50' : ''}`}
                  placeholder={needsAccountPassword ? 'Required — your personal account password' : 'Your personal account password'}
                  value={formData.accountPassword}
                  onChange={(e) => { handleChange('accountPassword')(e); setFieldErrors(p => ({...p, accountPassword: ''})); }}
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowAccountPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                  {showAccountPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.accountPassword ? (
                <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{fieldErrors.accountPassword}
                </p>
              ) : (
                <p className="text-xs text-neutral-400 mt-1.5">
                  The personal password you set when creating the event
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3"
            >
              {loading ? (
                <>
                  <span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" />
                  Logging in...
                </>
              ) : (
                <>
                  Log In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-neutral-100 text-center">
            <p className="text-xs text-neutral-500 mb-1">
              Don't remember your password?
            </p>
            <p className="text-xs text-neutral-400">
              Access the event from the original device you created it on, or contact support.
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-neutral-500 hover:text-neutral-700"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
