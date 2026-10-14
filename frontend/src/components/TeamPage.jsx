import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Briefcase, Check, Clock, Crown, Edit2, Key, Loader2, Network, Power, RefreshCw, RotateCcw, Search,
  ShieldCheck, Trash2, UserPlus, Users, X, Save, History,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../services/api';
import AddPersonWizard from './AddPersonWizard';
import { FIELD, SECTION_LABEL, TONE, TONE_BAR, ago, initials, roleLabel, roleOf, sectionsFrom, when } from './teamShared';

/**
 * Admin -> Team
 *   My team          everyone: your manager, your reports, who sits beside you, your own sign-in history
 *   Directory        super admin or "View Team Directory": everyone, with manager / reports / last sign-in
 *   Roles & access   super admin: every role and permission in one matrix, plus a fixer for accounts missing flags
 * Roles, permission groups and sections come from GET /admin/team/catalog, so nothing here is hand-maintained.
 */

const RoleChip = ({ catalog, role }) => {
  const r = roleOf(catalog, role);
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[r?.tone] || TONE.slate}`}>{r?.label || String(role || '').replace(/_/g, ' ')}</span>;
};

function Avatar({ name, tone = 'slate', size = 40 }) {
  return <div style={{ width: size, height: size, fontSize: size * 0.36 }} className={`flex flex-shrink-0 items-center justify-center rounded-full font-black text-white ${TONE_BAR[tone] || 'bg-neutral-500'}`}>{initials(name)}</div>;
}

const Section = ({ title, children, right }) => (
  <div className="rounded-2xl border border-neutral-200 bg-white p-5">
    <div className="mb-3 flex items-center justify-between"><h3 className="text-[11px] font-black uppercase tracking-widest text-neutral-400">{title}</h3>{right}</div>
    {children}
  </div>
);

/* ───────────────────────── My team ───────────────────────── */
function PersonRow({ n, catalog, showLogin }) {
  const open = n.status === 'open';
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3">
      <Avatar name={open ? '+' : n.personName} tone={open ? 'slate' : (n.accent === 'slate' ? 'indigo' : n.accent)} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-neutral-900">{open ? 'Open position' : n.personName}</div>
        <div className="truncate text-xs text-neutral-500">{n.title}{n.department ? ` · ${n.department}` : ''}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {n.accountRole && <RoleChip catalog={catalog} role={n.accountRole} />}
        {showLogin && n.loginVisible && (
          <span className="flex items-center gap-1 text-[11px] text-neutral-500"><Clock className="h-3 w-3" />{n.lastLogin ? `Last sign-in ${ago(n.lastLogin)}` : 'Never signed in'}</span>
        )}
        {open && <span className="rounded-full bg-amber-100 px-2 text-[11px] font-bold text-amber-800">Hiring</span>}
      </div>
    </div>
  );
}

function MyTeam({ catalog, isDemo, onNavigate }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (isDemo) { setD({ demo: true }); return; }
    adminAPI.getMyTeam().then((r) => setD(r.data)).catch((e) => setErr(e?.response?.data?.error || 'Could not load your team'));
  }, [isDemo]);

  if (err) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>;
  if (!d) return <div className="flex justify-center py-16 text-neutral-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (d.demo) return <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">The sandbox account is not part of the org chart.</div>;

  const me = d.me;
  return (
    <div className="space-y-4">
      {!d.onChart && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          You are not on the org chart yet, so there is no manager or team to show. A super admin can place you from the org chart or by editing your profile.
        </div>
      )}

      {me && (
        <Section title="You">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={me.personName} tone="indigo" size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="text-lg font-black text-neutral-900">{me.personName}</span>{me.accountRole && <RoleChip catalog={catalog} role={me.accountRole} />}</div>
              <div className="text-sm text-neutral-500">{me.title}{me.department ? ` · ${me.department}` : ''}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-neutral-50 px-3 py-2"><div className="text-lg font-black">{d.chain.length ? d.chain.length : 0}</div><div className="text-[10px] font-bold uppercase text-neutral-400">levels up</div></div>
              <div className="rounded-lg bg-neutral-50 px-3 py-2"><div className="text-lg font-black">{d.reports.length}</div><div className="text-[10px] font-bold uppercase text-neutral-400">direct reports</div></div>
              <div className="rounded-lg bg-neutral-50 px-3 py-2"><div className="text-lg font-black">{d.teamSize}</div><div className="text-[10px] font-bold uppercase text-neutral-400">in your team</div></div>
            </div>
          </div>
        </Section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="You report to">
          {d.manager
            ? <PersonRow n={d.manager} catalog={catalog} />
            : <p className="text-sm text-neutral-400">{d.onChart ? 'Nobody. You are at the top of the chart.' : '—'}</p>}
          {d.chain.length > 1 && <p className="mt-2 text-xs text-neutral-400">Chain: {d.chain.map((c) => (c.status === 'open' ? 'Open position' : c.personName)).join(' → ')}</p>}
        </Section>

        <Section title={`Your direct reports (${d.reports.length})`}>
          {d.reports.length === 0 ? <p className="text-sm text-neutral-400">Nobody reports to you yet.</p>
            : <div className="space-y-2">{d.reports.map((r) => <PersonRow key={r._id} n={r} catalog={catalog} showLogin />)}</div>}
          {d.reports.length > 0 && <p className="mt-2 text-[11px] text-neutral-400">You can see when the people you manage sign in. Only you, they, and super admins can.</p>}
        </Section>
      </div>

      {d.peers.length > 0 && (
        <Section title={`Works alongside you (${d.peers.length})`}>
          <div className="grid gap-2 sm:grid-cols-2">{d.peers.map((p) => <PersonRow key={p._id} n={p} catalog={catalog} />)}</div>
        </Section>
      )}

      <Section title="Your sign-in activity">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-neutral-50 p-3"><div className="text-[10px] font-bold uppercase text-neutral-400">This session</div><div className="text-sm font-bold">{when(d.login?.lastLogin)}</div></div>
          <div className="rounded-lg bg-neutral-50 p-3"><div className="text-[10px] font-bold uppercase text-neutral-400">Time before that</div><div className="text-sm font-bold">{when(d.login?.previousLogin)}</div></div>
          <div className="rounded-lg bg-neutral-50 p-3"><div className="text-[10px] font-bold uppercase text-neutral-400">Total sign-ins</div><div className="text-sm font-bold">{d.login?.loginCount ?? 0}</div></div>
        </div>
        {d.login?.recent?.length > 0 && (
          <div className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-100">
            {d.login.recent.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                <span className="font-semibold text-neutral-700">{when(l.at)}</span>
                <span className="text-neutral-500">{l.device}{l.ip ? ` · ${l.ip}` : ''}{l.totp ? ' · 2FA' : ''}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-neutral-400">If you see a sign-in you do not recognise, change your password under My Account and tell a super admin.</p>
      </Section>

      <button onClick={() => onNavigate?.('careers')} className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold text-neutral-800 hover:bg-neutral-50"><Network className="h-4 w-4" />Open the full org chart</button>
    </div>
  );
}

/* ───────────────────────── Directory ───────────────────────── */
function EditModal({ emp, catalog, onClose, onSaved }) {
  const [tab, setTab] = useState('profile');
  const [f, setF] = useState(() => ({
    name: emp.name, email: emp.email, role: emp.role, status: emp.status, department: emp.department || '', phone: emp.phone || '',
    timezone: emp.timezone || '', location: emp.location || '', emergencyContact: emp.emergencyContact || '', employeeId: emp.employeeId || '',
    notes: emp.notes || '', isDemo: !!emp.isDemo, forcePasswordReset: !!emp.forcePasswordReset, twoFactorEnabled: !!emp.twoFactorEnabled,
    startDate: emp.startDate ? new Date(emp.startDate).toISOString().slice(0, 10) : '', password: '',
    permissions: Object.fromEntries(catalog.keys.map((k) => [k, emp.permissions?.[k] === true])),
    applyRoleDefaults: false,
  }));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const role = roleOf(catalog, f.role);
  const preset = Object.fromEntries(catalog.keys.map((k) => [k, !!role?.perms.includes(k)]));
  const eff = f.applyRoleDefaults ? preset : f.permissions;
  const roleChanged = f.role !== emp.role;
  const sections = sectionsFrom(catalog, eff, f.role);

  const save = async () => {
    if (!f.name.trim() || !f.email.trim()) return toast.error('Name and email are required');
    setBusy(true);
    try {
      const body = { ...f, permissions: eff, startDate: f.startDate || undefined };
      if (!body.password) delete body.password;
      await adminAPI.updateEmployee(emp._id, body);
      toast.success('Saved. Changes apply on their next request.');
      onSaved();
    } catch (e) { toast.error(e?.response?.data?.error || 'Save failed'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 px-3 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div><h3 className="font-bold text-neutral-900">Edit {emp.name}</h3><p className="text-xs text-neutral-500">Role, access and profile</p></div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-neutral-100"><X className="h-4 w-4 text-neutral-400" /></button>
        </div>
        <div className="flex border-b px-6">
          {[['profile', 'Profile'], ['access', 'Role & access'], ['security', 'Security']].map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} className={`-mb-px border-b-2 px-4 py-3 text-xs font-semibold ${tab === id ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}>{l}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'profile' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Full name *</span><input className={FIELD} value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Email *</span><input type="email" className={FIELD} value={f.email} onChange={(e) => set('email', e.target.value)} /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Department</span><input className={FIELD} value={f.department} onChange={(e) => set('department', e.target.value)} /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Employee ID</span><input className={FIELD} value={f.employeeId} onChange={(e) => set('employeeId', e.target.value)} /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Phone</span><input className={FIELD} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Start date</span><input type="date" className={FIELD} value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Location</span><input className={FIELD} value={f.location} onChange={(e) => set('location', e.target.value)} /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Time zone</span><input className={FIELD} value={f.timezone} onChange={(e) => set('timezone', e.target.value)} /></label>
              <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium text-neutral-600">Emergency contact</span><input className={FIELD} value={f.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} /></label>
              <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium text-neutral-600">Notes (super admins only)</span><textarea rows={2} className={FIELD} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></label>
            </div>
          )}

          {tab === 'access' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Role</span>
                  <select className={FIELD} value={f.role} onChange={(e) => { set('role', e.target.value); if (e.target.value !== emp.role) set('applyRoleDefaults', true); }}>
                    {catalog.roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select></label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">Status</span>
                  <select className={FIELD} value={f.status} onChange={(e) => set('status', e.target.value)}>{['active', 'inactive', 'suspended'].map((s) => <option key={s}>{s}</option>)}</select></label>
              </div>
              {role && <p className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">{role.desc}</p>}
              {roleChanged && !role?.super && (
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <input type="checkbox" className="mt-0.5" checked={f.applyRoleDefaults} onChange={(e) => set('applyRoleDefaults', e.target.checked)} />
                  <span><b>Reset permissions to {role?.label} defaults.</b> Untick to keep their current individual permissions.</span>
                </label>
              )}
              {f.role === 'super_admin' ? (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs font-medium text-purple-700">Super admin bypasses every permission check.</div>
              ) : f.role === 'demo' ? (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-700">Demo accounts are read-only sandboxes. Permissions are ignored.</div>
              ) : (
                <>
                  <div>
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">Pages they will see</div>
                    <div className="flex flex-wrap gap-1.5">{sections.map((id) => <span key={id} className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">{SECTION_LABEL[id] || id}</span>)}</div>
                  </div>
                  {catalog.groups.map((g) => (
                    <div key={g.id}>
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">{g.label}</div>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {g.perms.map((p) => (
                          <div key={p.key} title={p.desc} onClick={() => setF((x) => { const base = x.applyRoleDefaults ? preset : x.permissions; return { ...x, permissions: { ...base, [p.key]: !base[p.key] }, applyRoleDefaults: false }; })}
                            className={`flex cursor-pointer select-none items-center gap-2.5 rounded-lg border p-2.5 transition ${eff[p.key] ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                            <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 ${eff[p.key] ? 'border-white bg-white' : 'border-neutral-300'}`}>{eff[p.key] && <Check className="h-3 w-3 text-neutral-900" strokeWidth={3} />}</div>
                            <span className={`text-xs ${eff[p.key] ? 'font-medium text-white' : 'text-neutral-700'}`}>{p.label}{p.risk && <span className={`ml-1 ${eff[p.key] ? 'text-amber-300' : 'text-amber-500'}`}>●</span>}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {tab === 'security' && (
            <div className="space-y-4">
              <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">New password <span className="font-normal text-neutral-400">(leave blank to keep)</span></span>
                <input type="password" autoComplete="new-password" className={FIELD} value={f.password} onChange={(e) => set('password', e.target.value)} />
                <span className="mt-1 block text-[11px] text-neutral-400">10+ characters with an uppercase letter, a number and a special character.</span></label>
              {[['forcePasswordReset', 'Force password reset on next sign-in'], ['isDemo', 'Sandbox / demo account (all writes simulated)']].map(([k, l]) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700"><input type="checkbox" checked={f[k]} onChange={(e) => set(k, e.target.checked)} />{l}</label>
              ))}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-neutral-50 p-3"><div className="text-[10px] font-bold uppercase text-neutral-400">Last sign-in</div><div className="font-bold">{when(emp.lastLogin)}</div></div>
                <div className="rounded-lg bg-neutral-50 p-3"><div className="text-[10px] font-bold uppercase text-neutral-400">Total sign-ins</div><div className="font-bold">{emp.loginCount || 0}</div></div>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="btn btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={save} disabled={busy} className="btn flex-1 gap-2 bg-neutral-900 text-sm text-white hover:bg-neutral-800 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save changes</button>
        </div>
      </div>
    </div>
  );
}

function LoginsModal({ emp, onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { adminAPI.getTeamLogins(emp._id).then((r) => setRows(r.data.logins)).catch((e) => { toast.error(e?.response?.data?.error || 'Could not load'); onClose(); }); }, [emp._id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 px-3" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3"><h3 className="font-bold">Sign-ins · {emp.name || emp.personName}</h3><button onClick={onClose}><X className="h-4 w-4 text-neutral-400" /></button></div>
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {!rows ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-neutral-400" />
            : rows.length === 0 ? <p className="text-center text-sm text-neutral-400">No sign-ins recorded yet.</p>
              : rows.map((l, i) => <div key={i} className="flex justify-between gap-2 border-b border-neutral-100 py-2 text-xs"><span className="font-semibold">{when(l.at)}</span><span className="text-neutral-500">{l.device}{l.ip ? ` · ${l.ip}` : ''}</span></div>)}
        </div>
      </div>
    </div>
  );
}

function Directory({ catalog, currentUser, isDemo, demoEmployees, isSuper, reloadKey }) {
  const [employees, setEmployees] = useState([]);
  const [root, setRoot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [fRole, setFRole] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [edit, setEdit] = useState(null);
  const [logins, setLogins] = useState(null);
  const [cp, setCp] = useState(null);
  const [cpNew, setCpNew] = useState('');
  const [wizard, setWizard] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    if (isDemo) { setEmployees(demoEmployees || []); setLoading(false); return; }
    try { const r = await adminAPI.getEmployees(); setEmployees(r.data.employees || []); setRoot(r.data.root || null); }
    catch (e) { toast.error(e?.response?.data?.error || 'Failed to load the directory'); } finally { setLoading(false); }
  }, [isDemo, demoEmployees]);
  useEffect(() => { load(); }, [load, reloadKey]);

  const isSelf = (e) => currentUser?.isEmployee && String(currentUser._id) === String(e._id);
  const missing = employees.filter((e) => e.missingPermissions?.length);
  const filtered = employees.filter((e) => {
    const s = q.toLowerCase();
    return (!s || e.name.toLowerCase().includes(s) || e.email.toLowerCase().includes(s) || (e.department || '').toLowerCase().includes(s))
      && (fRole === 'all' || e.role === fRole) && (fStatus === 'all' || e.status === fStatus);
  });

  const guard = (fn) => (...a) => { if (isDemo) { toast.success('Done (sandbox).'); return; } return fn(...a); };
  const suspend = guard(async (e) => {
    const on = e.status !== 'suspended';
    const reason = on ? window.prompt(`Reason for suspending ${e.name}? (optional)`) : '';
    if (on && reason === null) return;
    try { await adminAPI.suspendEmployee(e._id, on, reason || ''); toast.success(on ? `${e.name} suspended` : `${e.name} unsuspended`); load(); }
    catch (x) { toast.error(x?.response?.data?.error || 'Failed'); }
  });
  const force = guard(async (e) => {
    if (!window.confirm(`Force a password reset for ${e.name}? Their sessions end now.`)) return;
    try { await adminAPI.forceResetEmployee(e._id); toast.success('Reset required on next sign-in'); load(); } catch (x) { toast.error(x?.response?.data?.error || 'Failed'); }
  });
  const del = guard(async (e) => {
    if (!window.confirm(`Remove ${e.name} from the team? Their box stays on the org chart.`)) return;
    try { await adminAPI.deleteEmployee(e._id); toast.success('Removed'); load(); } catch (x) { toast.error(x?.response?.data?.error || 'Failed'); }
  });
  const setPw = guard(async () => {
    if (!/^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{10,}$/.test(cpNew)) return toast.error('10+ characters with an uppercase letter, a number and a special character');
    try { await adminAPI.changeEmployeePassword(cp._id, { newPassword: cpNew }); toast.success(`Password changed for ${cp.name}`); setCp(null); setCpNew(''); }
    catch (x) { toast.error(x?.response?.data?.errors?.[0]?.msg || x?.response?.data?.error || 'Failed'); }
  });
  const sync = async () => {
    setSyncing(true);
    try { const r = await adminAPI.syncTeamPermissions(); toast.success(r.data.message); load(); } catch (x) { toast.error(x?.response?.data?.error || 'Failed'); } finally { setSyncing(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">{employees.length} team member{employees.length === 1 ? '' : 's'}{root ? ' + the super admin' : ''}</p>
        {isSuper && <button onClick={() => setWizard(true)} className="btn btn-primary gap-2 text-sm"><UserPlus className="h-4 w-4" />Add person</button>}
      </div>

      {isSuper && missing.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-2 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /><span><b>{missing.length} account{missing.length === 1 ? ' is' : 's are'} missing permission flags</b> that were added after they were created ({missing.map((m) => m.name).slice(0, 3).join(', ')}{missing.length > 3 ? '…' : ''}). Until fixed, those flags count as "off".</span></div>
          <button onClick={sync} disabled={syncing} className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60">{syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Fill in from role defaults</button>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" /><input className={`${FIELD} pl-8`} placeholder="Search by name, email, department…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className={`${FIELD} sm:w-40`} value={fRole} onChange={(e) => setFRole(e.target.value)}><option value="all">All roles</option>{catalog.roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
        <select className={`${FIELD} sm:w-36`} value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="all">All statuses</option>{['active', 'inactive', 'suspended'].map((s) => <option key={s}>{s}</option>)}</select>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {root && !q && fRole === 'all' && fStatus === 'all' && (
            <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4">
              <div className="flex items-center gap-3"><Avatar name="Super Admin" tone="purple" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-sm font-bold">Super Admin <Crown className="h-3.5 w-3.5 text-purple-600" /> <span className="rounded-full bg-purple-100 px-2 text-[11px] font-semibold text-purple-800">You · owner login</span></div>
                <div className="text-xs text-neutral-500">Last sign-in {when(root.lastLogin)} · {root.loginCount} total</div></div>
                <button onClick={() => setLogins({ _id: 'root', name: 'Super Admin' })} className="rounded-lg p-1.5 text-neutral-500 hover:bg-white" title="Sign-in history"><History className="h-4 w-4" /></button></div>
            </div>
          )}
          {filtered.map((e) => {
            const self = isSelf(e);
            const total = catalog.keys.length;
            const granted = catalog.keys.filter((k) => e.permissions?.[k]).length;
            return (
              <div key={e._id} className={`rounded-2xl border border-neutral-200 bg-white p-4 ${e.status !== 'active' ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <Avatar name={e.name} tone={roleOf(catalog, e.role)?.tone || 'slate'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="text-sm font-bold text-neutral-900">{e.name}</span><RoleChip catalog={catalog} role={e.role} />
                      {self && <span className="rounded-full bg-indigo-100 px-2 text-[11px] font-semibold text-indigo-700">You</span>}
                      {e.status !== 'active' && <span className="rounded-full bg-red-100 px-2 text-[11px] font-semibold text-red-700">{e.status}</span>}
                      {e.forcePasswordReset && <span className="rounded-full bg-red-100 px-2 text-[11px] font-semibold text-red-600">pw reset</span>}
                      {e.missingPermissions?.length > 0 && <span className="rounded-full bg-amber-100 px-2 text-[11px] font-semibold text-amber-800" title={e.missingPermissions.join(', ')}>{e.missingPermissions.length} flags missing</span>}</div>
                    <div className="text-xs text-neutral-500">{e.email}</div>
                    <div className="mt-1 text-xs text-neutral-400">{e.position ? e.position.title : <span className="text-amber-600">Not on the org chart</span>}{e.department ? ` · ${e.department}` : ''}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-500">
                      <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{e.manager ? <>Reports to <b className="text-neutral-700">{e.manager.open ? 'open position' : e.manager.name}</b></> : 'No manager'}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{e.reportCount} report{e.reportCount === 1 ? '' : 's'}</span>
                      {!e.loginHidden && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.lastLogin ? `Signed in ${ago(e.lastLogin)}` : 'Never signed in'}{e.loginCount ? ` · ${e.loginCount}×` : ''}</span>}
                    </div>
                    {isSuper && e.role !== 'super_admin' && <div className="mt-1.5 text-[11px] text-neutral-400">{e.isDemo ? 'Sandbox' : `${granted} / ${total} permissions`}</div>}
                  </div>
                  <div className="flex flex-shrink-0 flex-wrap justify-end gap-1.5">
                    {!e.loginHidden && <button onClick={() => setLogins(e)} className="btn btn-secondary p-1.5" title="Sign-in history"><History className="h-3.5 w-3.5" /></button>}
                    {isSuper && (<>
                      <button disabled={self} onClick={() => setEdit(e)} className={`btn btn-secondary p-1.5 ${self ? 'opacity-30' : ''}`} title={self ? 'Use My Account for your own profile' : 'Edit'}><Edit2 className="h-3.5 w-3.5" /></button>
                      <button disabled={self} onClick={() => { setCp(e); setCpNew(''); }} className={`btn btn-secondary p-1.5 ${self ? 'opacity-30' : ''}`} title="Set password"><Key className="h-3.5 w-3.5" /></button>
                      <button disabled={self} onClick={() => force(e)} className={`btn btn-secondary p-1.5 text-amber-600 ${self ? 'opacity-30' : ''}`} title="Force password reset"><RotateCcw className="h-3.5 w-3.5" /></button>
                      <button disabled={self} onClick={() => suspend(e)} className={`btn btn-secondary p-1.5 ${e.status === 'suspended' ? 'text-emerald-600' : 'text-orange-500'} ${self ? 'opacity-30' : ''}`} title={e.status === 'suspended' ? 'Unsuspend' : 'Suspend'}><Power className="h-3.5 w-3.5" /></button>
                      <button disabled={self} onClick={() => del(e)} className={`btn btn-secondary p-1.5 text-red-500 ${self ? 'opacity-30' : ''}`} title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
                    </>)}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="col-span-full py-12 text-center text-sm text-neutral-400">No one matches.</div>}
        </div>
      )}

      {edit && <EditModal emp={edit} catalog={catalog} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {logins && <LoginsModal emp={logins} onClose={() => setLogins(null)} />}
      {wizard && <AddPersonWizard onClose={() => setWizard(false)} onCreated={() => load()} />}
      {cp && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 px-3" onClick={(e) => e.target === e.currentTarget && setCp(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-bold">Set a new password for {cp.name}</h3>
            <input type="password" autoFocus autoComplete="new-password" className={`${FIELD} mt-4`} placeholder="New password" value={cpNew} onChange={(e) => setCpNew(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setPw()} />
            <p className="mt-1 text-[11px] text-neutral-400">10+ characters with an uppercase letter, a number and a special character. Their sessions end.</p>
            <div className="mt-4 flex gap-3"><button onClick={() => setCp(null)} className="btn btn-secondary flex-1 text-sm">Cancel</button><button onClick={setPw} disabled={!cpNew} className="btn flex-1 bg-neutral-900 text-sm text-white disabled:opacity-50">Set password</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Roles & access ───────────────────────── */
function RolesMatrix({ catalog, employees }) {
  const counts = useMemo(() => { const m = {}; for (const e of employees) m[e.role] = (m[e.role] || 0) + 1; return m; }, [employees]);
  const roles = catalog.roles.filter((r) => !r.demo);
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">Every role and every permission that exists, with what each role gets by default. A role is a starting point; individual flags can be changed per person.</p>
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="bg-neutral-50">
            <tr>
              <th className="sticky left-0 bg-neutral-50 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-400">Permission</th>
              {roles.map((r) => <th key={r.id} className="px-2 py-2 text-center"><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[r.tone] || TONE.slate}`}>{r.label}</span><div className="mt-0.5 text-[10px] font-normal text-neutral-400">{counts[r.id] || 0} people</div></th>)}
            </tr>
          </thead>
          <tbody>
            {catalog.groups.map((g) => (
              <React.Fragment key={g.id}>
                <tr><td colSpan={roles.length + 1} className="bg-neutral-50/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-400">{g.label}</td></tr>
                {g.perms.map((p) => (
                  <tr key={p.key} className="border-t border-neutral-100">
                    <td className="sticky left-0 bg-white px-3 py-1.5" title={p.desc}><span className="font-semibold text-neutral-700">{p.label}</span>{p.risk && <span className="ml-1 text-amber-500">●</span>}</td>
                    {roles.map((r) => <td key={r.id} className="px-2 py-1.5 text-center">{r.perms.includes(p.key) ? <Check className="mx-auto h-3.5 w-3.5 text-emerald-600" strokeWidth={3} /> : <span className="text-neutral-200">–</span>}</td>)}
                  </tr>
                ))}
              </React.Fragment>
            ))}
            <tr><td colSpan={roles.length + 1} className="bg-neutral-50/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-neutral-400">Pages in the sidebar</td></tr>
            {catalog.sections.map((s) => (
              <tr key={s.id} className="border-t border-neutral-100">
                <td className="sticky left-0 bg-white px-3 py-1.5 font-semibold text-neutral-700">{SECTION_LABEL[s.id] || s.id}</td>
                {roles.map((r) => {
                  const ok = sectionsFrom(catalog, Object.fromEntries(r.perms.map((k) => [k, true])), r.id).includes(s.id);
                  return <td key={r.id} className="px-2 py-1.5 text-center">{ok ? <Check className="mx-auto h-3.5 w-3.5 text-emerald-600" strokeWidth={3} /> : <span className="text-neutral-200">–</span>}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-neutral-400"><span className="text-amber-500">●</span> sensitive permission. Everyone can always open Team (My team), the org chart in Careers, and My Account.</p>
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */
export default function TeamPage({ currentUser, isDemo = false, demoEmployees = [], onNavigate }) {
  const [catalog, setCatalog] = useState(null);
  const [tab, setTab] = useState('mine');
  const [employees, setEmployees] = useState([]);
  const isSuper = isDemo || !currentUser?.isEmployee || currentUser?.role === 'super_admin';
  const canDirectory = isSuper || currentUser?.permissions?.canViewEmployees === true;

  useEffect(() => {
    adminAPI.getTeamCatalog().then((r) => setCatalog(r.data)).catch(() => toast.error('Could not load roles and permissions'));
  }, []);
  useEffect(() => {   // for the "people per role" counts on the roles tab
    if (!isSuper || isDemo) return;
    adminAPI.getEmployees().then((r) => setEmployees(r.data.employees || [])).catch(() => {});
  }, [isSuper, isDemo, tab]);

  const tabs = [['mine', 'My team', Network], ...(canDirectory ? [['directory', 'Directory', Users]] : []), ...(isSuper ? [['roles', 'Roles & access', ShieldCheck]] : [])];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Team</h2>
        <p className="text-sm text-neutral-500">Who you report to, who reports to you{canDirectory ? ', and everyone on the team' : ''}.</p>
      </div>
      {tabs.length > 1 && (
        <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
          {tabs.map(([id, label, I]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${tab === id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}><I className="h-4 w-4" />{label}</button>
          ))}
        </div>
      )}
      {!catalog ? <div className="flex justify-center py-16 text-neutral-400"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
        <>
          {tab === 'mine' && <MyTeam catalog={catalog} isDemo={isDemo} onNavigate={onNavigate} />}
          {tab === 'directory' && canDirectory && <Directory catalog={catalog} currentUser={currentUser} isDemo={isDemo} demoEmployees={demoEmployees} isSuper={isSuper && !isDemo} />}
          {tab === 'roles' && isSuper && <RolesMatrix catalog={catalog} employees={isDemo ? demoEmployees : employees} />}
        </>
      )}
    </div>
  );
}
