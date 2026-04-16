import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Check, X, HelpCircle, Calendar, MapPin, User,
  ArrowRight, AlertTriangle, Edit2, Clock, Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import { rsvpAPI } from '../services/api';
import { formatDateInTimezone } from '../utils/timezoneUtils';

const STATUS_COLORS = {
  confirmed:  { bg: '#10b98122', border: '#10b98144', text: '#10b981', label: 'Confirmed' },
  pending:    { bg: '#6366f122', border: '#6366f144', text: '#a5b4fc', label: 'Pending Approval' },
  waitlisted: { bg: '#f59e0b22', border: '#f59e0b44', text: '#f59e0b', label: 'Waitlisted' },
  declined:   { bg: '#ef444422', border: '#ef444444', text: '#ef4444', label: 'Declined' },
};

const RESPONSE_LABELS = { yes: 'Attending', maybe: 'Maybe', no: 'Not Attending' };

export default function RSVPManage() {
  const { editToken } = useParams();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  // Edit form state
  const [form, setForm]         = useState({});

  useEffect(() => {
    rsvpAPI.getSubmission(editToken)
      .then(res => {
        setData(res.data);
        const s = res.data.submission;
        setForm({
          response:            s.response,
          firstName:           s.firstName,
          lastName:            s.lastName,
          email:               s.email,
          phone:               s.phone,
          dietaryRestrictions: s.dietaryRestrictions,
          accessibilityNeeds:  s.accessibilityNeeds,
          guestNote:           s.guestNote,
        });
      })
      .catch(() => setError('RSVP not found or the link has expired.'))
      .finally(() => setLoading(false));
  }, [editToken]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await rsvpAPI.editSubmission(editToken, form);
      setData(prev => ({ ...prev, submission: res.data.submission }));
      setEditing(false);
      toast.success('Your RSVP has been updated.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save changes.');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a12' }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0a0a12', color: '#fff' }}>
        <div className="text-center space-y-3 max-w-sm">
          <AlertTriangle className="w-10 h-10 mx-auto opacity-40" />
          <p className="text-sm opacity-50">{error}</p>
          <a href="/" className="text-xs underline opacity-30">Return home</a>
        </div>
      </div>
    );
  }

  const { submission, event } = data;
  const rsvpPage = event?.rsvpPage || {};
  const accent   = rsvpPage.accentColor || '#6366f1';
  const status   = STATUS_COLORS[submission.status] || STATUS_COLORS.confirmed;
  const canEdit  = rsvpPage.allowGuestEdit !== false && submission.status !== 'declined';

  const inputCls = "w-full px-4 py-3 rounded-xl text-sm border outline-none transition-all bg-white/[0.06] border-white/10 focus:border-white/30 text-white placeholder-white/30";

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: '#0a0a12', color: '#fff' }}>
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="text-center space-y-3 pb-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}>
            <Star style={{ color: accent }} className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">Your RSVP</h1>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: status.bg, border: `1px solid ${status.border}`, color: status.text }}>
            {status.label}
          </div>
        </div>

        {/* Event card */}
        {event && (
          <div className="rounded-2xl p-4 space-y-2.5 bg-white/[0.04] border border-white/10">
            <h2 className="text-base font-bold">{event.title}</h2>
            {event.date && (
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 opacity-40 flex-shrink-0" />
                <span className="text-sm opacity-60">
                  {formatDateInTimezone(event.date, event.timezone || 'UTC', 'MMMM d, yyyy — h:mm a zzz')}
                </span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 opacity-40 flex-shrink-0" />
                <span className="text-sm opacity-60">{event.location}</span>
              </div>
            )}
          </div>
        )}

        {/* Submission detail */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <p className="text-xs font-bold uppercase tracking-widest opacity-40">RSVP Details</p>
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg transition-all hover:opacity-80"
                style={{ background: `${accent}22`, color: accent }}>
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            )}
          </div>

          <div className="px-5 py-4 space-y-4">
            {!editing ? (
              <>
                <Row label="Response" value={
                  <span className="flex items-center gap-1.5 font-semibold" style={{ color: accent }}>
                    {submission.response === 'yes' && <Check className="w-4 h-4" />}
                    {submission.response === 'maybe' && <HelpCircle className="w-4 h-4" />}
                    {submission.response === 'no' && <X className="w-4 h-4" />}
                    {RESPONSE_LABELS[submission.response]}
                  </span>
                } />
                <Row label="Name" value={[submission.firstName, submission.lastName].filter(Boolean).join(' ')} />
                {submission.email && <Row label="Email" value={submission.email} />}
                {submission.phone && <Row label="Phone" value={submission.phone} />}
                {submission.plusOnes > 0 && <Row label="Additional Guests" value={submission.plusOnes} />}
                {submission.dietaryRestrictions && <Row label="Dietary" value={submission.dietaryRestrictions} />}
                {submission.accessibilityNeeds && <Row label="Accessibility" value={submission.accessibilityNeeds} />}
                {submission.guestNote && <Row label="Notes" value={submission.guestNote} />}
                <div className="pt-2 border-t border-white/[0.06]">
                  <p className="text-xs opacity-30 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    Submitted {new Date(submission.submittedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </>
            ) : (
              /* Edit form */
              <div className="space-y-3">
                {/* Response */}
                <div>
                  <p className="text-xs font-medium opacity-50 mb-2">Your Response</p>
                  <div className="flex gap-2">
                    {rsvpPage.allowYes !== false && (
                      <RespBtn active={form.response === 'yes'} onClick={() => setForm(p => ({...p, response: 'yes'}))}
                        icon={<Check className="w-3.5 h-3.5" />} label={rsvpPage.yesButtonLabel || 'Attending'} accent={accent} />
                    )}
                    {rsvpPage.allowMaybe !== false && (
                      <RespBtn active={form.response === 'maybe'} onClick={() => setForm(p => ({...p, response: 'maybe'}))}
                        icon={<HelpCircle className="w-3.5 h-3.5" />} label={rsvpPage.maybeButtonLabel || 'Maybe'} accent="#f59e0b" />
                    )}
                    {rsvpPage.allowNo !== false && (
                      <RespBtn active={form.response === 'no'} onClick={() => setForm(p => ({...p, response: 'no'}))}
                        icon={<X className="w-3.5 h-3.5" />} label={rsvpPage.noButtonLabel || 'Not Attending'} accent="#ef4444" />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium opacity-50 mb-1.5">First Name</label>
                    <input value={form.firstName || ''} onChange={e => setForm(p => ({...p, firstName: e.target.value}))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium opacity-50 mb-1.5">Last Name</label>
                    <input value={form.lastName || ''} onChange={e => setForm(p => ({...p, lastName: e.target.value}))} className={inputCls} />
                  </div>
                </div>
                {rsvpPage.collectEmail !== false && (
                  <div>
                    <label className="block text-xs font-medium opacity-50 mb-1.5">Email</label>
                    <input type="email" value={form.email || ''} onChange={e => setForm(p => ({...p, email: e.target.value}))} className={inputCls} />
                  </div>
                )}
                {rsvpPage.collectPhone && (
                  <div>
                    <label className="block text-xs font-medium opacity-50 mb-1.5">Phone</label>
                    <input type="tel" value={form.phone || ''} onChange={e => setForm(p => ({...p, phone: e.target.value}))} className={inputCls} />
                  </div>
                )}
                {rsvpPage.collectDietary && (
                  <div>
                    <label className="block text-xs font-medium opacity-50 mb-1.5">{rsvpPage.dietaryLabel || 'Dietary requirements'}</label>
                    <textarea value={form.dietaryRestrictions || ''} onChange={e => setForm(p => ({...p, dietaryRestrictions: e.target.value}))} rows={2} className={`${inputCls} resize-none`} />
                  </div>
                )}
                {rsvpPage.allowGuestNote && (
                  <div>
                    <label className="block text-xs font-medium opacity-50 mb-1.5">{rsvpPage.guestNoteLabel || 'Notes'}</label>
                    <textarea value={form.guestNote || ''} onChange={e => setForm(p => ({...p, guestNote: e.target.value}))} rows={2} className={`${inputCls} resize-none`} />
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button onClick={save} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                    style={{ background: accent, color: '#fff', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80 border border-white/10">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back to RSVP page */}
        {event?.subdomain && (
          <div className="text-center">
            <a href={`/rsvp/${event.subdomain}`} className="text-xs underline opacity-30 hover:opacity-50 transition-opacity">
              Back to event RSVP page
            </a>
          </div>
        )}

        <p className="text-center text-xs opacity-20 pb-4">
          Powered by <a href="/" className="underline">PlanIt</a>
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium opacity-40 mb-0.5">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function RespBtn({ active, onClick, icon, label, accent }) {
  return (
    <button type="button" onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all"
      style={{
        borderColor: active ? accent : 'rgba(255,255,255,0.12)',
        background:  active ? `${accent}18` : 'transparent',
        color:       active ? accent : 'rgba(255,255,255,0.5)',
      }}>
      {icon} {label}
    </button>
  );
}
