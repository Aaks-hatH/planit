import { useState } from 'react';
import { Heart, Coffee, Sparkles, DollarSign } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PublicLayout from '../components/ui/PublicLayout';

// Plain axios instance with no auth interceptors for public support routes
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

export default function Support() {
  const navigate = useNavigate();
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
      if (!res.data.payUrl) {
        toast.error('Could not start the payment. Please try again.');
        return;
      }
      navigate(res.data.payUrl); // PlanIt Payments (Bitcoin) pay page
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
      if (!res.data.payUrl) {
        toast.error('Could not start the payment. Please try again.');
        return;
      }
      navigate(res.data.payUrl); // PlanIt Payments (Bitcoin) pay page
    } catch (error) {
      console.error('Feature request error:', error);
      toast.error(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to create feature request');
    } finally {
      setLoading(false);
    }
  };

  const amountButtons = (list, form, setForm, compact) => (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="group">
      {list.map((preset) => {
        const on = form.amount === preset.amount;
        return (
          <button
            key={preset.amount}
            type="button"
            aria-pressed={on}
            onClick={() => setForm({ ...form, amount: preset.amount })}
            className={`rounded-lg border px-2 py-3 text-center transition-all duration-150 active:scale-[0.97] ${
              on
                ? 'border-[var(--pi-action)] bg-[var(--pi-action)] text-[var(--pi-action-ink)] shadow-md'
                : 'border-[var(--pi-border-strong)] bg-[var(--pi-surface)] hover:border-[var(--pi-ink-400)]'
            }`}
            style={{ minHeight: 64 }}
          >
            <span className={`block font-semibold leading-tight ${compact ? 'text-xs' : 'text-sm'}`}>{preset.label.trim()}</span>
            <span className="t-num mt-1 block text-xs opacity-75">${preset.amount / 100}</span>
          </button>
        );
      })}
    </div>
  );

  const submitLabel = (icon, text) => loading ? (
    <>
      <span className="spinner h-4 w-4 border-2 border-white/30 border-t-white" />
      Starting checkout...
    </>
  ) : (<>{icon}{text}</>);

  return (
    <PublicLayout
      eyebrow="Support PlanIt"
      title="Keep PlanIt free for everyone."
      lead={<>PlanIt is <strong className="font-semibold text-[var(--pi-text)]">100% free</strong> and always will be. If it has been useful, chip in, or put weight behind the feature you want built next.</>}
      meta={<><span>Payments in Bitcoin, priced in USD</span><a href="/support/wall" className="font-medium text-[var(--pi-accent)] hover:underline">See the Wall of Supporters</a></>}
    >
      <section className="grid gap-10 pb-24 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <div>
          <div className="tabs mb-6" role="tablist" aria-label="Contribution type">
            <button role="tab" id="tab-support" aria-selected={activeTab === 'support'} aria-controls="panel-support" className="tab" onClick={() => setActiveTab('support')}>
              <Coffee className="mr-2 inline h-4 w-4" />Support us
            </button>
            <button role="tab" id="tab-feature" aria-selected={activeTab === 'feature'} aria-controls="panel-feature" className="tab" onClick={() => setActiveTab('feature')}>
              <Sparkles className="mr-2 inline h-4 w-4" />Request a feature
            </button>
          </div>

          {activeTab === 'support' && (
            <div id="panel-support" role="tabpanel" aria-labelledby="tab-support" className="card animate-fade-in p-6 sm:p-8">
              <h2 className="t-h3 mb-1">Buy us a coffee</h2>
              <p className="mb-6 text-[var(--pi-text-muted)]">Your support keeps PlanIt free and pays for new features.</p>

              <form onSubmit={handleSupport} className="space-y-6">
                <div>
                  <span className="label mb-3">Choose an amount</span>
                  {amountButtons(presetAmounts, supportForm, setSupportForm)}
                  <div className="relative mt-3">
                    <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--pi-text-faint)]" />
                    <input
                      type="number" min="3" step="1" inputMode="decimal" aria-label="Custom amount in US dollars"
                      value={supportForm.amount / 100}
                      onChange={(e) => setSupportForm({ ...supportForm, amount: Math.round(e.target.value * 100) })}
                      className="input t-num pl-9" placeholder="Custom amount"
                    />
                  </div>
                  <p className="field-hint">Minimum $3.</p>
                </div>

                <div>
                  <label htmlFor="s-email" className="label">Email <span className="text-[var(--pi-alert)]">*</span></label>
                  <input id="s-email" type="email" required autoComplete="email" value={supportForm.email}
                    onChange={(e) => setSupportForm({ ...supportForm, email: e.target.value })} className="input" placeholder="you@example.com" />
                  <p className="field-hint">For your receipt. We never share it.</p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="s-name" className="label">Your name <span className="font-normal text-[var(--pi-text-faint)]">(optional)</span></label>
                    <input id="s-name" type="text" value={supportForm.name}
                      onChange={(e) => setSupportForm({ ...supportForm, name: e.target.value })} className="input" placeholder="Anonymous" />
                    <p className="field-hint">Shown on the Wall of Supporters.</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="s-msg" className="label">Message <span className="font-normal text-[var(--pi-text-faint)]">(optional)</span></label>
                    <textarea id="s-msg" value={supportForm.message}
                      onChange={(e) => setSupportForm({ ...supportForm, message: e.target.value })}
                      className="input" rows="3" maxLength="500" placeholder="Say something nice..." />
                    <p className="field-hint t-num">{supportForm.message.length}/500</p>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
                  {submitLabel(<Heart className="h-4 w-4" />, <>Support <span className="t-num">${(supportForm.amount / 100).toFixed(2)}</span></>)}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'feature' && (
            <div id="panel-feature" role="tabpanel" aria-labelledby="tab-feature" className="card animate-fade-in p-6 sm:p-8">
              <h2 className="t-h3 mb-1">Request a feature</h2>
              <p className="mb-6 text-[var(--pi-text-muted)]">Back your request with a contribution and we will prioritize it. Higher contributions are built first.</p>

              <form onSubmit={handleFeatureRequest} className="space-y-6">
                <div>
                  <label htmlFor="f-desc" className="label">What should we build? <span className="text-[var(--pi-alert)]">*</span></label>
                  <textarea id="f-desc" required value={featureForm.feature}
                    onChange={(e) => setFeatureForm({ ...featureForm, feature: e.target.value })}
                    className="input" rows="4" maxLength="500" placeholder="Describe the feature you want (at least 10 characters)" />
                  <p className="field-hint t-num">{featureForm.feature.length}/500</p>
                </div>

                <div>
                  <span className="label mb-3">Priority <span className="text-[var(--pi-alert)]">*</span></span>
                  {amountButtons(featureAmounts, featureForm, setFeatureForm, true)}
                  <p className="field-hint">Higher amounts move a request up the roadmap. Minimum $5.</p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="f-email" className="label">Email <span className="text-[var(--pi-alert)]">*</span></label>
                    <input id="f-email" type="email" required autoComplete="email" value={featureForm.email}
                      onChange={(e) => setFeatureForm({ ...featureForm, email: e.target.value })} className="input" placeholder="you@example.com" />
                    <p className="field-hint">We will tell you when it ships.</p>
                  </div>
                  <div>
                    <label htmlFor="f-name" className="label">Your name <span className="font-normal text-[var(--pi-text-faint)]">(optional)</span></label>
                    <input id="f-name" type="text" value={featureForm.name}
                      onChange={(e) => setFeatureForm({ ...featureForm, name: e.target.value })} className="input" placeholder="Anonymous" />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
                  {submitLabel(<Sparkles className="h-4 w-4" />, <>Request feature <span className="t-num">${(featureForm.amount / 100).toFixed(2)}</span></>)}
                </button>
              </form>
            </div>
          )}

          <p className="t-meta mt-5">Payments are made in Bitcoin and go directly to PlanIt. Prices are in USD and converted at the current rate when you check out.</p>
        </div>

        <aside className="lg:pt-[3.25rem]" aria-label="Why support PlanIt">
          <dl className="divide-y divide-[var(--pi-border)] border-y border-[var(--pi-border)]">
            {[
              { icon: Heart, k: '100% free', v: 'PlanIt will always be free. No paywalls, no limits.' },
              { icon: Sparkles, k: 'Built in the open', v: 'Built by the community, for the community.' },
              { icon: Coffee, k: 'Supports the developers', v: 'Contributions fund the time that goes into new features.' },
            ].map(({ icon: Icon, k, v }) => (
              <div key={k} className="flex gap-4 py-5">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--pi-accent-soft)] text-[var(--pi-accent)]"><Icon className="h-4 w-4" strokeWidth={1.75} /></span>
                <div>
                  <dt className="font-display font-semibold tracking-tight">{k}</dt>
                  <dd className="mt-1 text-sm text-[var(--pi-text-muted)]">{v}</dd>
                </div>
              </div>
            ))}
          </dl>
        </aside>
      </section>
    </PublicLayout>
  );
}
