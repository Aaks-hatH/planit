/**
 * frontend/src/content/media.js
 *
 * ONE place to put real pictures on the Home and Careers pages.
 *
 * Files live in `frontend/public/media/` and are referenced as "/media/your-file.webp".
 * You can also paste a full image URL (https://...).
 * Leave a slot as '' and the page shows a labelled placeholder frame (never a broken image).
 *
 * Best size: 2400 x 1500 (16:10), WebP or JPG, under 400 KB. Landscape photos work best.
 * `alt` is read by screen readers, so describe what is actually in the picture.
 *
 * Photos: most are from Pexels (free to use, no attribution required); the check-in
 * pictures (home story 3 and careers story 2) and the stage hero are your own uploads.
 */
const base = '/media';

export const MEDIA = {
  home: {
    // Big picture that expands from a card to full screen as you scroll
    hero: {
      src: `${base}/home-hero.webp`,
      alt: 'A crowd holding up phones in front of a large night stage show with beams of blue light and fire jets',
    },

    // Four pictures that cross-fade in the pinned scroll story (in order)
    story: [
      {
        src: `${base}/home-story-1-room.webp`,
        alt: 'An empty ballroom with rows of chairs set up facing a podium',
        title: 'Start with the room',
        text: 'Pick the date, the venue and the guest count. PlanIt builds your event page, RSVP form and invite links in seconds.',
      },
      {
        src: `${base}/home-story-2-seating.webp`,
        alt: 'A round table set with plates, menus, glassware and flowers',
        title: 'Seat everyone',
        text: 'Drag guests onto tables, see conflicts and dietary notes, and let Claude suggest a seating plan.',
      },
      {
        src: `${base}/home-story-3-doors.webp`,
        alt: 'A guest showing a QR code on their phone to a staff member at an outdoor check-in desk at dusk',
        title: 'Open the doors',
        text: 'Every guest gets a personal QR code. Staff scan at the door and the live count updates for everyone.',
      },
      {
        // Brand-matched skyline replaces the old laser-heavy concert image.
        src: `${base}/planit-skyline.webp`,
        alt: 'A sleek modern city skyline illuminated in cool blue and violet light, reflected across calm water at night',
        title: 'Enjoy the night',
        text: 'Announcements, polls, chat and the live feed run themselves while you host. Seven days later it all disappears.',
      },
    ],
  },

  careers: {
    hero: {
      src: `${base}/careers-hero.webp`,
      alt: 'A small team gathered around a table with laptops, working through a problem together',
    },
    story: [
      {
        src: `${base}/careers-story-1-team.webp`,
        alt: 'Two teammates planning with sticky notes on a whiteboard',
        title: 'Small team, real owners',
        text: 'Everyone ships to production and talks to the people who use PlanIt.',
      },
      {
        src: `${base}/careers-story-2-live.webp`,
        alt: 'A staff member checking in two dressed-up guests at the entrance of an evening gala',
        title: 'Built for real nights',
        text: 'We watch events happen. Weddings, galas, conferences. That feedback drives the roadmap.',
      },
      {
        src: `${base}/careers-story-3-celebrate.webp`,
        alt: 'Friends raising champagne glasses and sparklers in a toast',
        title: 'Ship, then celebrate',
        text: 'Launches are small and frequent. We take the time to enjoy them.',
      },
    ],
  },
};
