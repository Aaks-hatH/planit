/**
 * frontend/src/content/media.js
 *
 * ONE place to put real pictures on the Home and Careers pages.
 *
 * Paste an image URL (https://...) or drop a file in `frontend/public/media/` and use "/media/your-file.jpg".
 * Leave a slot as '' and the page shows a labelled placeholder frame (never a broken image).
 * Best size: 2400 x 1500 (16:10), JPG/WebP, under 400 KB. Landscape photos work best.
 *
 * `alt` is read by screen readers, so describe the picture.
 */
export const MEDIA = {
  home: {
    // Big picture that expands from a card to full screen as you scroll
    hero: { src: '', alt: 'A guest list and floor plan on a laptop at a live event' },
    // Four pictures that cross-fade in the pinned scroll story (in order)
    story: [
      { src: '', alt: 'An empty venue being set up', title: 'Start with the room', text: 'Pick the date, the venue and the guest count. PlanIt builds your event page, RSVP form and invite links in seconds.' },
      { src: '', alt: 'Round tables with place cards', title: 'Seat everyone', text: 'Drag guests onto tables, see conflicts and dietary notes, and let Claude suggest a seating plan.' },
      { src: '', alt: 'Guests arriving and scanning QR codes', title: 'Open the doors', text: 'Every guest gets a personal QR code. Staff scan at the door and the live count updates for everyone.' },
      { src: '', alt: 'A crowd enjoying an event', title: 'Enjoy the night', text: 'Announcements, polls, chat and the live feed run themselves while you host. Seven days later it all disappears.' },
    ],
  },
  careers: {
    hero: { src: '', alt: 'The PlanIt team working together' },
    story: [
      { src: '', alt: 'The team planning on a whiteboard', title: 'Small team, real owners', text: 'Everyone ships to production and talks to the people who use PlanIt.' },
      { src: '', alt: 'A live event running on PlanIt', title: 'Built for real nights', text: 'We watch events happen. Weddings, galas, conferences. That feedback drives the roadmap.' },
      { src: '', alt: 'Team celebrating after a launch', title: 'Ship, then celebrate', text: 'Launches are small and frequent. We take the time to enjoy them.' },
    ],
  },
};
