import { useState, useEffect } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import axios from 'axios';
import { formatRelativeTime } from '../utils/formatters';
import PublicLayout from '../components/ui/PublicLayout';
import { EmptyState, SkeletonList, Stat } from '../components/ui/Feedback';

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

  const tier = (a) => (a >= 50 ? 'Super' : a >= 25 ? 'Generous' : a >= 10 ? 'Burger' : a >= 5 ? 'Pizza' : 'Coffee');
  const priority = (a) => (a >= 100 ? 'Critical' : a >= 50 ? 'Urgent' : a >= 25 ? 'High' : a >= 10 ? 'Medium' : 'Low');
  const priorityTone = (a) => (a >= 50 ? 'status-alert' : a >= 10 ? 'status-wait' : '');

  return (
    <PublicLayout
      eyebrow="Wall of Supporters"
      title="Wall of Awesomeness"
      lead="These people keep PlanIt free for everyone."
      actions={<a href="/support" className="btn btn-primary btn-lg"><Heart className="h-4 w-4" />Support PlanIt</a>}
    >
      <section className="pb-24">
        <dl className="grid grid-cols-3 divide-x divide-[var(--pi-border)] border-y border-[var(--pi-border)]" aria-label="Totals">
          <div className="py-6 pr-4 sm:pr-8"><Stat label="Total raised" value={<span className="t-num">${stats.totalRaised.toFixed(0)}</span>} /></div>
          <div className="px-4 py-6 sm:px-8"><Stat label="Supporters" value={stats.supporterCount} /></div>
          <div className="py-6 pl-4 sm:pl-8"><Stat label="Feature requests" value={stats.totalRequests} /></div>
        </dl>

        <div className="mb-6 mt-10">
          <div className="tabs" role="tablist" aria-label="Wall sections">
            <button role="tab" aria-selected={activeTab === 'supporters'} className="tab" onClick={() => setActiveTab('supporters')}>
              <Heart className="mr-2 inline h-4 w-4" />Supporters <span className="t-num ml-1 opacity-60">{stats.supporterCount}</span>
            </button>
            <button role="tab" aria-selected={activeTab === 'features'} className="tab" onClick={() => setActiveTab('features')}>
              <Sparkles className="mr-2 inline h-4 w-4" />Feature requests <span className="t-num ml-1 opacity-60">{stats.totalRequests}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonList rows={4} />
        ) : activeTab === 'supporters' ? (
          supporters.length === 0 ? (
            <EmptyState icon={Heart} title="Be the first supporter" action={<a href="/support" className="btn btn-primary">Support PlanIt</a>}>
              Help us keep PlanIt free for everyone. Your name goes up here.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-[var(--pi-border)] overflow-hidden rounded-xl border border-[var(--pi-border)] bg-[var(--pi-surface)]">
              {supporters.map((supporter, idx) => (
                <li key={idx} className="flex items-start gap-4 p-5 transition-colors hover:bg-[var(--pi-surface-sunk)]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--pi-action)] font-display font-semibold text-[var(--pi-action-ink)]" aria-hidden="true">
                    {supporter.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">{supporter.name}</p>
                    <p className="t-meta">{formatRelativeTime(new Date(supporter.date))}</p>
                    {supporter.message && <p className="mt-2 text-[var(--pi-text)]">&ldquo;{supporter.message}&rdquo;</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="t-num text-xl font-medium" style={{ color: 'var(--pi-live-ink)' }}>${supporter.amount.toFixed(2)}</p>
                    <p className="t-label mt-1">{tier(supporter.amount)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : features.length === 0 ? (
          <EmptyState icon={Sparkles} title="No feature requests yet" action={<a href="/support" className="btn btn-primary">Request a feature</a>}>
            Have an idea? Back it with a contribution and it goes on the list.
          </EmptyState>
        ) : (
          <>
            <div className="notice notice-info mb-5">
              <p><strong>How it works:</strong> features are prioritized by contribution amount. Higher contributions are built first.</p>
            </div>
            <ol className="divide-y divide-[var(--pi-border)] overflow-hidden rounded-xl border border-[var(--pi-border)] bg-[var(--pi-surface)]">
              {features.map((request, idx) => (
                <li key={idx} className="flex items-start gap-4 p-5 transition-colors hover:bg-[var(--pi-surface-sunk)]">
                  <span className="t-num grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--pi-surface-sunk)] text-sm font-medium" aria-label={`Rank ${idx + 1}`}>{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="t-label">Requested by {request.name}</p>
                    <p className="mt-1.5">{request.feature}</p>
                    <p className="t-meta mt-1.5">{formatRelativeTime(new Date(request.date))}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="t-num text-xl font-medium" style={{ color: 'var(--pi-accent)' }}>${request.amount.toFixed(0)}</p>
                    <span className={`status mt-1.5 ${priorityTone(request.amount)}`}>{priority(request.amount)}</span>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}

        <div className="mt-14 flex flex-col items-start justify-between gap-5 rounded-xl border border-dashed border-[var(--pi-border-strong)] p-8 sm:flex-row sm:items-center">
          <div>
            <h2 className="t-h3">Want to see your name here?</h2>
            <p className="mt-1 text-[var(--pi-text-muted)]">Support PlanIt development or request your favorite feature.</p>
          </div>
          <a href="/support" className="btn btn-primary btn-lg shrink-0">Support PlanIt</a>
        </div>
      </section>
    </PublicLayout>
  );
}
