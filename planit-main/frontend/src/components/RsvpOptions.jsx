/**
 * frontend/src/components/RsvpOptions.jsx
 *
 * Two switches that need to look and behave identically everywhere they appear
 * (Landing page editor, EventSpace settings, RSVP page builder settings):
 *
 *   <TicketOption />   "Turn RSVPs into tickets"   (enterprise events only)
 *   <BrandingOption /> "Hide Powered by PlanIt"
 *
 * Both are plain controlled components. They read and write the same two
 * fields on the event (rsvpPage.issueTicket, rsvpPage.hideBranding), so
 * flipping one in any editor flips it in the others after the next save.
 */
import { Ticket, Lock, EyeOff } from 'lucide-react';

function Switch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
        checked ? 'bg-indigo-600' : 'bg-neutral-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={{ width: 42, height: 24 }}
    >
      <span
        className="absolute top-1 left-1 bg-white rounded-full shadow transition-transform duration-200"
        style={{ width: 16, height: 16, transform: checked ? 'translateX(18px)' : 'translateX(0)' }}
      />
    </button>
  );
}

function OptionCard({ icon: Icon, title, body, note, checked, onChange, disabled, tone = 'indigo' }) {
  const on = checked && !disabled;
  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      on ? (tone === 'indigo' ? 'border-indigo-300 bg-indigo-50/60' : 'border-neutral-300 bg-neutral-50')
         : 'border-neutral-200 bg-white'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg ${
          on ? 'bg-indigo-600 text-white' : 'bg-neutral-100 text-neutral-500'
        }`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">{body}</p>
          {note && <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">{note}</p>}
        </div>
        <Switch checked={checked} onChange={onChange} disabled={disabled} label={title} />
      </div>
    </div>
  );
}

/** "Turn RSVPs into tickets": only usable on enterprise events. */
export function TicketOption({ isEnterprise, checked, onChange }) {
  if (!isEnterprise) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-400">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-700">Turn RSVPs into tickets</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Only available on enterprise events. When it’s on, everyone who RSVPs gets a ticket with a QR code for the door.
              This event isn’t an enterprise event, so the option is off.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <OptionCard
      icon={Ticket}
      title="Turn RSVPs into tickets"
      body="Guests who RSVP “Attending” get a ticket with a QR code straight away. Staff scan it at the door with enterprise check-in. Plus-ones travel on the same ticket."
      note={checked
        ? 'If you approve RSVPs by hand, the ticket is issued when you approve. Guests who already RSVP’d get a ticket when you save. Declined or cancelled RSVPs have their ticket switched off.'
        : 'Off: RSVPs are just a guest list, with no ticket or QR code.'}
      checked={checked}
      onChange={onChange}
    />
  );
}

/** "Hide Powered by PlanIt": applies to every guest-facing page of this event. */
export function BrandingOption({ checked, onChange }) {
  return (
    <OptionCard
      icon={EyeOff}
      tone="neutral"
      title="Hide “Powered by PlanIt”"
      body="Removes the PlanIt label from your RSVP page, confirmation screen, landing page, event space entry screen and guest tickets."
      checked={checked}
      onChange={onChange}
    />
  );
}
