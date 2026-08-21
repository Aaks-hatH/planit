/**
 * frontend/src/components/tour/FeatureTour.jsx
 *
 * Full-screen, interactive replacement for the old components/Onboarding.jsx
 * modal. Instead of generic feature cards floating over a dimmed backdrop,
 * each variant renders a full-screen recreation of the real dashboard
 * (header, tabs, panels \u2014 built to match the actual JSX/classes in
 * EventSpace.jsx / RSVPEventDashboard.jsx / TableService.jsx) and a
 * spotlight walks through the real elements one at a time, briefly
 * explaining what each one does. Nothing in the recreation is wired to
 * real data or real actions \u2014 it's a teaching surface, not the live page.
 *
 * Usage: <FeatureTour variant="standard" onClose={() => setShow(false)} />
 * variant: 'standard' | 'enterprise' | 'rsvp' | 'tableService'
 */
import StandardTour from './StandardTour';
import EnterpriseTour from './EnterpriseTour';
import RsvpTour from './RsvpTour';
import TableServiceTour from './TableServiceTour';

export default function FeatureTour({ variant, onClose }) {
  if (variant === 'enterprise')   return <EnterpriseTour onClose={onClose} />;
  if (variant === 'rsvp')         return <RsvpTour onClose={onClose} />;
  if (variant === 'tableService') return <TableServiceTour onClose={onClose} />;
  return <StandardTour onClose={onClose} />;
}
