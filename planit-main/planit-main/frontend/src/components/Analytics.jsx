import { useState, useEffect } from 'react';
import { BarChart3, Users, MessageSquare, FileText, Vote, Eye, TrendingUp, CheckCircle2, DollarSign, UserCheck, Clock, AlertCircle } from 'lucide-react';
import { analyticsAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function Analytics({ eventId }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [eventId]);

  const loadAnalytics = async () => {
    try {
      const res = await analyticsAPI.get(eventId);
      setAnalytics(res.data.analytics);
    } catch (error) {
      toast.error('Failed to load analytics');
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="spinner w-8 h-8 border-4 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-400">
        <p>Failed to load analytics</p>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, color = 'neutral', subValue = null, subLabel = null }) => {
    const colorClasses = {
      neutral: 'bg-neutral-50 text-neutral-600',
      blue: 'bg-blue-50 text-blue-600',
      emerald: 'bg-emerald-50 text-emerald-600',
      purple: 'bg-purple-50 text-purple-600',
      amber: 'bg-amber-50 text-amber-600',
      rose: 'bg-rose-50 text-rose-600'
    };

    return (
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold text-neutral-900">{value}</div>
            <div className="text-sm text-neutral-500">{label}</div>
            {subValue !== null && (
              <div className="text-xs text-neutral-400 mt-1">{subValue} {subLabel}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const hasCheckins = analytics.checkins !== undefined;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Event Analytics
          </h2>
          <p className="text-neutral-500 mt-1">
            Last updated: {new Date(analytics.lastActivity).toLocaleString()}
          </p>
        </div>

        {/* Enterprise Check-in Stats */}
        {hasCheckins && (
          <div className="card p-6 border-2 border-emerald-100 bg-emerald-50/30">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-600" />
              Check-in Statistics
            </h3>
            
            {/* Check-in Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-3xl font-bold text-emerald-600">{analytics.checkins.checkedInInvites}</div>
                <div className="text-sm text-neutral-500 mt-1">Checked In</div>
                <div className="text-xs text-neutral-400">of {analytics.checkins.totalInvites} invites</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-3xl font-bold text-amber-600">{analytics.checkins.pendingInvites}</div>
                <div className="text-sm text-neutral-500 mt-1">Pending</div>
                <div className="text-xs text-neutral-400">awaiting check-in</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-3xl font-bold text-blue-600">{analytics.checkins.totalCheckedIn}</div>
                <div className="text-sm text-neutral-500 mt-1">Guests Admitted</div>
                <div className="text-xs text-neutral-400">of {analytics.checkins.totalExpectedGuests} expected</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-3xl font-bold text-purple-600">{analytics.checkins.checkInRate}%</div>
                <div className="text-sm text-neutral-500 mt-1">Check-in Rate</div>
                <div className="text-xs text-neutral-400">invitation completion</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Check-in Progress</span>
                <span className="font-semibold text-neutral-900">
                  {analytics.checkins.checkedInInvites} / {analytics.checkins.totalInvites}
                </span>
              </div>
              <div className="h-3 bg-white rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
                  style={{ width: `${analytics.checkins.checkInRate}%` }}
                />
              </div>
            </div>

            {/* Attendance Progress */}
            <div className="space-y-2 mt-4">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Guest Attendance</span>
                <span className="font-semibold text-neutral-900">
                  {analytics.checkins.totalCheckedIn} / {analytics.checkins.totalExpectedGuests}
                </span>
              </div>
              <div className="h-3 bg-white rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                  style={{ width: `${analytics.checkins.attendanceRate}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Eye} label="Page Views" value={analytics.views} color="blue" />
          <StatCard icon={Users} label="Participants" value={analytics.participants} color="emerald" />
          <StatCard icon={MessageSquare} label="Messages" value={analytics.messages} color="purple" />
          <StatCard icon={FileText} label="Files Shared" value={analytics.files} color="amber" />
        </div>

        {/* RSVP Breakdown */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            RSVP Status
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-600">{analytics.rsvps.yes}</div>
              <div className="text-sm text-neutral-500 mt-1">Attending</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600">{analytics.rsvps.maybe}</div>
              <div className="text-sm text-neutral-500 mt-1">Maybe</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-rose-600">{analytics.rsvps.no}</div>
              <div className="text-sm text-neutral-500 mt-1">Not Attending</div>
            </div>
          </div>
          <div className="mt-4 h-3 bg-neutral-100 rounded-full overflow-hidden flex">
            {analytics.rsvps.yes > 0 && (
              <div
                className="bg-emerald-500 h-full"
                style={{
                  width: `${
                    (analytics.rsvps.yes /
                      (analytics.rsvps.yes + analytics.rsvps.maybe + analytics.rsvps.no)) *
                    100
                  }%`
                }}
              />
            )}
            {analytics.rsvps.maybe > 0 && (
              <div
                className="bg-amber-500 h-full"
                style={{
                  width: `${
                    (analytics.rsvps.maybe /
                      (analytics.rsvps.yes + analytics.rsvps.maybe + analytics.rsvps.no)) *
                    100
                  }%`
                }}
              />
            )}
            {analytics.rsvps.no > 0 && (
              <div
                className="bg-rose-500 h-full"
                style={{
                  width: `${
                    (analytics.rsvps.no /
                      (analytics.rsvps.yes + analytics.rsvps.maybe + analytics.rsvps.no)) *
                    100
                  }%`
                }}
              />
            )}
          </div>
        </div>

        {/* Tasks & Expenses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tasks */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Tasks Progress
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-neutral-600">Total Tasks</span>
                <span className="text-2xl font-bold text-neutral-900">{analytics.tasks.total}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-neutral-600">Completed</span>
                <span className="text-xl font-semibold text-emerald-600">{analytics.tasks.completed}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-neutral-600">Pending</span>
                <span className="text-xl font-semibold text-amber-600">{analytics.tasks.pending}</span>
              </div>
              {analytics.tasks.total > 0 && (
                <>
                  <div className="h-3 bg-neutral-100 rounded-full overflow-hidden mt-3">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{
                        width: `${(analytics.tasks.completed / analytics.tasks.total) * 100}%`
                      }}
                    />
                  </div>
                  <div className="text-sm text-neutral-500 text-center">
                    {Math.round((analytics.tasks.completed / analytics.tasks.total) * 100)}% Complete
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Expenses */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Budget Overview
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-neutral-600">Total Spent</span>
                <span className="text-2xl font-bold text-neutral-900">
                  {formatCurrency(analytics.expenses.total)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-neutral-600">Expenses</span>
                <span className="text-xl font-semibold text-blue-600">{analytics.expenses.count}</span>
              </div>
              {analytics.expenses.remaining !== undefined && analytics.expenses.remaining !== 0 && (
                <>
                  <div className="flex justify-between items-baseline">
                    <span className="text-neutral-600">Remaining</span>
                    <span className={`text-xl font-semibold ${
                      analytics.expenses.remaining < 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}>
                      {formatCurrency(analytics.expenses.remaining)}
                    </span>
                  </div>
                </>
              )}
              {Object.keys(analytics.expenses.byCategory).length > 0 && (
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <div className="text-sm font-medium text-neutral-700 mb-2">By Category</div>
                  <div className="space-y-2">
                    {Object.entries(analytics.expenses.byCategory).slice(0, 3).map(([category, amount]) => (
                      <div key={category} className="flex justify-between text-sm">
                        <span className="text-neutral-600">{category}</span>
                        <span className="font-medium text-neutral-900">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={Vote} label="Polls Created" value={analytics.polls} color="purple" />
          <StatCard
            icon={TrendingUp}
            label="Avg. Messages/Day"
            value={analytics.participants > 0 ? Math.round(analytics.messages / Math.max(1, Math.ceil((new Date() - new Date(analytics.lastActivity)) / (1000 * 60 * 60 * 24)))) : 0}
            color="rose"
          />
        </div>
      </div>
    </div>
  );
}
