import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Copy, Eye, KeyRound, Loader2, Network, ShieldCheck, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { adminAPI } from '../services/api';
import { FIELD, SECTION_LABEL, TONE, TONE_BAR, sectionsFrom, roleLabel } from './teamShared';

/**
 * AddPersonWizard - the one way to add a person to the team.
 *
 * Used from three places, each pre-filling what it already knows:
 *   Team page            blank
 *   Careers application  name / email / role title / department + applicationId (marked accepted on create)
 *   Org chart open box   position to fill (orgNodeId) + title / department
 *
 * Three short steps (Who -> Role & place -> Access) then a credentials screen. The server does the rest in one call:
 * role -> default permissions, a one-time password, the org-chart box and the application status.
 */

const STEPS = ['Who', 'Role & place', 'Access'];
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function Lbl({ t, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-neutral-500">{t}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-neutral-400">{hint}</span>}
    </label>
  );
}

export default function AddPersonWizard({ prefill = {}, onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [custom, setCustom] = useState(false);

  const [form, setForm] = useState({
    name: prefill.name || '', email: prefill.email || '', startDate: new Date().toISOString().slice(0, 10),
    location: prefill.location || '', timezone: prefill.timezone || '', phone: prefill.phone || '',
    role: prefill.role || 'volunteer', department: prefill.department || '', positionTitle: prefill.positionTitle || '',
    place: prefill.orgNodeId ? 'fill' : 'new',          // 'fill' an open position | 'new' box under a manager
    orgNodeId: prefill.orgNodeId || '', managerNodeId: prefill.managerNodeId || '',
    permissions: null,                                    // null = use the role's defaults
    password: '', forcePasswordReset: true,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, o] = await Promise.all([adminAPI.getTeamCatalog(), api.get('/careers/admin/org')]);
        if (!alive) return;
        setCatalog(c.data); setNodes(o.data.nodes || []);
      } catch (e) { toast.error(e?.response?.data?.error || 'Could not load roles and the org chart'); } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const role = useMemo(() => (catalog?.roles || []).find((r) => r.id === form.role), [catalog, form.role]);
  const preset = useMemo(() => Object.fromEntries((catalog?.keys || []).map((k) => [k, !!role?.perms.includes(k)])), [catalog, role]);
  const perms = form.permissions || preset;
  const granted = (catalog?.keys || []).filter((k) => perms[k]).length;
  const sections = useMemo(() => sectionsFrom(catalog, perms, form.role), [catalog, perms, form.role]);

  const openNodes = nodes.filter((n) => n.status === 'open');
  const managers = [...nodes].sort((a, b) => a.level - b.level);
  const nodeLabel = (n) => `${'— '.repeat(n.level)}${n.status === 'open' ? 'Open' : n.personName} · ${n.title}`;
  const chosenOpen = nodes.find((n) => n._id === form.orgNodeId);
  const chosenMgr = nodes.find((n) => n._id === (form.place === 'fill' ? chosenOpen?.parentId : form.managerNodeId));
  // People who already hold this role. Several people can share one role, so a new person is placed beside them.
  const titleKey = form.positionTitle.trim().toLowerCase();
  const sameRole = titleKey ? nodes.filter((n) => n.status === 'filled' && !n.owner && String(n.title || '').trim().toLowerCase() === titleKey) : [];

  // Picking an open position fills in its title and department so nobody types it twice.
  const pickOpen = (id) => {
    const n = nodes.find((x) => x._id === id);
    setForm((f) => ({ ...f, orgNodeId: id, positionTitle: n ? n.title : f.positionTitle, department: f.department || n?.department || '' }));
  };
  useEffect(() => {   // launched from a Careers application: if that role has an open box on the chart, fill it
    if (prefill.jobSlug && !prefill.orgNodeId && nodes.length) {
      const n = nodes.find((x) => x.status === 'open' && x.jobSlug === prefill.jobSlug);
      if (n) setForm((f) => ({ ...f, place: 'fill', orgNodeId: n._id, positionTitle: f.positionTitle || n.title, department: f.department || n.department || '' }));
    }
  }, [nodes.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {   // role already has people and no open seat: sit beside them (same manager) instead of under the top box
    if (!nodes.length || prefill.orgNodeId || prefill.managerNodeId || !prefill.positionTitle) return;
    const key = prefill.positionTitle.trim().toLowerCase();
    if (nodes.some((x) => x.status === 'open' && x.jobSlug && x.jobSlug === prefill.jobSlug)) return;
    const mate = nodes.find((x) => x.status === 'filled' && !x.owner && String(x.title || '').trim().toLowerCase() === key);
    if (mate) setForm((f) => (f.managerNodeId ? f : { ...f, place: 'new', managerNodeId: mate.parentId || '' }));
  }, [nodes.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {   // when launched from an open box, take its title/department
    if (prefill.orgNodeId && nodes.length) {
      const n = nodes.find((x) => x._id === prefill.orgNodeId);
      if (n) setForm((f) => ({ ...f, positionTitle: f.positionTitle || n.title, department: f.department || n.department || '' }));
    }
  }, [nodes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePerm = (k) => setForm((f) => ({ ...f, permissions: { ...(f.permissions || preset), [k]: !(f.permissions || preset)[k] } }));
  const chooseRole = (id) => setForm((f) => ({ ...f, role: id, permissions: null }));   // a new role resets to that role's defaults

  const validStep = (n) => {
    if (n === 0) {
      if (!form.name.trim()) { toast.error('Add their name'); return false; }
      if (!EMAIL_RE.test(form.email.trim())) { toast.error('Add a valid email address'); return false; }
    }
    if (n === 1) {
      if (form.place === 'fill' && !form.orgNodeId) { toast.error('Pick the open position they are filling, or choose "New position"'); return false; }
    }
    if (n === 2 && form.password.trim() && !/^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{10,}$/.test(form.password.trim())) {
      toast.error('Password needs 10+ characters with an uppercase letter, a number and a special character'); return false;
    }
    return true;
  };
  const next = () => { if (validStep(step)) setStep((s) => s + 1); };

  const submit = async () => {
    if (!validStep(0) || !validStep(1) || !validStep(2)) return;
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(), email: form.email.trim(), role: form.role, startDate: form.startDate || undefined,
        department: form.department.trim(), location: form.location.trim(), timezone: form.timezone.trim(), phone: form.phone.trim(),
        positionTitle: form.positionTitle.trim(),
        ...(form.place === 'fill' ? { orgNodeId: form.orgNodeId } : { managerNodeId: form.managerNodeId || undefined }),
        ...(form.permissions ? { permissions: form.permissions } : {}),
        ...(form.password.trim() ? { password: form.password.trim() } : {}),
        forcePasswordReset: form.forcePasswordReset,
        ...(prefill.applicationId ? { applicationId: prefill.applicationId } : {}),
      };
      const r = await adminAPI.createEmployee(body);
      setResult({ ...r.data, password: r.data.tempPassword || form.password.trim() });
      onCreated?.(r.data);
    } catch (e) { toast.error(e?.response?.data?.error || 'Could not add this person'); } finally { setBusy(false); }
  };

  const copy = (text, label) => navigator.clipboard?.writeText(text).then(() => toast.success(`${label} copied`), () => toast.error('Copy failed'));
  const loginUrl = `${window.location.origin}/admin`;
  const welcome = result ? `Hi ${form.name.split(' ')[0]}, welcome to the PlanIt team!\n\nSign in at ${loginUrl}\nEmail: ${form.email.trim()}\nTemporary password: ${result.password}\n\n${form.forcePasswordReset ? 'You will be asked to choose your own password the first time you sign in.' : ''}`.trim() : '';

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 px-3 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-6 py-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-lg font-black text-neutral-900"><UserPlus className="h-5 w-5" />{result ? 'Person added' : 'Add a person'}</h3>
            <p className="text-xs text-neutral-500">
              {prefill.label || (result ? 'They are on the team and on the org chart.' : 'Role decides what they can see. You can fine-tune it before saving.')}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        {/* stepper */}
        {!result && (
          <div className="flex gap-1 border-b border-neutral-100 px-6 py-3">
            {STEPS.map((s, i) => (
              <button key={s} type="button" onClick={() => i < step && setStep(i)} className={`flex flex-1 items-center gap-2 text-left ${i <= step ? 'text-neutral-900' : 'text-neutral-400'}`}>
                <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-500'}`}>{i < step ? <Check className="h-3 w-3" /> : i + 1}</span>
                <span className="hidden text-xs font-bold sm:block">{s}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-neutral-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading…</div>
          ) : result ? (
            /* ───────── done ───────── */
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <b>{form.name}</b> is now a <b>{roleLabel(catalog, form.role)}</b>
                {result.node ? <> on the org chart{chosenMgr ? <>, reporting to <b>{chosenMgr.status === 'open' ? 'an open position' : chosenMgr.personName}</b></> : null}.</> : '.'}
                {result.application && <> Their application was marked <b>accepted</b>.</>}
              </div>
              {result.chartError && <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="h-4 w-4 flex-shrink-0" />The account was created, but they could not be placed on the org chart: {result.chartError} Add them from the chart.</div>}

              <div className="rounded-xl border border-neutral-200 p-4">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-neutral-400"><KeyRound className="h-3.5 w-3.5" />Sign-in details</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2"><span className="text-neutral-500">Sign in at</span><button onClick={() => copy(loginUrl, 'Link')} className="truncate font-mono text-xs text-indigo-600 hover:underline">{loginUrl}</button></div>
                  <div className="flex items-center justify-between gap-2"><span className="text-neutral-500">Email</span><span className="font-semibold">{form.email.trim()}</span></div>
                  <div className="flex items-center justify-between gap-2"><span className="text-neutral-500">{result.tempPassword ? 'Temporary password' : 'Password'}</span>
                    {result.password ? <button onClick={() => copy(result.password, 'Password')} className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-2.5 py-1 font-mono text-xs font-bold text-white">{result.password}<Copy className="h-3 w-3" /></button> : <span className="text-neutral-400">set by you</span>}
                  </div>
                </div>
                {result.tempPassword && <p className="mt-3 text-xs text-amber-700">This password is shown <b>once</b>. It is not stored anywhere you can read it back, so copy it now.{form.forcePasswordReset && ' They will be made to choose a new one on first sign-in.'}</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => copy(welcome, 'Welcome message')} className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-700"><Copy className="h-4 w-4" />Copy welcome message</button>
                <a href={`mailto:${form.email.trim()}?subject=${encodeURIComponent('Welcome to PlanIt')}&body=${encodeURIComponent(welcome)}`} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50">Open in email</a>
              </div>
            </div>
          ) : step === 0 ? (
            /* ───────── step 1: who ───────── */
            <div className="grid gap-4 sm:grid-cols-2">
              {prefill.label && <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800 sm:col-span-2">{prefill.label}</div>}
              <Lbl t="Full name *"><input autoFocus className={FIELD} value={form.name} maxLength={100} onChange={(e) => set('name', e.target.value)} placeholder="Jane Smith" /></Lbl>
              <Lbl t="Email *" hint="They sign in with this."><input type="email" className={FIELD} value={form.email} maxLength={160} onChange={(e) => set('email', e.target.value)} placeholder="jane@example.com" /></Lbl>
              <Lbl t="Start date"><input type="date" className={FIELD} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /></Lbl>
              <Lbl t="Phone (optional)"><input className={FIELD} value={form.phone} maxLength={30} onChange={(e) => set('phone', e.target.value)} /></Lbl>
              <Lbl t="Location (optional)"><input className={FIELD} value={form.location} maxLength={100} onChange={(e) => set('location', e.target.value)} placeholder="New Jersey" /></Lbl>
              <Lbl t="Time zone (optional)"><input className={FIELD} value={form.timezone} maxLength={60} onChange={(e) => set('timezone', e.target.value)} placeholder="America/New_York" /></Lbl>
            </div>
          ) : step === 1 ? (
            /* ───────── step 2: role & place ───────── */
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Role</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(catalog?.roles || []).filter((r) => !r.demo).map((r) => (
                    <button key={r.id} type="button" onClick={() => chooseRole(r.id)} className={`flex gap-3 rounded-xl border p-3 text-left transition ${form.role === r.id ? 'border-neutral-900 ring-2 ring-neutral-900/10' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                      <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${TONE_BAR[r.tone] || 'bg-neutral-400'}`} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-black text-neutral-900">{r.label}{r.id === 'volunteer' && <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">default</span>}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-neutral-500">{r.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {form.role === 'super_admin' && <p className="mt-2 flex gap-2 rounded-lg bg-purple-50 p-2 text-xs text-purple-800"><ShieldCheck className="h-4 w-4 flex-shrink-0" />Super admins can do everything, including managing the team. Only choose this for someone you fully trust.</p>}
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500"><Network className="h-3.5 w-3.5" />Place on the org chart</div>
                <div className="mb-3 flex gap-1 rounded-xl bg-neutral-100 p-1">
                  <button type="button" onClick={() => set('place', 'fill')} className={`flex-1 rounded-lg py-1.5 text-sm font-bold transition ${form.place === 'fill' ? 'bg-white shadow-sm' : 'text-neutral-500'}`}>Fill an open position{openNodes.length ? ` (${openNodes.length})` : ''}</button>
                  <button type="button" onClick={() => set('place', 'new')} className={`flex-1 rounded-lg py-1.5 text-sm font-bold transition ${form.place === 'new' ? 'bg-white shadow-sm' : 'text-neutral-500'}`}>New position</button>
                </div>
                {form.place === 'fill' ? (
                  openNodes.length === 0
                    ? <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-500">There are no open positions on the chart. Switch to "New position".</p>
                    : <Lbl t="Open position" hint="They take this box. Multi-opening roles keep hiring for the rest."><select className={FIELD} value={form.orgNodeId} onChange={(e) => pickOpen(e.target.value)}><option value="">Choose…</option>{openNodes.map((n) => <option key={n._id} value={n._id}>{n.title}{n.department ? ` · ${n.department}` : ''}{(n.seats || 1) > 1 ? ` (${n.seats} openings)` : ''}</option>)}</select></Lbl>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Lbl t="Reports to (manager)" hint="Their manager sees their sign-ins and they see their manager."><select className={FIELD} value={form.managerNodeId} onChange={(e) => set('managerNodeId', e.target.value)}><option value="">Top of the chart</option>{managers.filter((n) => n.level < 9).map((n) => <option key={n._id} value={n._id}>{nodeLabel(n)}</option>)}</select></Lbl>
                    <Lbl t="Position title"><input className={FIELD} value={form.positionTitle} maxLength={120} onChange={(e) => set('positionTitle', e.target.value)} placeholder={role ? role.label : 'Community Lead'} /></Lbl>
                  </div>
                )}
                {form.place === 'new' && sameRole.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    <span>{sameRole.length === 1 ? `${sameRole[0].personName} already holds` : `${sameRole.length} people already hold`} <b>{form.positionTitle.trim()}</b>. Several people can share a role, and they show side by side on the chart.</span>
                    {form.managerNodeId !== (sameRole[0].parentId || '') && <button type="button" onClick={() => set('managerNodeId', sameRole[0].parentId || '')} className="rounded-md bg-emerald-600 px-2 py-1 font-bold text-white hover:bg-emerald-700">Sit beside them</button>}
                  </div>
                )}
                {form.place === 'fill' && chosenOpen && (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Lbl t="Position title"><input className={FIELD} value={form.positionTitle} maxLength={120} onChange={(e) => set('positionTitle', e.target.value)} /></Lbl>
                    <div className="text-xs text-neutral-500 sm:pt-6">{chosenMgr ? <>Reports to <b className="text-neutral-800">{chosenMgr.status === 'open' ? 'an open position' : chosenMgr.personName}</b></> : 'Top of the chart'}</div>
                  </div>
                )}
                <div className="mt-3"><Lbl t="Department (optional)"><input className={FIELD} value={form.department} maxLength={80} onChange={(e) => set('department', e.target.value)} placeholder="Engineering" /></Lbl></div>
              </div>
            </div>
          ) : (
            /* ───────── step 3: access ───────── */
            <div className="space-y-5">
              <div className="rounded-xl border border-neutral-200 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[role?.tone] || TONE.slate}`}>{role?.label}</span>
                  <span className="text-xs text-neutral-500">{form.role === 'super_admin' ? 'Full access' : `${granted} of ${catalog?.keys.length} permissions${form.permissions ? ' (customised)' : ' (role defaults)'}`}</span>
                </div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400"><Eye className="h-3.5 w-3.5" />Pages they will see</div>
                <div className="flex flex-wrap gap-1.5">{sections.map((id) => <span key={id} className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">{SECTION_LABEL[id] || id}</span>)}</div>
                <p className="mt-2 text-[11px] text-neutral-400">Everything else is hidden from their sidebar and blocked on the server.</p>
              </div>

              {form.role !== 'super_admin' && (
                <div>
                  <button type="button" onClick={() => setCustom((v) => !v)} className="text-sm font-bold text-indigo-600 hover:underline">{custom ? 'Hide' : 'Customise'} individual permissions</button>
                  {form.permissions && <button type="button" onClick={() => set('permissions', null)} className="ml-3 text-xs font-semibold text-neutral-500 hover:underline">Reset to role defaults</button>}
                  {custom && (
                    <div className="mt-3 space-y-4">
                      {(catalog?.groups || []).map((g) => (
                        <div key={g.id}>
                          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">{g.label}</div>
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {g.perms.map((p) => (
                              <div key={p.key} onClick={() => togglePerm(p.key)} title={p.desc} className={`flex cursor-pointer select-none items-center gap-2.5 rounded-lg border p-2.5 transition ${perms[p.key] ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                                <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 ${perms[p.key] ? 'border-white bg-white' : 'border-neutral-300'}`}>{perms[p.key] && <Check className="h-3 w-3 text-neutral-900" strokeWidth={3} />}</div>
                                <span className={`text-xs ${perms[p.key] ? 'font-medium text-white' : 'text-neutral-700'}`}>{p.label}{p.risk && <span className={`ml-1 ${perms[p.key] ? 'text-amber-300' : 'text-amber-500'}`}>●</span>}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <p className="text-[11px] text-neutral-400"><span className="text-amber-500">●</span> = sensitive permission</p>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-neutral-200 p-4">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400"><KeyRound className="h-3.5 w-3.5" />Password</div>
                <Lbl t="Set one yourself (optional)" hint="Leave blank and a strong one-time password is generated for you. 10+ characters, an uppercase letter, a number and a special character.">
                  <input type="password" autoComplete="new-password" className={FIELD} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Auto-generate" />
                </Lbl>
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-neutral-700">
                  <input type="checkbox" className="mt-0.5" checked={form.forcePasswordReset} onChange={(e) => set('forcePasswordReset', e.target.checked)} />
                  <span><b>Make them choose their own password</b> the first time they sign in <span className="text-neutral-400">(recommended)</span></span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50 px-6 py-3">
          {result ? (
            <>
              <button onClick={() => { setResult(null); setStep(0); setForm((f) => ({ ...f, name: '', email: '', password: '', permissions: null, orgNodeId: '', positionTitle: '' })); }} className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100">Add another</button>
              <button onClick={onClose} className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-bold text-white hover:bg-neutral-700">Done</button>
            </>
          ) : (
            <>
              <button onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100">{step === 0 ? 'Cancel' : <><ArrowLeft className="h-4 w-4" />Back</>}</button>
              {step < STEPS.length - 1
                ? <button onClick={next} disabled={loading} className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-5 py-2 text-sm font-bold text-white hover:bg-neutral-700 disabled:opacity-50">Next<ArrowRight className="h-4 w-4" /></button>
                : <button onClick={submit} disabled={busy || loading} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Add to team</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
