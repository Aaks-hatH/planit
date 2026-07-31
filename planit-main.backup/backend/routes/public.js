const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// ─── GET /api/invite/:inviteCode/qr.svg ──────────────────────────────────────
// Branded PlanIt QR code for a guest invite. No auth required.
// The invite code itself is the credential (same as the guest invite page).
router.get('/invite/:inviteCode/qr.svg', async (req, res, next) => {
  try {
    const QRCode  = require('qrcode');
    const Invite  = require('../models/Invite');
    const invite  = await Invite.findOne({ inviteCode: req.params.inviteCode.toUpperCase().trim() }).lean();
    if (!invite) return res.status(404).send('Invite not found');

    const event = await Event.findById(invite.eventId).select('title').lean();
    if (!event) return res.status(404).send('Event not found');

    // Always use FRONTEND_URL for the invite link.
    // req.get('host') behind Render's reverse proxy returns the backend's internal
    // hostname (e.g. planit-backend-1.onrender.com), NOT the frontend domain the
    // guest's browser visits (planitapp.onrender.com). If we embed the wrong host
    // the scanned QR opens a dead URL.
    const frontendBase = (process.env.FRONTEND_URL || process.env.BASE_DOMAIN || '').replace(/\/$/, '');
    const inviteUrl = frontendBase
      ? `${frontendBase}/invite/${invite.inviteCode}`
      : `${req.protocol}://${req.get('host')}/invite/${invite.inviteCode}`;

    // Clean dark-on-white QR with NO overlay in the data area.
    // The center PLANIT badge was blocking the timing patterns; BarcodeDetector
    // (used by html5-qrcode) is strict and rejects QRs with anything overlaid.
    // Brand info goes BELOW the QR image instead.
    const dataUrl = await QRCode.toDataURL(inviteUrl, {
      width: 260,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });

    const safeTitle = (event.title    || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').slice(0, 30);
    const safeName  = (invite.guestName || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').slice(0, 28);
    const safeCode  = invite.inviteCode.replace(/[^A-Z0-9]/g, '');

    const W = 300, H = 430;
    const QX = 20, QY = 20, QS = 260;

    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <filter id="glow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#000" flood-opacity="0.55"/>
    </filter>
    <clipPath id="qrclip"><rect x="${QX}" y="${QY}" width="${QS}" height="${QS}" rx="10"/></clipPath>
  </defs>
  <!-- Dark card -->
  <rect width="${W}" height="${H}" rx="20" fill="#0a0a0a" filter="url(#glow)"/>
  <!-- White backing for QR (no overlay on top of QR modules) -->
  <rect x="${QX - 4}" y="${QY - 4}" width="${QS + 8}" height="${QS + 8}" rx="14" fill="#ffffff"/>
  <!-- Clean QR — no badge on top -->
  <image x="${QX}" y="${QY}" width="${QS}" height="${QS}" href="${dataUrl}" clip-path="url(#qrclip)"/>
  <!-- Divider -->
  <line x1="20" y1="${QY + QS + 18}" x2="${W - 20}" y2="${QY + QS + 18}" stroke="#1f1f1f" stroke-width="1"/>
  <!-- PLANIT brand -->
  <text x="${W / 2}" y="${QY + QS + 40}" text-anchor="middle"
        fill="#ffffff" font-family="system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
        font-size="13" font-weight="800" letter-spacing="5">PLANIT</text>
  <!-- Event title -->
  <text x="${W / 2}" y="${QY + QS + 62}" text-anchor="middle"
        fill="#e5e5e5" font-family="system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
        font-size="12" font-weight="600">${safeTitle}</text>
  <!-- Guest name -->
  <text x="${W / 2}" y="${QY + QS + 80}" text-anchor="middle"
        fill="#888" font-family="system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
        font-size="11">${safeName}</text>
  <!-- Invite code -->
  <text x="${W / 2}" y="${QY + QS + 100}" text-anchor="middle"
        fill="#444" font-family="'Courier New',Courier,monospace"
        font-size="11" font-weight="700" letter-spacing="3">${safeCode}</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(svg);
  } catch (err) { next(err); }
});

// Get sitemap
router.get('/sitemap.xml', async (req, res) => {
  try {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const domain = process.env.BASE_DOMAIN || 'localhost:5173';
    const baseUrl = `${protocol}://${domain}`;

    // Get public events
    const publicEvents = await Event.find({
      'settings.isPublic': true,
      status: 'active'
    })
    .select('subdomain updatedAt')
    .lean();

    // Generate sitemap XML
    const urls = [
      { loc: baseUrl, priority: '1.0', changefreq: 'daily' },
      { loc: `${baseUrl}/terms`, priority: '0.5', changefreq: 'monthly' },
      { loc: `${baseUrl}/privacy`, priority: '0.5', changefreq: 'monthly' },
      ...publicEvents.map(event => ({
        loc: `${protocol}://${event.subdomain}.${domain}`,
        lastmod: event.updatedAt.toISOString().split('T')[0],
        priority: '0.8',
        changefreq: 'weekly'
      }))
    ];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    res.status(500).send('Error generating sitemap');
  }
});

// Get robots.txt
router.get('/robots.txt', (req, res) => {
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const domain = process.env.BASE_DOMAIN || 'localhost:5173';
  
  const robots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: ${protocol}://${domain}/api/sitemap.xml`;

  res.header('Content-Type', 'text/plain');
  res.send(robots);
});

// Get Terms of Service
router.get('/terms', (req, res) => {
  const terms = {
    title: 'Terms of Service',
    lastUpdated: '2026-02-11',
    sections: [
      {
        title: '1. Acceptance of Terms',
        content: 'By accessing and using this event planning service, you accept and agree to be bound by these Terms of Service.'
      },
      {
        title: '2. Description of Service',
        content: 'Our service provides tools for creating and managing private event planning spaces with features including real-time chat, polling, and file sharing.'
      },
      {
        title: '3. User Responsibilities',
        content: 'You are responsible for: (a) maintaining the confidentiality of your event passwords, (b) all activities that occur in your events, (c) ensuring content you share complies with applicable laws, (d) respecting other users and maintaining appropriate conduct.'
      },
      {
        title: '4. Privacy and Data Protection',
        content: 'We implement encryption and security measures to protect your data. Please review our Privacy Policy for details on data collection and usage.'
      },
      {
        title: '5. Content Ownership',
        content: 'You retain ownership of content you create. By using our service, you grant us a license to host and display your content as necessary to provide the service.'
      },
      {
        title: '6. Prohibited Uses',
        content: 'You may not use the service to: (a) violate any laws, (b) infringe on intellectual property rights, (c) transmit harmful code or malware, (d) harass or harm others, (e) attempt to gain unauthorized access to our systems.'
      },
      {
        title: '7. Service Modifications',
        content: 'We reserve the right to modify or discontinue the service at any time, with or without notice. We are not liable for any modifications or interruptions.'
      },
      {
        title: '8. Limitation of Liability',
        content: 'The service is provided "as is" without warranties. We are not liable for any damages arising from your use of the service.'
      },
      {
        title: '9. Termination',
        content: 'We may terminate or suspend access to our service immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users.'
      },
      {
        title: '10. Governing Law',
        content: 'These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law provisions.'
      },
      {
        title: '11. Changes to Terms',
        content: 'We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of new terms.'
      }
    ]
  };

  res.json(terms);
});

// Get Privacy Policy
router.get('/privacy', (req, res) => {
  const privacy = {
    title: 'Privacy Policy',
    lastUpdated: '2026-02-11',
    sections: [
      {
        title: '1. Information We Collect',
        content: 'We collect minimal information necessary to provide our service: Event details (title, description, date, location), Organizer information (name, email), Usernames chosen by participants, Messages and content shared in events, Files uploaded to events, Technical data (IP addresses, browser type) for security and service improvement.'
      },
      {
        title: '2. How We Use Your Information',
        content: 'We use collected information to: Provide and maintain our service, Enable real-time collaboration features, Ensure security and prevent abuse, Improve and optimize our service, Communicate important service updates.'
      },
      {
        title: '3. Data Storage and Security',
        content: 'Your data is stored securely using: Encryption for sensitive data, Secure database with access controls, Regular security updates and monitoring, Password hashing using industry-standard algorithms. Chat messages can be encrypted client-side for additional privacy.'
      },
      {
        title: '4. Data Sharing',
        content: 'We do not sell or share your personal data with third parties. Data is only shared: Within your event with other participants you invite, With service providers necessary for operation (hosting, security), When required by law or legal process.'
      },
      {
        title: '5. Cookies and Tracking',
        content: 'We use essential cookies for: Authentication and session management, Security features, Service functionality. We do not use tracking cookies or third-party analytics by default.'
      },
      {
        title: '6. Data Retention',
        content: 'We retain data: While events are active, For a reasonable period after event completion, Until requested for deletion by organizers. Deleted data is permanently removed from our systems.'
      },
      {
        title: '7. Your Rights',
        content: 'You have the right to: Access your data, Correct inaccurate data, Request data deletion, Export your data, Object to data processing, Withdraw consent at any time.'
      },
      {
        title: '8. Children\'s Privacy',
        content: 'Our service is not directed to children under 13. We do not knowingly collect information from children. If we become aware of such collection, we will delete it immediately.'
      },
      {
        title: '9. International Data Transfers',
        content: 'Your data may be transferred to and stored on servers in different countries. We ensure appropriate safeguards are in place for such transfers.'
      },
      {
        title: '10. Changes to Privacy Policy',
        content: 'We may update this policy periodically. Continued use after changes constitutes acceptance. We will notify users of significant changes.'
      },
      {
        title: '11. Contact Us',
        content: 'For privacy concerns or data requests, please contact us through the provided support channels.'
      }
    ]
  };

  res.json(privacy);
});

// Get public events (for discovery)
router.get('/events/public', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const events = await Event.find({
      'settings.isPublic': true,
      status: 'active',
      date: { $gte: new Date() }
    })
    .select('subdomain title description date location participants maxParticipants coverImage themeColor tags createdAt')
    .sort({ date: 1 })
    .skip(skip)
    .limit(limit)
    .lean();

    const total = await Event.countDocuments({
      'settings.isPublic': true,
      status: 'active',
      date: { $gte: new Date() }
    });

    res.json({
      events: events.map(event => ({
        ...event,
        participantCount: event.participants.length,
        participants: undefined // Don't expose participant details
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});


// ── WL-scoped public events — for WLHome discovery feed ──────────────────────
// GET /api/events/public/wl?domain=tickets.venue.com&limit=12
// Returns only events tagged with that wlDomain, sorted by date ascending.
router.get('/events/public/wl', async (req, res, next) => {
  try {
    const { domain, limit: rawLimit = 12 } = req.query;
    if (!domain) return res.status(400).json({ error: 'domain required' });

    const limit = Math.min(parseInt(rawLimit) || 12, 50);

    const events = await Event.find({
      wlDomain: domain.toLowerCase().trim(),
      'settings.isPublic': true,
      status: 'active',
    })
    .select('subdomain title description date location participants maxParticipants coverImage themeColor tags createdAt')
    .sort({ date: 1 })
    .limit(limit)
    .lean();

    res.json({
      events: events.map(e => ({
        ...e,
        participantCount: e.participants?.length || 0,
        participants: undefined,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/sitemap.xml ─────────────────────────────────────────────────────
// Dynamic sitemap covering all public pages + every published blog post.
// Submit https://planitapp.onrender.com/api/sitemap.xml to Google Search Console.
// The router forwards this as a normal proxied request — no special config needed.
router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const BlogPost = require('../models/BlogPost');
    const base = (process.env.FRONTEND_URL || 'https://planitapp.onrender.com').replace(/\/$/, '');
    const now  = new Date().toISOString().split('T')[0];

    // Static pages
    const staticPages = [
      { loc: '/',         priority: '1.0', changefreq: 'weekly'  },
      { loc: '/blog',     priority: '0.9', changefreq: 'daily'   },
      { loc: '/discover', priority: '0.8', changefreq: 'daily'   },
      { loc: '/about',    priority: '0.6', changefreq: 'monthly' },
      { loc: '/help',     priority: '0.6', changefreq: 'weekly'  },
      { loc: '/terms',    priority: '0.4', changefreq: 'monthly' },
      { loc: '/privacy',  priority: '0.4', changefreq: 'monthly' },
    ];

    // Published blog posts
    const posts = await BlogPost
      .find({ deleted: false })
      .select('slug updatedAt publishDate')
      .sort({ publishDate: -1 })
      .lean();

    const staticUrls = staticPages.map(p => `  <url>
    <loc>${base}${p.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n');

    const postUrls = posts.map(p => `  <url>
    <loc>${base}/blog/${p.slug}</loc>
    <lastmod>${new Date(p.updatedAt || p.publishDate).toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${postUrls}
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600'); // cache 1 hour
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
