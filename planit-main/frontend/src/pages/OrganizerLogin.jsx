import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function OrganizerLogin() {
  const { eventId } = useParams();
  const navigate = useNavigate();

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

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const res = await eventAPI.getPublicInfo(eventId);
        setIsPasswordProtected(res.data.event.isPasswordProtected);
        setEventTitle(res.data.event.title);
      } catch {
        toast.error('Event not found');
        navigate('/');
      } finally {
        setLoadingEvent(false);
      }
    };
    loadEvent();
  }, [eventId]);

  const handleChange = (field) => (e) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let res;
      if (isPasswordProtected) {
        res = await eventAPI.verifyPassword(eventId, {
          username: formData.username.trim(),
          password: formData.eventPassword,
          accountPassword: formData.accountPassword || undefined
        });
      } else {
        res = await eventAPI.join(eventId, {
          username: formData.username.trim(),
          accountPassword: formData.accountPassword || undefined
        });
      }

      localStorage.setItem('eventToken', res.data.token);
      localStorage.setItem('username', formData.username.trim());

      toast.success('Logged in successfully!');
      navigate(`/event/${eventId}`);
    } catch (err) {
      const data = err.response?.data;
      const errorMsg = data?.error || 'Login failed. Please check your credentials.';

      if (data?.requiresAccountPassword && !needsAccountPassword) {
        setNeedsAccountPassword(true);
        setError('This username has an account — please enter your account password below.');
        setLoading(false);
        return;
      }

      setError(errorMsg);
      toast.error(errorMsg);
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
                Your Organizer Name
              </label>
              <input
                type="text"
                required
                className="input"
                placeholder="Enter your organizer name"
                value={formData.username}
                onChange={handleChange('username')}
                autoComplete="off"
                autoFocus
              />
            </div>

            {isPasswordProtected && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Event Password
                </label>
                <div className="relative">
                  <input
                    type={showEventPass ? 'text' : 'password'}
                    required
                    className="input pr-10"
                    placeholder="The shared event password"
                    value={formData.eventPassword}
                    onChange={handleChange('eventPassword')}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowEventPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    {showEventPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-neutral-400 mt-1.5">
                  The password that guests use to enter this event
                </p>
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
                  className="input pr-10"
                  placeholder={needsAccountPassword ? 'Required — your personal account password' : 'Your personal account password'}
                  value={formData.accountPassword}
                  onChange={handleChange('accountPassword')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowAccountPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showAccountPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-neutral-400 mt-1.5">
                The personal password you set when creating the event
              </p>
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
