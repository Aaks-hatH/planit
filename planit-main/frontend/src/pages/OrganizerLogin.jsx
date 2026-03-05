import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, AlertCircle, Eye, EyeOff, Clock, Utensils, Hash, Users, ShieldCheck } from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';

function TableServiceLogin({ eventId, eventTitle, subdomain, isPasswordProtected }) {
  const navigate  = useNavigate();
  const floorPath = eventId ? `/event/${eventId}/floor` : `/e/${subdomain}/floor`;

  // 'staff' | 'organizer'
  const [tab, setTab] = useState('staff');

  // ── Staff login state ──────────────────────────────────────────────────
  const [staffUser, setStaffUser] = useState('');
  const [staffPin,  setStaffPin]  = useState('');
  const [showPin,   setShowPin]   = useState(false);
  const [staffErr,  setStaffErr]  = useState('');
  const [staffLoading, setStaffLoading] = useState(false);

  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    setStaffErr('');
    if (!staffUser.trim()) { setStaffErr('Username is required'); return; }
    if (!staffPin)         { setStaffErr('PIN is required');      return; }
    setStaffLoading(true);
    try {
      const res = await eventAPI.staffLogin(eventId, staffUser.trim(), staffPin);
      localStorage.setItem('eventToken', res.data.token);
      localStorage.setItem('username',   res.data.username);
      toast.success('Welcome back!');
      navigate(floorPath);
    } catch (err) {
      setStaffErr(err?.response?.data?.error || 'Invalid username or PIN');
    } finally {
      setStaffLoading(false);
    }
  };

  // ── Organizer login state ──────────────────────────────────────────────
  const [orgName,    setOrgName]    = useState('');
  const [orgEvtPass, setOrgEvtPass] = useState('');
  const [orgAccPass, setOrgAccPass] = useState('');
  const [showEvtPass,  setShowEvtPass]  = useState(false);
  const [showAccPass,  setShowAccPass]  = useState(false);
  const [orgErr,       setOrgErr]       = useState('');
  const [orgFieldErrs, setOrgFieldErrs] = useState({});
  const [orgLoading,   setOrgLoading]   = useState(false);
  const [needsAccPass, setNeedsAccPass] = useState(false);

  const handleOrgSubmit = async (e) => {
    e.preventDefault();
    setOrgErr('');
    const errs = {};
    const name = orgName.trim();
    if (!name) errs.name = 'Please enter your organizer name.';
    if (isPasswordProtected && !orgEvtPass) errs.evtPass = 'Please enter the event password.';
    if (needsAccPass && !orgAccPass) errs.accPass = 'Account password required.';
    if (Object.keys(errs).length) { setOrgFieldErrs(errs); return; }
    setOrgFieldErrs({});
    setOrgLoading(true);
    try {
      let res;
      if (isPasswordProtected) {
        res = await eventAPI.verifyPassword(eventId, {
          username: name, password: orgEvtPass,
          accountPassword: orgAccPass || undefined,
        });
      } else {
        res = await eventAPI.join(eventId, {
          username: name, accountPassword: orgAccPass || undefined,
        });
      }
      localStorage.setItem('eventToken', res.data.token);
      localStorage.setItem('username', name);
      toast.success('Logged in successfully!');
      navigate(floorPath);
    } catch (err) {
      const data = err.response?.data;
      const msg  = data?.error || 'Login failed. Please check your credentials.';
      if (data?.requiresAccountPassword && !needsAccPass) {
        setNeedsAccPass(true);
        setOrgFieldErrs({ accPass: 'This username has an account — enter your account password.' });
        setOrgLoading(false);
        return;
      }
      if (msg.toLowerCase().includes('password') && isPasswordProtected) setOrgFieldErrs({ evtPass: msg });
      else if (msg.toLowerCase().includes('account password')) setOrgFieldErrs({ accPass: msg });
      else setOrgErr(msg);
    } finally {
      setOrgLoading(false);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-600 text-sm focus:outline-none focus:border-neutral-500 transition-colors";
  const labelCls = "block text-xs font-semibold text-neutral-400 mb-1.5 uppercase tracking-wide";
  const errBox   = (msg) => msg ? (
    <div className="flex items-center gap-2 p-3 bg-rose-950/60 border border-rose-500/30 rounded-xl mt-1">
      <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
      <p className="text-sm text-rose-300">{msg}</p>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4">
            <Utensils className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">
            {tab === 'staff' ? 'Staff Login' : 'Organizer Login'}
          </h1>
          {eventTitle && <p className="text-sm text-neutral-400 font-medium">{eventTitle}</p>}
        </div>

        {/* Tab switcher */}
        <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl p-1 mb-4">
          <button
            onClick={() => setTab('staff')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === 'staff'
                ? 'bg-white text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />Staff
          </button>
          <button
            onClick={() => setTab('organizer')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === 'organizer'
                ? 'bg-white text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />Organizer
          </button>
        </div>

        {/* ── Staff form ── */}
        {tab === 'staff' && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <form onSubmit={handleStaffSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Username</label>
                <input type="text" autoFocus autoComplete="username"
                  placeholder="Your staff username"
                  value={staffUser}
                  onChange={e => { setStaffUser(e.target.value); setStaffErr(''); }}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}><Hash className="w-3 h-3 inline mr-1" />PIN</label>
                <div className="relative">
                  <input type={showPin ? 'text' : 'password'} inputMode="numeric" autoComplete="current-password"
                    placeholder="4–8 digit PIN"
                    value={staffPin}
                    onChange={e => { setStaffPin(e.target.value); setStaffErr(''); }}
                    className={inputCls + ' pr-10'}
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPin(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300">
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {errBox(staffErr)}
              <button type="submit" disabled={staffLoading}
                className="w-full py-2.5 bg-white text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {staffLoading
                  ? <span className="w-4 h-4 border-2 border-neutral-400 border-t-neutral-900 rounded-full animate-spin" />
                  : <>Sign In <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </div>
        )}

        {/* ── Organizer form ── */}
        {tab === 'organizer' && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <form onSubmit={handleOrgSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Organizer Name</label>
                <input type="text" autoFocus autoComplete="username"
                  placeholder="Your organizer name"
                  value={orgName}
                  onChange={e => { setOrgName(e.target.value); setOrgFieldErrs(p => ({ ...p, name: '' })); }}
                  className={inputCls}
                />
                {errBox(orgFieldErrs.name)}
              </div>

              {isPasswordProtected && (
                <div>
                  <label className={labelCls}>Event Password</label>
                  <div className="relative">
                    <input type={showEvtPass ? 'text' : 'password'}
                      placeholder="The shared event password"
                      value={orgEvtPass}
                      onChange={e => { setOrgEvtPass(e.target.value); setOrgFieldErrs(p => ({ ...p, evtPass: '' })); }}
                      className={inputCls + ' pr-10'}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowEvtPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300">
                      {showEvtPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errBox(orgFieldErrs.evtPass)}
                </div>
              )}

              <div>
                <label className={labelCls}>
                  Account Password{needsAccPass ? ' *' : ' (optional)'}
                </label>
                <div className="relative">
                  <input type={showAccPass ? 'text' : 'password'}
                    placeholder={needsAccPass ? 'Your personal account password' : 'Leave blank if not set'}
                    value={orgAccPass}
                    onChange={e => { setOrgAccPass(e.target.value); setOrgFieldErrs(p => ({ ...p, accPass: '' })); }}
                    className={inputCls + ' pr-10'}
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowAccPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300">
                    {showAccPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errBox(orgFieldErrs.accPass)}
              </div>

              {errBox(orgErr)}

              <button type="submit" disabled={orgLoading}
                className="w-full py-2.5 bg-white text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {orgLoading
                  ? <span className="w-4 h-4 border-2 border-neutral-400 border-t-neutral-900 rounded-full animate-spin" />
                  : <>Sign In <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-neutral-600 mt-4">
          {tab === 'staff' ? 'Staff accounts are created by the venue manager' : 'Use the name and password you set when creating this event'}
        </p>
      </div>
    </div>
  );
}

export default function OrganizerLogin() {
  const { eventId: eventIdParam, subdomain } = useParams();
  const navigate = useNavigate();

  const [resolvedEventId, setResolvedEventId]           = useState(eventIdParam || null);
  const [isTableService, setIsTableService]             = useState(false);
  const [eventTitle, setEventTitle]                     = useState('');
  const [loadingEvent, setLoadingEvent]                 = useState(true);
  const [isPasswordProtected, setIsPasswordProtected]   = useState(false);
  const [formData, setFormData]                         = useState({ username: '', eventPassword: '', accountPassword: '' });
  const [loading, setLoading]                           = useState(false);
  const [error, setError]                               = useState('');
  const [showEventPass, setShowEventPass]               = useState(false);
  const [showAccountPass, setShowAccountPass]           = useState(false);
  const [needsAccountPassword, setNeedsAccountPassword] = useState(false);
  const [fieldErrors, setFieldErrors]                   = useState({});
  const [pendingApproval, setPendingApproval]           = useState(false);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        let eid = eventIdParam;
        if (!eid && subdomain) {
          const subRes = await eventAPI.getBySubdomain(subdomain);
          eid = subRes.data.event?.id;
          if (!eid) throw new Error('not found');
          setResolvedEventId(eid);
        }
        if (!eid) { toast.error('Event not found'); navigate('/'); return; }
        const res = await eventAPI.getPublicInfo(eid);
        const ev  = res.data.event;
        setEventTitle(ev.title);
        setIsPasswordProtected(ev.isPasswordProtected);
        setIsTableService(!!ev.isTableServiceMode);
        setResolvedEventId(eid);
      } catch {
        toast.error('Event not found');
        navigate('/');
      } finally {
        setLoadingEvent(false);
      }
    };
    loadEvent();
  }, [eventIdParam, subdomain]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pendingApproval || !resolvedEventId) return;
    const username = localStorage.getItem('username') || formData.username.trim();
    if (!username) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await eventAPI.checkApprovalStatus(resolvedEventId, username);
        if (cancelled) return;
        if (res.data?.approved && res.data?.token) {
          localStorage.setItem('eventToken', res.data.token);
          localStorage.setItem('username', username);
          toast.success('Your join request was approved!');
          navigate(`/event/${resolvedEventId}`);
        }
      } catch { /* retry */ }
    };
    poll();
    const interval = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [pendingApproval, resolvedEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (field) => (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errs = {};
    const trimmedUsername = formData.username.trim();
    if (!trimmedUsername) errs.username = 'Please enter your organizer name.';
    if (isPasswordProtected && !formData.eventPassword) errs.eventPassword = 'Please enter the event password.';
    if (needsAccountPassword && !formData.accountPassword) errs.accountPassword = 'Account password required.';
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setLoading(true);
    try {
      let res;
      if (isPasswordProtected) {
        res = await eventAPI.verifyPassword(resolvedEventId, {
          username: trimmedUsername, password: formData.eventPassword,
          accountPassword: formData.accountPassword || undefined
        });
      } else {
        res = await eventAPI.join(resolvedEventId, {
          username: trimmedUsername, accountPassword: formData.accountPassword || undefined
        });
      }
      try {
        const b64 = res.data.token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = b64 ? JSON.parse(atob(b64)) : null;
        if (!decoded || decoded.eventId !== resolvedEventId) throw new Error('mismatch');
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
      if (data?.requiresApproval) {
        setPendingApproval(true); localStorage.setItem('username', trimmedUsername);
        setLoading(false); return;
      }
      if (data?.requiresAccountPassword && !needsAccountPassword) {
        setNeedsAccountPassword(true);
        setFieldErrors({ accountPassword: 'This username has an account — enter your account password.' });
        setLoading(false); return;
      }
      if (errorMsg.toLowerCase().includes('password') && isPasswordProtected) setFieldErrors({ eventPassword: errorMsg });
      else if (errorMsg.toLowerCase().includes('account password')) setFieldErrors({ accountPassword: errorMsg });
      else setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (loadingEvent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (isTableService) {
    return <TableServiceLogin eventId={resolvedEventId} eventTitle={eventTitle} subdomain={subdomain} isPasswordProtected={isPasswordProtected} />;
  }

  if (pendingApproval) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-10">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mb-5">
              <Clock className="w-7 h-7 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 mb-2">Awaiting Organizer Approval</h2>
            <p className="text-sm text-neutral-500 leading-relaxed mb-5">
              Your request to join as <strong className="text-neutral-700">{formData.username || localStorage.getItem('username')}</strong> has been sent.
            </p>
            <div className="flex items-center justify-center gap-2 py-3 px-4 bg-amber-50 border border-amber-200 rounded-xl mb-5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-semibold text-amber-700">Checking every few seconds…</span>
            </div>
            <button onClick={() => { setPendingApproval(false); setError(''); }}
              className="text-xs text-neutral-400 hover:text-neutral-700 underline underline-offset-2">
              ← Try a different name
            </button>
          </div>
        </div>
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
          {eventTitle && <p className="text-sm text-neutral-600 font-medium mb-1">{eventTitle}</p>}
          <p className="text-sm text-neutral-500">Log back in to access your event</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Your Organizer Name <span className="text-red-500">*</span>
              </label>
              <input type="text" required autoFocus autoComplete="off"
                placeholder="Enter your organizer name"
                value={formData.username}
                onChange={e => { handleChange('username')(e); setFieldErrors(p => ({ ...p, username: '' })); }}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 ${fieldErrors.username ? 'border-red-400 bg-red-50' : 'border-neutral-200'}`}
              />
              {fieldErrors.username && (
                <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />{fieldErrors.username}
                </p>
              )}
            </div>

            {isPasswordProtected && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Event Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input type={showEventPass ? 'text' : 'password'} required
                    placeholder="The shared event password"
                    value={formData.eventPassword}
                    onChange={e => { handleChange('eventPassword')(e); setFieldErrors(p => ({ ...p, eventPassword: '' })); }}
                    className={`w-full px-3.5 py-2.5 pr-10 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 ${fieldErrors.eventPassword ? 'border-red-400 bg-red-50' : 'border-neutral-200'}`}
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowEventPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                    {showEventPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.eventPassword && (
                  <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />{fieldErrors.eventPassword}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Account Password{needsAccountPassword && <span className="text-red-500 ml-1">*</span>}
              </label>
              <div className="relative">
                <input type={showAccountPass ? 'text' : 'password'} required={needsAccountPassword}
                  placeholder={needsAccountPassword ? 'Required — your personal account password' : 'Your personal account password (optional)'}
                  value={formData.accountPassword}
                  onChange={e => { handleChange('accountPassword')(e); setFieldErrors(p => ({ ...p, accountPassword: '' })); }}
                  className={`w-full px-3.5 py-2.5 pr-10 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 ${fieldErrors.accountPassword ? 'border-red-400 bg-red-50' : 'border-neutral-200'}`}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowAccountPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                  {showAccountPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.accountPassword ? (
                <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />{fieldErrors.accountPassword}
                </p>
              ) : (
                <p className="text-xs text-neutral-400 mt-1.5">The personal password you set when creating the event</p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <>Log In <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-neutral-100 text-center">
            <p className="text-xs text-neutral-400">
              Don't remember your password? Access from the original device or contact support.
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button onClick={() => navigate('/')} className="text-sm text-neutral-500 hover:text-neutral-700">
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
