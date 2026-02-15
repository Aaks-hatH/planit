import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function OrganizerLogin() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    accountPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await eventAPI.join(eventId, {
        username: formData.username.trim(),
        accountPassword: formData.accountPassword
      });

      localStorage.setItem('eventToken', res.data.token);
      localStorage.setItem('username', formData.username.trim());
      
      toast.success('Logged in successfully');
      navigate(`/event/${eventId}`);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Login failed';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-neutral-900 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Organizer Login</h1>
          <p className="text-sm text-neutral-500">
            Log back in to access your event from this device
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                required
                className="input"
                placeholder="Enter your organizer name"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Account Password
              </label>
              <input
                type="password"
                required
                className="input"
                placeholder="Enter your account password"
                value={formData.accountPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, accountPassword: e.target.value }))}
              />
              <p className="text-xs text-neutral-400 mt-1.5">
                This is the password you set when creating the event
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
            <p className="text-xs text-neutral-500 mb-2">
              Don't remember your password?
            </p>
            <p className="text-xs text-neutral-400">
              Contact support or access the event from the original device where you created it
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
