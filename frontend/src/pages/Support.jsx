import { useState } from 'react';
import { Heart, Coffee, Sparkles, DollarSign } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

// Plain axios instance with no auth interceptors for public support routes
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

export default function Support() {
  const [activeTab, setActiveTab] = useState('support'); // 'support' or 'feature'
  
  // Support form
  const [supportForm, setSupportForm] = useState({
    amount: 500, // $5 default
    email: '',
    name: '',
    message: '',
  });
  
  // Feature request form
  const [featureForm, setFeatureForm] = useState({
    amount: 1000, // $10 default
    email: '',
    name: '',
    feature: '',
  });
  
  const [loading, setLoading] = useState(false);

  // ── Preset amounts for support ──
  const presetAmounts = [
    { label: ' Coffee', amount: 300 }, // $3
    { label: ' Pizza', amount: 500 }, // $5
    { label: ' Burger', amount: 1000 }, // $10
    { label: ' Generous', amount: 2500 }, // $25
    { label: ' Super', amount: 5000 }, // $50
  ];

  // ── Preset amounts for feature requests ──
  const featureAmounts = [
    { label: 'Nice to have', amount: 500 }, // $5
    { label: 'Want it!', amount: 1000 }, // $10
    { label: 'Really want it!', amount: 2500 }, // $25
    { label: 'Need it badly!', amount: 5000 }, // $50
    { label: 'Mission critical!', amount: 10000 }, // $100
  ];

  // ── Handle Support Payment ──
  const handleSupport = async (e) => {
    e.preventDefault();
    
    if (!supportForm.email || !supportForm.amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (supportForm.amount < 300) {
      toast.error('Minimum amount is $3');
      return;
    }

    setLoading(true);
    try {
      const res = await publicApi.post('/support/create-payment', supportForm);
      if (!res.data.url) {
        toast.error('No checkout URL returned. Check your Stripe configuration.');
        return;
      }
      window.location.href = res.data.url; // Redirect to Stripe
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to create payment');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Feature Request ──
  const handleFeatureRequest = async (e) => {
    e.preventDefault();
    
    if (!featureForm.email || !featureForm.feature || !featureForm.amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (featureForm.feature.length < 10) {
      toast.error('Please describe your feature request (min 10 characters)');
      return;
    }

    if (featureForm.amount < 500) {
      toast.error('Minimum amount for feature requests is $5');
      return;
    }

    setLoading(true);
    try {
      const res = await publicApi.post('/support/feature-request', featureForm);
      if (!res.data.url) {
        toast.error('No checkout URL returned. Check your Stripe configuration.');
        return;
      }
      window.location.href = res.data.url; // Redirect to Stripe
    } catch (error) {
      console.error('Feature request error:', error);
      toast.error(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to create feature request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center">
              <Heart className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-neutral-900">PlanIt</span>
          </a>
          <a href="/support/wall" className="text-sm text-neutral-600 hover:text-neutral-900">
            Wall of Supporters →
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-neutral-900 mb-4">
            Support PlanIt Development
          </h1>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            PlanIt is <strong>100% free</strong> and always will be. If you find it useful, 
            consider buying us a coffee or requesting a feature!
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setActiveTab('support')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'support'
                ? 'bg-neutral-900 text-white shadow-lg'
                : 'bg-white text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <Coffee className="w-5 h-5 inline mr-2" />
            Support Us
          </button>
          <button
            onClick={() => setActiveTab('feature')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'feature'
                ? 'bg-neutral-900 text-white shadow-lg'
                : 'bg-white text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <Sparkles className="w-5 h-5 inline mr-2" />
            Request Feature
          </button>
        </div>

        {/* Support Tab */}
        {activeTab === 'support' && (
          <div className="card p-8 max-w-2xl mx-auto animate-fade-in">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">
               Buy Us a Coffee
            </h2>
            <p className="text-neutral-600 mb-6">
              Your support helps us keep PlanIt free and add new features!
            </p>

            <form onSubmit={handleSupport} className="space-y-6">
              {/* Amount Selection */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-3">
                  Choose amount
                </label>
                <div className="grid grid-cols-5 gap-3 mb-3">
                  {presetAmounts.map((preset) => (
                    <button
                      key={preset.amount}
                      type="button"
                      onClick={() => setSupportForm({ ...supportForm, amount: preset.amount })}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        supportForm.amount === preset.amount
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div>{preset.label}</div>
                      <div className="text-xs mt-1">${preset.amount / 100}</div>
                    </button>
                  ))}
                </div>
                
                {/* Custom amount */}
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
                  <input
                    type="number"
                    min="3"
                    step="1"
                    value={supportForm.amount / 100}
                    onChange={(e) => setSupportForm({ ...supportForm, amount: Math.round(e.target.value * 100) })}
                    className="input pl-10"
                    placeholder="Custom amount"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={supportForm.email}
                  onChange={(e) => setSupportForm({ ...supportForm, email: e.target.value })}
                  className="input"
                  placeholder="your@email.com"
                />
              </div>

              {/* Name (optional) */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Your name (optional)
                </label>
                <input
                  type="text"
                  value={supportForm.name}
                  onChange={(e) => setSupportForm({ ...supportForm, name: e.target.value })}
                  className="input"
                  placeholder="Anonymous"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Will appear on the Wall of Supporters
                </p>
              </div>

              {/* Message (optional) */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Message (optional)
                </label>
                <textarea
                  value={supportForm.message}
                  onChange={(e) => setSupportForm({ ...supportForm, message: e.target.value })}
                  className="input"
                  rows="3"
                  maxLength="500"
                  placeholder="Say something nice..."
                />
                <p className="text-xs text-neutral-500 mt-1">
                  {supportForm.message.length}/500 characters
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-3 text-lg"
              >
                {loading ? (
                  <>
                    <span className="spinner w-5 h-5 border-2 border-white/30 border-t-white" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Heart className="w-5 h-5" />
                    Support ${(supportForm.amount / 100).toFixed(2)}
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Feature Request Tab */}
        {activeTab === 'feature' && (
          <div className="card p-8 max-w-2xl mx-auto animate-fade-in">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">
               Request a Feature or 2...
            </h2>
            <p className="text-neutral-600 mb-6">
              Want a specific feature? Back your request with a contribution and 
              we'll prioritize it! Higher contributions get built first.
            </p>

            <form onSubmit={handleFeatureRequest} className="space-y-6">
              {/* Feature Description */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Feature Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={featureForm.feature}
                  onChange={(e) => setFeatureForm({ ...featureForm, feature: e.target.value })}
                  className="input"
                  rows="4"
                  maxLength="500"
                  placeholder="Describe the feature you want... (min 10 characters)"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  {featureForm.feature.length}/500 characters
                </p>
              </div>

              {/* Priority Level */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-3">
                  Priority Level <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-5 gap-3">
                  {featureAmounts.map((preset) => (
                    <button
                      key={preset.amount}
                      type="button"
                      onClick={() => setFeatureForm({ ...featureForm, amount: preset.amount })}
                      className={`p-3 rounded-lg border-2 text-xs font-medium transition-all ${
                        featureForm.amount === preset.amount
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div>{preset.label}</div>
                      <div className="text-xs mt-1">${preset.amount / 100}</div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                   Higher amounts = Higher priority in our roadmap
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={featureForm.email}
                  onChange={(e) => setFeatureForm({ ...featureForm, email: e.target.value })}
                  className="input"
                  placeholder="your@email.com"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  We'll notify you when your feature is implemented
                </p>
              </div>

              {/* Name (optional) */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Your name (optional)
                </label>
                <input
                  type="text"
                  value={featureForm.name}
                  onChange={(e) => setFeatureForm({ ...featureForm, name: e.target.value })}
                  className="input"
                  placeholder="Anonymous"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-3 text-lg"
              >
                {loading ? (
                  <>
                    <span className="spinner w-5 h-5 border-2 border-white/30 border-t-white" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Request Feature - ${(featureForm.amount / 100).toFixed(2)}
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto">
          <div className="card p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <Heart className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-neutral-900 mb-2">100% Free</h3>
            <p className="text-sm text-neutral-600">
              PlanIt will always be free. No paywalls, no limits.
            </p>
          </div>

          <div className="card p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-neutral-900 mb-2">Open Source</h3>
            <p className="text-sm text-neutral-600">
              Built by the community, for the community.
            </p>
          </div>

          <div className="card p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
              <Coffee className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-neutral-900 mb-2">Support Devs</h3>
            <p className="text-sm text-neutral-600">
              Help us keep building awesome features!
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-neutral-300 mt-10">
          Payments are currently in test mode. No real charges will be made. Make as many payments as you want...
        </p>
      </main>
    </div>
  );
}
