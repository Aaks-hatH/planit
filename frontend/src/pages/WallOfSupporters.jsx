import { useState, useEffect } from 'react';
import { Heart, Sparkles, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import axios from 'axios';
import { formatRelativeTime } from '../utils/formatters';

// Plain axios instance pointing to the real backend
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

export default function WallOfSupporters() {
  const [activeTab, setActiveTab] = useState('supporters'); // 'supporters' or 'features'
  const [supporters, setSupporters] = useState([]);
  const [features, setFeatures] = useState([]);
  const [stats, setStats] = useState({ totalRaised: 0, supporterCount: 0, totalRequests: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [supportersRes, featuresRes] = await Promise.all([
        publicApi.get('/support/supporters'),
        publicApi.get('/support/feature-requests'),
      ]);

      setSupporters(supportersRes.data.supporters || []);
      setFeatures(featuresRes.data.requests || []);
      setStats({
        totalRaised: supportersRes.data.totalRaised || 0,
        supporterCount: supportersRes.data.supporterCount || 0,
        totalRequests: featuresRes.data.totalRequests || 0,
      });
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center">
              <Heart className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-neutral-900">PlanIt</span>
          </a>
          <a href="/support" className="btn btn-primary">
            Support Us
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero Stats */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-neutral-900 mb-4">
            Wall of Awesomeness 
          </h1>
          <p className="text-lg text-neutral-600 mb-8">
            These amazing people keep PlanIt free for everyone!
          </p>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="card p-6">
              <DollarSign className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-neutral-900">
                ${stats.totalRaised.toFixed(0)}
              </div>
              <div className="text-sm text-neutral-500 mt-1">Total Raised</div>
            </div>

            <div className="card p-6">
              <Heart className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-neutral-900">
                {stats.supporterCount}
              </div>
              <div className="text-sm text-neutral-500 mt-1">Supporters</div>
            </div>

            <div className="card p-6">
              <Sparkles className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-neutral-900">
                {stats.totalRequests}
              </div>
              <div className="text-sm text-neutral-500 mt-1">Feature Requests</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setActiveTab('supporters')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'supporters'
                ? 'bg-neutral-900 text-white shadow-lg'
                : 'bg-white text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <Heart className="w-5 h-5 inline mr-2" />
            Supporters ({stats.supporterCount})
          </button>
          <button
            onClick={() => setActiveTab('features')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'features'
                ? 'bg-neutral-900 text-white shadow-lg'
                : 'bg-white text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <Sparkles className="w-5 h-5 inline mr-2" />
            Feature Requests ({stats.totalRequests})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="spinner w-8 h-8 border-4 border-neutral-300 border-t-neutral-600 mx-auto mb-4"></div>
            <p className="text-sm text-neutral-500">Loading...</p>
          </div>
        ) : (
          <>
            {/* Supporters Tab */}
            {activeTab === 'supporters' && (
              <div className="space-y-4">
                {supporters.length === 0 ? (
                  <div className="card p-12 text-center">
                    <Heart className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                      Be the first supporter!
                    </h3>
                    <p className="text-neutral-600 mb-6">
                      Help us keep PlanIt free for everyone
                    </p>
                    <a href="/support" className="btn btn-primary">
                      Support PlanIt
                    </a>
                  </div>
                ) : (
                  supporters.map((supporter, idx) => (
                    <div key={idx} className="card p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                              {supporter.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-semibold text-neutral-900">
                                {supporter.name}
                              </h3>
                              <p className="text-sm text-neutral-500">
                                {formatRelativeTime(new Date(supporter.date))}
                              </p>
                            </div>
                          </div>
                          {supporter.message && (
                            <p className="text-neutral-700 mt-3 italic pl-13">
                              "{supporter.message}"
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-2xl font-bold text-emerald-600">
                            ${supporter.amount.toFixed(2)}
                          </div>
                          <div className="text-xs text-neutral-500 mt-1">
                            {supporter.amount >= 50 ? ' Super' :
                             supporter.amount >= 25 ? ' Generous' :
                             supporter.amount >= 10 ? ' Burger' :
                             supporter.amount >= 5 ? ' Pizza' : ' Coffee'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Feature Requests Tab */}
            {activeTab === 'features' && (
              <div className="space-y-4">
                {features.length === 0 ? (
                  <div className="card p-12 text-center">
                    <Sparkles className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                      No feature requests yet
                    </h3>
                    <p className="text-neutral-600 mb-6">
                      Have an idea? Request a feature!
                    </p>
                    <a href="/support" className="btn btn-primary">
                      Request Feature
                    </a>
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <p className="text-sm text-blue-900">
                         <strong>How it works:</strong> Features are prioritized by 
                        contribution amount. Higher contributions get built first!
                      </p>
                    </div>

                    {features.map((request, idx) => (
                      <div key={idx} className="card p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-900 text-white text-sm font-bold">
                                #{idx + 1}
                              </div>
                              <div>
                                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                                  Requested by
                                </span>
                                <h3 className="font-semibold text-neutral-900">
                                  {request.name}
                                </h3>
                              </div>
                            </div>
                            <p className="text-neutral-700 pl-11">
                              {request.feature}
                            </p>
                            <p className="text-sm text-neutral-500 mt-2 pl-11">
                              {formatRelativeTime(new Date(request.date))}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-2xl font-bold text-blue-600">
                              ${request.amount.toFixed(0)}
                            </div>
                            <div className="text-xs text-neutral-500 mt-1">
                              {request.amount >= 100 ? ' Critical' :
                               request.amount >= 50 ? ' Urgent' :
                               request.amount >= 25 ? ' High' :
                               request.amount >= 10 ? ' Medium' : ' Low'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* CTA */}
        <div className="mt-12 text-center">
          <div className="card p-8 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-dashed border-neutral-300">
            <Heart className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">
              Want to see your name here?
            </h2>
            <p className="text-neutral-600 mb-6">
              Support PlanIt development or request your favorite feature!
            </p>
            <a href="/support" className="btn btn-primary btn-lg">
              Support PlanIt
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
