import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Heart, Home } from 'lucide-react';
import axios from 'axios';

// Plain axios instance with no auth interceptors for public support routes
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

export default function SupportSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState(null);

  const sessionId = searchParams.get('session_id');
  const type = searchParams.get('type');

  useEffect(() => {
    if (!sessionId) {
      navigate('/support');
      return;
    }

    const verifyPayment = async () => {
      // Retry up to 4 times with delay — Stripe can take a moment to mark session as paid
      const maxAttempts = 4;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await publicApi.get(`/support/verify-payment/${sessionId}`);
          if (res.data.success) {
            setPayment(res.data);
            setLoading(false);
            return;
          }
          // If not paid yet and we have retries left, wait and try again
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          } else {
            setError('Payment verification failed. Your payment was received — please contact support if this persists.');
          }
        } catch (err) {
          console.error('Verification error:', err);
          if (attempt === maxAttempts) {
            setError('Failed to verify payment. Your payment was received — please contact support if this persists.');
          } else {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }
      setLoading(false);
    };

    verifyPayment();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-8 h-8 border-4 border-neutral-300 border-t-neutral-600 mx-auto mb-4"></div>
          <p className="text-sm text-neutral-500">Verifying payment...</p>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Payment Error</h1>
          <p className="text-neutral-600 mb-6">{error || 'Something went wrong'}</p>
          <button onClick={() => navigate('/support')} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const isFeatureRequest = type === 'feature' || payment.type === 'feature_request';

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        <div className="card p-8 text-center animate-fade-in">
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6 animate-bounce-once">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-neutral-900 mb-3">
            {isFeatureRequest ? ' Feature Request Received!' : '💝 Thank You!'}
          </h1>
          
          <p className="text-lg text-neutral-600 mb-6">
            {isFeatureRequest 
              ? 'Your feature request has been added to our roadmap!'
              : 'Your support means the world to us!'}
          </p>

          {/* Payment Details */}
          <div className="bg-neutral-50 rounded-lg p-6 mb-6">
            <div className="text-sm text-neutral-500 mb-1">Amount</div>
            <div className="text-3xl font-bold text-neutral-900 mb-4">
              ${payment.amount.toFixed(2)}
            </div>
            
            {payment.message && (
              <div className="text-left border-t border-neutral-200 pt-4">
                <div className="text-xs text-neutral-500 mb-2">Your message</div>
                <p className="text-sm text-neutral-700 italic">"{payment.message}"</p>
              </div>
            )}
          </div>

          {/* What's Next */}
          <div className="text-left bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-neutral-900 mb-2">
              {isFeatureRequest ? "What's next?" : "How we'll use it:"}
            </h3>
            <ul className="text-sm text-neutral-700 space-y-1.5">
              {isFeatureRequest ? (
                <>
                  <li>✓ Your request is now on our roadmap</li>
                  <li>✓ Higher contributions = higher priority</li>
                  <li>✓ We'll email you when it's implemented</li>
                  <li>✓ Check progress on the Wall of Features</li>
                </>
              ) : (
                <>
                  <li>✓ Keep PlanIt 100% free forever</li>
                  <li>✓ Add new features</li>
                  <li>✓ Improve performance</li>
                  <li>✓ Buy coffee for the dev team </li>
                </>
              )}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/')}
              className="btn btn-primary w-full"
            >
              <Home className="w-5 h-5" />
              Back to Home
            </button>
            <button
              onClick={() => navigate('/support/wall')}
              className="btn btn-secondary w-full"
            >
              <Heart className="w-5 h-5" />
              {isFeatureRequest ? 'View All Requests' : 'View Wall of Supporters'}
            </button>
          </div>
        </div>

        {/* Share */}
        <div className="text-center mt-6">
          <p className="text-sm text-neutral-500 mb-3">
            Help us spread the word!
          </p>
          <div className="flex justify-center gap-3">
            <a
              href={`https://twitter.com/intent/tweet?text=I%20just%20supported%20PlanIt%20-%20a%20100%25%20free%20event%20management%20tool!%20Check%20it%20out%3A%20https://planitapp.onrender.com`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              Share on Twitter
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
