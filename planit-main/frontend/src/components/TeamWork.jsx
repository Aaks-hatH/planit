import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Calendar, Check, ExternalLink, GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft,
  Link2, Loader2, Plus, RefreshCw, Trash2, Unlink, X, Edit2, Github,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../services/api';
import { FIELD, ago, initials } from './teamShared';

/**
 * Admin -> Team -> Tasks and Team -> GitHub
 *
 * Tasks   a board (To do / In progress / Review / Done). Anyone sees and moves their own tasks; people with
 *         "Assign Tasks" (and super admins) create, edit, reassign and delete tasks for the whole team.
 * GitHub  a super admin connects the repo once and links each person to a GitHub username. Pull requests are
 *         then fetched live (every 30 s while the tab is open) and shown against the person who opened them.
 */

const errMsg = (e, fallback) => e?.response?.data?.error || fallback;

// Runs fn now and then every `ms` while the browser tab is visible. Returns nothing; cleans up on unmount.
function useLivePoll(fn, ms, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return undefined;
    let timer;
    const tick = () => { if (!document.hidden) ref.current(); };
    ref.current();
    timer = setInterval(tick, ms);
    const onVis = () => { if (!document.hidden) ref.current(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); };
  }, [ms, enabled]);
}

// Re-renders every few seconds so "12s ago" keeps counting.
function useNow(ms = 5000) {
  const [, setN] = useState(0);
  useEffect(() => { const t = setInterval(() => setN((n) => n + 1), ms); return () => clearInterval(t); }, [ms]);
}

const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 px-3" onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ${wide ? 'max-w-xl' : 'max-w-md'}`}>
      <div className="mb-4 flex items-center justify-between"><h3 className="font-bold text-neutral-900">{title}</h3><button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X className="h-4 w-4" /></button></div>
      {children}
    </div>
  </div>
);

const Label = ({ children }) => <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-neutral-400">{children}</label>;

const DemoNote = ({ what }) => (
  <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">{what} is not available in the sandbox account.</div>
);

/* ═════════════════════════════ Tasks ═════════════════════════════ */
const COLUMNS = [
  ['todo', 'To do', 'bg-neutral-400'],
  ['in_progress', 'In progress', 'bg-blue-500'],
  ['review', 'Review', 'bg-amber-500'],
  ['done', 'Done', 'bg-emerald-500'],
];
const STATUS_LABEL = Object.fromEntries(COLUMNS.map(([id, label]) => [id, label]));
const PRIORITY = {
  low: ['Low', 'bg-neutral-100 text-neutral-600'],
  medium: ['Medium', 'bg-blue-100 text-blue-800'],
  high: ['High', 'bg-orange-100 text-orange-800'],
  urgent: ['Urgent', 'bg-red-100 text-red-700'],
};
const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');   // due dates are stored as UTC midnight
const localToday = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };
const dueLabel = (t) => {
  if (!t.dueDate) return null;
  return {
    text: new Date(t.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    overdue: t.status !== 'done' && dayKey(t.dueDate) < localToday(),
  };
};

function TaskModal({ task, people, onClose, onSaved }) {
  const [f, setF] = useState({
    title: task?.title || '', description: task?.description || '', assigneeId: task?.assigneeId || '',
    priority: task?.priority || 'medium', dueDate: dayKey(task?.dueDate), prNumber: task?.prNumber || '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!f.title.trim()) return toast.error('Give the task a title');
    if (!f.assigneeId) return toast.error('Choose who this is for');
    setBusy(true);
    try {
      const body = { ...f, dueDate: f.dueDate || null, prNumber: f.prNumber === '' ? null : Number(f.prNumber) };
      if (task) await adminAPI.updateWorkTask(task._id, body); else await adminAPI.createWorkTask(body);
      toast.success(task ? 'Task updated' : 'Task assigned');
      onSaved();
    } catch (e) { toast.error(errMsg(e, 'Could not save the task')); }
    setBusy(false);
  };

  return (
    <Modal title={task ? 'Edit task' : 'Assign a task'} onClose={onClose} wide>
      <div className="space-y-3">
        <div><Label>Title</Label><input autoFocus className={FIELD} maxLength={200} value={f.title} onChange={set('title')} placeholder="What needs doing?" /></div>
        <div><Label>Details</Label><textarea className={`${FIELD} min-h-[90px]`} maxLength={4000} value={f.description} onChange={set('description')} placeholder="Context, links, what done looks like" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Assign to</Label>
            <select className={FIELD} value={f.assigneeId} onChange={set('assigneeId')}>
              <option value="">Choose a person…</option>
              {people.map((p) => <option key={p._id} value={p._id}>{p.name}{p.department ? ` · ${p.department}` : ''}</option>)}
            </select>
          </div>
          <div><Label>Priority</Label>
            <select className={FIELD} value={f.priority} onChange={set('priority')}>{Object.entries(PRIORITY).map(([id, [l]]) => <option key={id} value={id}>{l}</option>)}</select>
          </div>
          <div><Label>Due date</Label><input type="date" className={FIELD} value={f.dueDate} onChange={set('dueDate')} /></div>
          <div><Label>Pull request # (optional)</Label><input type="number" min="1" className={FIELD} value={f.prNumber} onChange={set('prNumber')} placeholder="e.g. 42" /></div>
        </div>
      </div>
      <div className="mt-5 flex gap-3">
        <button onClick={onClose} className="btn btn-secondary flex-1 text-sm">Cancel</button>
        <button onClick={save} disabled={busy} className="btn flex-1 bg-neutral-900 text-sm text-white disabled:opacity-50">{busy ? 'Saving…' : task ? 'Save changes' : 'Assign task'}</button>
      </div>
    </Modal>
  );
}

function TaskCard({ t, canAssign, mine, onMove, onEdit, onDelete }) {
  const [p, pc] = PRIORITY[t.priority] || PRIORITY.medium;
  const due = dueLabel(t);
  const canMove = canAssign || mine;
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-sm font-bold text-neutral-900">{t.title}</div>
        {canAssign && (
          <div className="flex flex-shrink-0 gap-1">
            <button onClick={() => onEdit(t)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" title="Edit"><Edit2 className="h-3.5 w-3.5" /></button>
            <button onClick={() => onDelete(t)} className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
      {t.description && <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-neutral-500">{t.description}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pc}`}>{p}</span>
        {due && <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${due.overdue ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-600'}`}><Calendar className="h-3 w-3" />{due.overdue ? 'Overdue · ' : ''}{due.text}</span>}
        {t.prNumber && <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800"><GitPullRequest className="h-3 w-3" />#{t.prNumber}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2">
        <div className="min-w-0 truncate text-[11px] text-neutral-500">{t.assigneeName || 'Unassigned'}{t.createdByName ? <span className="text-neutral-300"> · from {t.createdByName}</span> : null}</div>
        {canMove && (
          <select value={t.status} onChange={(e) => onMove(t, e.target.value)} className="rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-[11px] font-semibold text-neutral-700 outline-none focus:border-neutral-900">
            {COLUMNS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

export function TasksTab({ currentUser, isDemo, canAssign }) {
  const [scope, setScope] = useState(canAssign ? 'all' : 'mine');
  const [tasks, setTasks] = useState(null);
  const [people, setPeople] = useState([]);
  const [who, setWho] = useState('');
  const [modal, setModal] = useState(null);       // null | 'new' | task
  const [err, setErr] = useState('');
  const meId = currentUser?._id ? String(currentUser._id) : (currentUser?.employeeId ? String(currentUser.employeeId) : null);

  const load = useCallback(async () => {
    try { const r = await adminAPI.getWorkTasks(scope); setTasks(r.data.tasks || []); setErr(''); }
    catch (e) { setErr(errMsg(e, 'Could not load tasks')); setTasks((t) => t || []); }
  }, [scope]);
  useLivePoll(load, 20000, !isDemo);
  useEffect(() => { if (canAssign && !isDemo) adminAPI.getWorkPeople().then((r) => setPeople(r.data.people || [])).catch(() => {}); }, [canAssign, isDemo]);

  const move = async (t, status) => {
    const prev = tasks;
    setTasks((all) => all.map((x) => (x._id === t._id ? { ...x, status } : x)));   // optimistic
    try { await adminAPI.updateWorkTask(t._id, { status }); }
    catch (e) { setTasks(prev); toast.error(errMsg(e, 'Could not move the task')); }
  };
  const del = async (t) => {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    try { await adminAPI.deleteWorkTask(t._id); setTasks((all) => all.filter((x) => x._id !== t._id)); toast.success('Task deleted'); }
    catch (e) { toast.error(errMsg(e, 'Could not delete')); }
  };

  const shown = useMemo(() => (tasks || []).filter((t) => !who || t.assigneeId === who), [tasks, who]);
  if (isDemo) return <DemoNote what="Tasks" />;
  if (!tasks) return <div className="flex justify-center py-16 text-neutral-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const open = (tasks || []).filter((t) => t.status !== 'done').length;
  const hasPeople = scope === 'all' && canAssign;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm text-neutral-500">{scope === 'all' ? 'Everyone\'s tasks' : 'Your tasks'} · <b className="text-neutral-800">{open}</b> open</div>
        <div className="flex-1" />
        {canAssign && (
          <div className="flex rounded-lg bg-neutral-100 p-0.5 text-xs font-bold">
            {[['all', 'Everyone'], ['mine', 'Mine']].map(([id, l]) => (
              <button key={id} onClick={() => { setScope(id); setTasks(null); setWho(''); }} className={`rounded-md px-3 py-1.5 transition ${scope === id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}>{l}</button>
            ))}
          </div>
        )}
        {hasPeople && (
          <select value={who} onChange={(e) => setWho(e.target.value)} className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none focus:border-neutral-900">
            <option value="">All people</option>
            {people.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        )}
        {canAssign && <button onClick={() => setModal('new')} className="btn flex items-center gap-1.5 bg-neutral-900 px-3 py-1.5 text-sm text-white"><Plus className="h-4 w-4" />Assign task</button>}
      </div>

      {err && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />{err}</div>}

      {tasks.length === 0 && !err ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">
          {canAssign ? 'No tasks yet. Use "Assign task" to give someone their first one.' : 'Nothing assigned to you right now.'}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map(([id, label, dot]) => {
            const col = shown.filter((t) => t.status === id);
            return (
              <div key={id} className="rounded-2xl bg-neutral-50 p-2.5">
                <div className="mb-2 flex items-center gap-2 px-1"><span className={`h-2 w-2 rounded-full ${dot}`} /><span className="text-[11px] font-black uppercase tracking-widest text-neutral-500">{label}</span><span className="text-[11px] font-bold text-neutral-400">{col.length}</span></div>
                <div className="space-y-2">
                  {col.map((t) => <TaskCard key={t._id} t={t} canAssign={canAssign} mine={meId && t.assigneeId === meId} onMove={move} onEdit={setModal} onDelete={del} />)}
                  {col.length === 0 && <div className="py-6 text-center text-[11px] text-neutral-300">Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && <TaskModal task={modal === 'new' ? null : modal} people={people} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

/* ═════════════════════════════ GitHub ═════════════════════════════ */
const PR_STATE = {
  open:   ['Open',   'bg-emerald-100 text-emerald-800', GitPullRequest],
  draft:  ['Draft',  'bg-neutral-100 text-neutral-600', GitPullRequestDraft],
  merged: ['Merged', 'bg-violet-100 text-violet-800',  GitMerge],
  closed: ['Closed', 'bg-red-100 text-red-700',        GitPullRequestClosed],
};

function ConnectCard({ isSuper, replacing, onDone, onCancel }) {
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isSuper) {
    return <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">GitHub is not connected yet. A super admin can connect it from this tab.</div>;
  }
  const go = async () => {
    setBusy(true);
    try { await adminAPI.connectGithub(repo, token); setToken(''); toast.success('GitHub connected'); onDone(); }
    catch (e) { toast.error(errMsg(e, 'Could not connect to GitHub')); }
    setBusy(false);
  };
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="mb-1 flex items-center gap-2 text-base font-black text-neutral-900"><Github className="h-5 w-5" />{replacing ? 'Replace the GitHub connection' : 'Connect GitHub'}</div>
      <p className="mb-4 text-sm text-neutral-500">Paste the repository and a read-only access token. PlanIt checks them, then fetches pull requests live and shows them under the person who opened each one.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Repository</Label><input className={FIELD} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/name" autoComplete="off" spellCheck={false} /></div>
        <div><Label>Access token</Label><input type="password" className={FIELD} value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" autoComplete="new-password" spellCheck={false} onKeyDown={(e) => e.key === 'Enter' && repo && token && go()} /></div>
      </div>
      <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-xs text-neutral-500">
        <li>On GitHub: Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token.</li>
        <li>Under <b>Repository access</b> choose only this repository.</li>
        <li>Under <b>Permissions</b> set <b>Pull requests: Read-only</b>. (Metadata read-only is added automatically.)</li>
      </ol>
      <p className="mt-2 text-[11px] text-neutral-400">The token is stored encrypted and never sent back to the browser. It can only read.</p>
      <div className="mt-4 flex gap-3">
        {replacing && <button onClick={onCancel} className="btn btn-secondary text-sm">Cancel</button>}
        <button onClick={go} disabled={busy || !repo.trim() || !token.trim()} className="btn bg-neutral-900 text-sm text-white disabled:opacity-50">{busy ? 'Checking with GitHub…' : 'Connect'}</button>
      </div>
    </div>
  );
}

function PersonLink({ person, canLink, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.githubUsername || '');
  const [busy, setBusy] = useState(false);

  const save = async (value) => {
    setBusy(true);
    try {
      const r = await adminAPI.linkGithubUser(person._id, value);
      toast.success(value ? `Linked to @${r.data.githubUsername}` : 'Unlinked');
      setEditing(false); onChanged();
    } catch (e) { toast.error(errMsg(e, 'Could not link that account')); }
    setBusy(false);
  };
  const c = person.counts;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-black text-white">{initials(person.name)}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-neutral-900">{person.name}</div>
        {editing ? (
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-xs text-neutral-400">@</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value.replace(/^@/, ''))} maxLength={39} placeholder="github-username" className="w-44 rounded-md border border-neutral-200 px-2 py-1 text-xs outline-none focus:border-neutral-900" onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) save(name.trim()); if (e.key === 'Escape') setEditing(false); }} />
            <button disabled={busy || !name.trim()} onClick={() => save(name.trim())} className="rounded-md bg-neutral-900 p-1 text-white disabled:opacity-40" title="Save">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}</button>
            <button onClick={() => setEditing(false)} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100" title="Cancel"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : person.githubUsername
          ? <a href={`https://github.com/${person.githubUsername}`} target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-500 hover:text-neutral-900">@{person.githubUsername}</a>
          : <span className="text-xs text-amber-600">Not linked</span>}
      </div>
      {person.githubUsername && !editing && (
        <div className="flex gap-1.5 text-[11px] font-bold">
          {c.open + c.draft > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">{c.open + c.draft} open</span>}
          {c.merged > 0 && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-800">{c.merged} merged</span>}
          {c.open + c.draft + c.merged + c.closed === 0 && <span className="text-neutral-300">no PRs yet</span>}
        </div>
      )}
      {canLink && !editing && (
        <div className="flex gap-1">
          <button onClick={() => { setName(person.githubUsername || ''); setEditing(true); }} className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" title={person.githubUsername ? 'Change GitHub account' : 'Link GitHub account'}><Link2 className="h-4 w-4" /></button>
          {person.githubUsername && <button disabled={busy} onClick={() => window.confirm(`Unlink ${person.name} from @${person.githubUsername}?`) && save('')} className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600" title="Unlink"><Unlink className="h-4 w-4" /></button>}
        </div>
      )}
    </div>
  );
}

export function GithubTab({ isDemo, isSuper }) {
  const [status, setStatus] = useState(null);
  const [feed, setFeed] = useState(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');
  const [person, setPerson] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useNow();

  const loadStatus = useCallback(() => adminAPI.getGithubStatus().then((r) => setStatus(r.data)).catch((e) => setErr(errMsg(e, 'Could not load GitHub status'))), []);
  useEffect(() => { if (!isDemo) loadStatus(); }, [isDemo, loadStatus]);

  const loadFeed = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await adminAPI.getGithubPulls();
      if (r.data.connected === false) { setStatus((s) => ({ ...(s || {}), connected: false })); setFeed(null); }
      else { setFeed(r.data); setErr(''); }
    } catch (e) { setErr(errMsg(e, 'Could not fetch pull requests')); }
    setRefreshing(false);
  }, []);
  useLivePoll(loadFeed, 30000, !isDemo && !!status?.connected && !replacing);

  const disconnect = async () => {
    if (!window.confirm('Disconnect GitHub? Pull requests stop updating. People stay linked to their usernames.')) return;
    try { await adminAPI.disconnectGithub(); setFeed(null); await loadStatus(); toast.success('GitHub disconnected'); }
    catch (e) { toast.error(errMsg(e, 'Could not disconnect')); }
  };

  const prs = useMemo(() => (feed?.prs || []).filter((p) => (filter === 'all' || p.state === filter || (filter === 'open' && p.state === 'draft')) && (!person || p.employee?._id === person)), [feed, filter, person]);
  const counts = useMemo(() => {
    const c = { all: 0, open: 0, merged: 0, closed: 0 };
    for (const p of feed?.prs || []) { c.all++; if (p.state === 'open' || p.state === 'draft') c.open++; else c[p.state]++; }
    return c;
  }, [feed]);

  if (isDemo) return <DemoNote what="GitHub" />;
  if (!status) return err ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div> : <div className="flex justify-center py-16 text-neutral-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!status.connected || replacing) {
    return <ConnectCard isSuper={isSuper} replacing={replacing} onCancel={() => setReplacing(false)} onDone={async () => { setReplacing(false); await loadStatus(); loadFeed(); }} />;
  }

  const secs = feed ? Math.max(0, Math.round((Date.now() - feed.fetchedAt) / 1000)) : null;
  const seesAll = feed?.scope === 'all';

  return (
    <div className="space-y-4">
      {/* connection bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <Github className="h-5 w-5 text-neutral-800" />
        <div className="min-w-0 flex-1">
          <a href={`https://github.com/${status.repo}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate text-sm font-black text-neutral-900 hover:underline">{status.repo}<ExternalLink className="h-3 w-3 text-neutral-400" /></a>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
            <span className={`h-1.5 w-1.5 rounded-full ${err || feed?.stale ? 'bg-amber-500' : 'bg-emerald-500'} ${refreshing ? 'animate-pulse' : ''}`} />
            {err || feed?.stale ? 'Showing the last data GitHub gave us' : 'Live'}{secs !== null ? ` · updated ${secs < 5 ? 'just now' : `${secs}s ago`}` : ''}
          </div>
        </div>
        <button onClick={loadFeed} disabled={refreshing} className="btn btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />Refresh</button>
        {isSuper && status.source === 'admin' && <>
          <button onClick={() => setReplacing(true)} className="btn btn-secondary px-3 py-1.5 text-xs">Replace token</button>
          <button onClick={disconnect} className="btn btn-secondary px-3 py-1.5 text-xs text-red-600">Disconnect</button>
        </>}
        {isSuper && status.source === 'env' && <span className="text-[11px] text-neutral-400">Connected through server settings</span>}
      </div>

      {(err || feed?.warning) && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />{err || feed.warning}</div>}

      {/* people */}
      {seesAll && feed.people && (
        <div>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[11px] font-black uppercase tracking-widest text-neutral-400">People</h3>{isSuper && <span className="text-[11px] text-neutral-400">Link each person to their GitHub username so their pull requests show up under their name.</span>}</div>
          <div className="grid gap-2 lg:grid-cols-2">
            {feed.people.map((p) => <PersonLink key={p._id} person={p} canLink={isSuper} onChanged={loadFeed} />)}
          </div>
        </div>
      )}

      {/* pull requests */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-neutral-400">{seesAll ? 'Pull requests' : 'Your pull requests'}</h3>
          <div className="flex-1" />
          <div className="flex rounded-lg bg-neutral-100 p-0.5 text-xs font-bold">
            {[['all', 'All'], ['open', 'Open'], ['merged', 'Merged'], ['closed', 'Closed']].map(([id, l]) => (
              <button key={id} onClick={() => setFilter(id)} className={`rounded-md px-3 py-1.5 transition ${filter === id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}>{l} <span className="text-neutral-400">{counts[id]}</span></button>
            ))}
          </div>
          {seesAll && (
            <select value={person} onChange={(e) => setPerson(e.target.value)} className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none focus:border-neutral-900">
              <option value="">Everyone</option>
              {feed.people.filter((p) => p.githubUsername).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          )}
        </div>

        {!feed ? <div className="flex justify-center py-10 text-neutral-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
          : prs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400">
              {seesAll ? 'No pull requests match.' : 'No pull requests are linked to your account yet. If you have opened some, ask a super admin to link your GitHub username.'}
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              {prs.map((p) => {
                const [label, tone, Icon] = PR_STATE[p.state] || PR_STATE.open;
                return (
                  <a key={`${p.repo}#${p.number}`} href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 transition hover:bg-neutral-50">
                    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${tone}`}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-neutral-900">{p.title} <span className="font-normal text-neutral-400">#{p.number}</span></div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-neutral-500">
                        {p.employee ? <span className="font-semibold text-neutral-700">{p.employee.name}</span> : <span className="font-semibold text-amber-600">@{p.author.login} · not linked</span>}
                        <span>{p.branch} → {p.base}</span>
                        <span>{p.state === 'merged' ? `merged ${ago(p.mergedAt)}` : `updated ${ago(p.updatedAt)}`}</span>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>{label}</span>
                  </a>
                );
              })}
            </div>
          )}
        {seesAll && feed?.unmatchedAuthors?.length > 0 && isSuper && (
          <p className="mt-2 text-[11px] text-neutral-400">Not linked to anyone yet: {feed.unmatchedAuthors.map((a) => `@${a}`).join(', ')}</p>
        )}
        {feed && <p className="mt-2 text-[11px] text-neutral-400">Showing the 100 most recently updated pull requests. Refreshes every 30 seconds while this tab is open.</p>}
      </div>
    </div>
  );
}
