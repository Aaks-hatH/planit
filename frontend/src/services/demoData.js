// ─── PlanIt Demo Mode Data Engine ────────────────────────────────────────────
// All data is fabricated. Designed to look realistic and impressive in demos.

const SEED = Date.now();

function noise(offset = 0, amplitude = 1, frequency = 0.001) {
  const t = (Date.now() + offset) * frequency;
  return Math.sin(t) * Math.cos(t * 1.7 + 0.4) * amplitude;
}

function jitter(base, pct = 0.01) {
  return Math.round(base + base * noise(base) * pct);
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export function getDemoStats() {
  return {
    totalEvents:                 jitter(847_193),
    activeEvents:                jitter(14_281),
    totalMessages:               jitter(48_663_027),
    totalPolls:                  jitter(2_994_841),
    totalFiles:                  jitter(7_442_310),
    totalParticipants:           jitter(94_837_004),
    recentEvents:                jitter(4_821),
    totalStorage:                jitter(2_100_000_000_000),
    averageParticipantsPerEvent: jitter(112),
  };
}

// ─── Data Centers ─────────────────────────────────────────────────────────────
export const DATA_CENTERS = [
  { id: 'us-east-1',    name: 'US East (Virginia)',        region: 'us-east',    servers: 847, load: 62, lat: 38.9,  lng: -77.0,  status: 'nominal', tier: 'primary'   },
  { id: 'us-west-2',    name: 'US West (Oregon)',          region: 'us-west',    servers: 614, load: 58, lat: 45.5,  lng: -122.6, status: 'nominal', tier: 'primary'   },
  { id: 'eu-west-1',    name: 'EU West (Ireland)',         region: 'eu-west',    servers: 503, load: 71, lat: 53.3,  lng: -6.2,   status: 'nominal', tier: 'primary'   },
  { id: 'eu-central-1', name: 'EU Central (Frankfurt)',    region: 'eu-central', servers: 484, load: 67, lat: 50.1,  lng: 8.7,    status: 'nominal', tier: 'primary'   },
  { id: 'ap-south-1',   name: 'Asia Pacific (Mumbai)',     region: 'ap-south',   servers: 322, load: 74, lat: 19.1,  lng: 72.9,   status: 'nominal', tier: 'primary'   },
  { id: 'ap-east-1',    name: 'Asia Pacific (Tokyo)',      region: 'ap-east',    servers: 308, load: 55, lat: 35.7,  lng: 139.7,  status: 'nominal', tier: 'primary'   },
  { id: 'sa-east-1',    name: 'South America (São Paulo)', region: 'sa-east',    servers: 187, load: 43, lat: -23.5, lng: -46.6,  status: 'nominal', tier: 'secondary' },
  { id: 'ap-se-1',      name: 'Asia Pacific (Singapore)',  region: 'ap-se',      servers: 204, load: 61, lat: 1.35,  lng: 103.8,  status: 'nominal', tier: 'primary'   },
  { id: 'au-east-1',    name: 'Oceania (Sydney)',          region: 'au-east',    servers: 121, load: 44, lat: -33.9, lng: 151.2,  status: 'nominal', tier: 'secondary' },
  { id: 'ca-central-1', name: 'Canada (Montreal)',         region: 'ca-central', servers: 143, load: 39, lat: 45.5,  lng: -73.6,  status: 'nominal', tier: 'secondary' },
  { id: 'af-south-1',   name: 'Africa (Cape Town)',        region: 'af-south',   servers: 82,  load: 31, lat: -33.9, lng: 18.4,   status: 'nominal', tier: 'edge'      },
  { id: 'me-south-1',   name: 'Middle East (Bahrain)',     region: 'me-south',   servers: 88,  load: 48, lat: 26.2,  lng: 50.6,   status: 'nominal', tier: 'edge'      },
];

// ─── Fleet Status (matches routerAPI.getStatus() shape exactly) ───────────────
export function getDemoFleet() {
  const t = Date.now();
  const activeBackendCount = jitter(18);
  const totalBackends = 20;
  const reqPerSec = +(284 + noise(3, 30)).toFixed(1);

  return {
    // Top-level fields FleetControl reads directly
    backends: DATA_CENTERS.map((dc, i) => ({
      index:             i,
      name:              dc.name,
      region:            dc.region,
      active:            true,
      alive:             true,
      latencyMs:         Math.round(dc.load * 0.18 + noise(i * 100, 2)),
      lastPing:          new Date(t - Math.random() * 4000).toISOString(),
      requests:          jitter(dc.servers * 8821),
      windowRequests:    jitter(dc.servers * 12),
      activeConnections: jitter(dc.servers * 47),
      socketConnections: jitter(dc.servers * 31),
      memoryPct:         Math.round(dc.load * 0.9 + noise(i * 200, 5)),
      coldStart:         false,
      circuitTripped:    false,
      consecutiveErrors: 0,
      servers:           dc.servers,
      tier:              dc.tier,
    })),

    // scaling sub-object — FleetControl reads status.scaling.*
    scaling: {
      activeBackendCount,
      totalBackends,
      trippedCount:    0,
      scaleDownStreak: 0,
      thresholds: { scaleUp: 20, scaleDown: 5 },
      lastAction:  'predictive',
      predictive: {
        level:      +(reqPerSec).toFixed(2),
        trend:      +(1.4 + noise(31, 0.3)).toFixed(2),
        rampCount:  3,
        forecast:   +(reqPerSec * 1.04).toFixed(2),
        headroom:   0.85,
        historyLen: 30,
      },
      pid: {
        integral:  2.14,
        lastError: 0.82,
        lastLoad:  reqPerSec,
        setpoint:  14,
        gains: { kp: 0.08, ki: 0.015, kd: 0.04 },
      },
      anomaly: {
        mean:       281.4,
        std:        12.8,
        zThreshold: 4.0,
        holdMs:     180000,
        inHold:     false,
        holdSecsLeft: 0,
      },
      cooldown: {
        ms: 150000, active: false, secsLeft: 0, lastAction: 'predictive',
      },
      circadian: {
        floor: 3, currentHour: new Date().getUTCHours(),
      },
      manual: null,
    },

    boost: null,
    manual: null,

    // summary stats
    totalServers:        jitter(3_033),
    activeServers:       jitter(3_018),
    dataCenters:         DATA_CENTERS.length,
    regions:             8,
    reqPerSecond:        Math.round(reqPerSec),
    p99LatencyMs:        Math.round(12 + noise(1, 3)),
    p50LatencyMs:        Math.round(3 + noise(2, 1)),
    uptimePct:           99.997,
    bandwidthGbps:       +(84.2 + noise(3, 5)).toFixed(1),
    tlsHandshakesPerSec: jitter(18_230),
    cacheHitRate:        +(98.7 + noise(4, 0.4)).toFixed(2),
    activeWebsockets:    jitter(284_193),
    socketRooms:         jitter(14_281),
  };
}

// ─── System Info (matches adminAPI.getSystem() shape exactly) ─────────────────
export function getDemoSystem() {
  return {
    process: {
      pid:         1,
      nodeVersion: 'v22.14.0',
      platform:    'linux',
      arch:        'x64',
      uptime:      Math.floor((Date.now() - SEED) / 1000) + 7_894_201,
    },
    memory: {
      rss:       jitter(847),
      heapUsed:  jitter(524),
      heapTotal: jitter(1_024),
      external:  jitter(112),
      pct:       Math.round(51 + noise(10, 4)),
    },
    cpu:   {
      load1:  +(1.84 + noise(11, 0.3)).toFixed(2),
      load5:  +(1.71).toFixed(2),
      load15: +(1.68).toFixed(2),
    },
    os:    {
      totalMem: 16384,
      freeMem:  jitter(8012),
      cpus:     16,
      platform: 'linux x64',
    },
    db: {
      status: 'connected',
      name:   'planit-prod',
      host:   'cluster0.abc12.mongodb.net',
      poolSize: 100,
      activeConnections: jitter(84),
      opCounters: {
        insert: jitter(82_441_027),
        query:  jitter(4_293_847_102),
        update: jitter(1_847_293_441),
        delete: jitter(94_847_021),
      },
      replicaSet: {
        members: [
          { name: 'primary',    state: 'PRIMARY',   lag: 0,  region: 'us-east-1' },
          { name: 'secondary1', state: 'SECONDARY', lag: 12, region: 'eu-west-1' },
          { name: 'secondary2', state: 'SECONDARY', lag: 18, region: 'ap-south-1' },
        ],
      },
      shards: 4,
      totalDocuments: jitter(928_738_291),
      storageGB:      +(982.1 + noise(20, 10)).toFixed(1),
    },
    redis: {
      status:       'connected',
      version:      '7.2.4',
      mode:         'cluster',
      nodes:        12,
      totalKeys:    jitter(28_738_029),
      usedMemoryMB: jitter(14_291),
      hitRate:      +(98.7 + noise(21, 0.3)).toFixed(2),
      opsPerSec:    jitter(284_193),
      clusters: [
        { name: 'cache-primary', nodes: 4, region: 'us-east-1', role: 'cache'   },
        { name: 'session-store', nodes: 2, region: 'us-east-1', role: 'session' },
        { name: 'pubsub-cluster',nodes: 4, region: 'us-west-2', role: 'pubsub'  },
        { name: 'queue-cluster', nodes: 2, region: 'ap-south-1',role: 'queue'   },
      ],
    },
    queues: {
      email:     { pending: jitter(28),   processing: jitter(4),  throughputPerMin: jitter(482)  },
      webhook:   { pending: jitter(12),   processing: jitter(2),  throughputPerMin: jitter(284)  },
      analytics: { pending: jitter(842),  processing: jitter(19), throughputPerMin: jitter(2847) },
      cleanup:   { pending: jitter(3),    processing: jitter(1),  throughputPerMin: jitter(82)   },
    },
    cdnNodes:         247,
    edgeCaches:       847,
    tlsCerts:         1294,
    activeWebsockets: jitter(284_193),
    socketRooms:      jitter(14_281),
  };
}

// ─── Scaling (used by FleetControl scaling sub-panel) ─────────────────────────
export function getDemoScaling() {
  return getDemoFleet().scaling;
}

// ─── Live feed for admin dashboard ────────────────────────────────────────────
export const LIVE_EVENT_NAMES = [
  'Global Tech Summit 2026',          'World AI Congress — Singapore 2026',
  'Harvard CS Commencement 2026',     'Diwali Cultural Gala — London',
  'UEFA Finals VIP Experience',       'NYC Startup Showcase — Investor Night',
  'Coachella Artist Lounge — VIP',    'Google I/O Community Satellite — NYC',
  'Oxford Ideas Forum',               'Bollywood Global Night — Dubai',
  'Eid al-Fitr Community Celebration','Y Combinator Spring Demo Day (W26)',
  'Apple WWDC Watch Party — SF',      'Pride Month Opening Concert',
  'Royal State Reception',            'Formula 1 Singapore Grand Prix',
  'Metropolitan Gala — After Party',  'Davos Innovation Side-Session',
  'Cannes Film Festival Premiere',    'SXSW Interactive Panel — Austin',
];

export function getLiveFeed() {
  const now = Date.now();
  return Array.from({ length: 12 }, (_, i) => ({
    id:     `evt-${now}-${i}`,
    type:   ['join','create','checkin','message','poll'][i % 5],
    event:  LIVE_EVENT_NAMES[i % LIVE_EVENT_NAMES.length],
    region: DATA_CENTERS[i % DATA_CENTERS.length].name,
    ms:     Math.round(2 + noise(i * 300, 1.5)),
    ts:     new Date(now - i * 847 - noise(i * 400, 200) * 500).toISOString(),
  }));
}

// ─── Demo Events ──────────────────────────────────────────────────────────────
const DEMO_EVENT_POOL = [
  { title: 'Global Tech Summit 2026',                 organizerName: 'sarah.chen',     status: 'active',    participants: 4821,  createdAt: '2026-01-14T10:00:00Z', isPasswordProtected: false },
  { title: 'World AI Congress — Singapore 2026',      organizerName: 'wac.organizers', status: 'active',    participants: 6240,  createdAt: '2026-02-02T09:00:00Z', isPasswordProtected: false },
  { title: 'Harvard CS Commencement 2026',            organizerName: 'harvard.cs',     status: 'active',    participants: 2140,  createdAt: '2026-05-20T09:00:00Z', isPasswordProtected: true  },
  { title: 'Diwali Cultural Gala — London',           organizerName: 'uk.culture',     status: 'active',    participants: 1200,  createdAt: '2026-02-10T19:00:00Z', isPasswordProtected: false },
  { title: 'UEFA Finals VIP Experience',              organizerName: 'sport.mgmt',     status: 'completed', participants: 1200,  createdAt: '2025-11-10T18:00:00Z', isPasswordProtected: true  },
  { title: 'NYC Startup Showcase — Investor Night',   organizerName: 'vc.collective',  status: 'active',    participants: 874,   createdAt: '2026-02-18T17:30:00Z', isPasswordProtected: true  },
  { title: 'Coachella Artist Lounge — VIP',           organizerName: 'festival.ops',   status: 'completed', participants: 1275,  createdAt: '2025-04-12T20:00:00Z', isPasswordProtected: true  },
  { title: 'Google I/O Community Satellite — NYC',    organizerName: 'dev.community',  status: 'active',    participants: 1883,  createdAt: '2026-02-22T11:00:00Z', isPasswordProtected: false },
  { title: 'Oxford Ideas Forum',                      organizerName: 'oxford.forum',   status: 'completed', participants: 420,   createdAt: '2025-11-01T09:00:00Z', isPasswordProtected: false },
  { title: 'Bollywood Global Night — Dubai',          organizerName: 'events.ae',      status: 'completed', participants: 800,   createdAt: '2025-12-20T20:00:00Z', isPasswordProtected: true  },
  { title: 'Eid al-Fitr Community Celebration',       organizerName: 'community.ae',   status: 'active',    participants: 1200,  createdAt: '2026-03-01T08:00:00Z', isPasswordProtected: false },
  { title: 'Y Combinator Spring Demo Day (W26)',      organizerName: 'ycombinator',    status: 'active',    participants: 1120,  createdAt: '2026-02-10T14:00:00Z', isPasswordProtected: true  },
  { title: 'Apple WWDC Watch Party — San Francisco',  organizerName: 'apple.fans',     status: 'active',    participants: 677,   createdAt: '2026-03-01T13:00:00Z', isPasswordProtected: false },
  { title: 'Pride Month Opening Concert',             organizerName: 'community.org',  status: 'active',    participants: 2420,  createdAt: '2026-01-28T15:00:00Z', isPasswordProtected: false },
  { title: 'Royal State Reception',                   organizerName: 'palace.events',  status: 'active',    participants: 840,   createdAt: '2026-02-28T16:00:00Z', isPasswordProtected: true  },
  { title: 'Formula 1 Singapore GP — Terrace',        organizerName: 'racing.club',    status: 'completed', participants: 430,   createdAt: '2025-09-20T14:00:00Z', isPasswordProtected: true  },
  { title: 'Metropolitan Gala — After Party',         organizerName: 'fashion.inc',    status: 'completed', participants: 1240,  createdAt: '2025-05-05T22:00:00Z', isPasswordProtected: true  },
  { title: 'Davos Innovation Side-Session',           organizerName: 'wef.admin',      status: 'draft',     participants: 0,     createdAt: '2026-03-01T08:00:00Z', isPasswordProtected: false },
  { title: 'Cannes Film Festival — Premiere',         organizerName: 'cinema.guild',   status: 'draft',     participants: 0,     createdAt: '2026-03-05T10:00:00Z', isPasswordProtected: false },
  { title: 'SXSW Interactive Panel — Austin',         organizerName: 'sxsw.team',      status: 'active',    participants: 2200,  createdAt: '2026-02-12T11:00:00Z', isPasswordProtected: false },
  { title: 'Berlin Art Biennale — VIP Tour',          organizerName: 'art.berlin',     status: 'completed', participants: 610,   createdAt: '2025-10-11T10:00:00Z', isPasswordProtected: true  },
  { title: 'Global Climate Summit — Youth Track',     organizerName: 'climate.global', status: 'active',    participants: 1200,  createdAt: '2026-01-22T09:00:00Z', isPasswordProtected: false },
  { title: 'Luxury Travel Expo — VIP Preview',        organizerName: 'luxury.travel',  status: 'completed', participants: 930,   createdAt: '2025-11-30T14:00:00Z', isPasswordProtected: true  },
  { title: 'Blockchain Developer Summit — Seoul',     organizerName: 'block.dev',      status: 'active',    participants: 1450,  createdAt: '2026-02-27T13:30:00Z', isPasswordProtected: false },
  { title: 'FinTech Leaders Roundtable — London',     organizerName: 'fintech.london', status: 'completed', participants: 480,   createdAt: '2025-12-15T16:00:00Z', isPasswordProtected: true  },
  { title: 'Paris Fashion Week — Designer Showcase',  organizerName: 'pfw.organizers', status: 'completed', participants: 2100,  createdAt: '2025-03-02T18:00:00Z', isPasswordProtected: true  },
  { title: 'Global Health Symposium — Research Track',organizerName: 'health.global',  status: 'active',    participants: 760,   createdAt: '2026-02-08T09:30:00Z', isPasswordProtected: false },
  { title: 'Tokyo Robotics Showcase',                 organizerName: 'tokyo.tech',     status: 'active',    participants: 980,   createdAt: '2026-02-19T10:00:00Z', isPasswordProtected: false },
  { title: 'NBA All-Star Fan Fest',                   organizerName: 'nba.events',     status: 'completed', participants: 4400,  createdAt: '2025-02-20T12:00:00Z', isPasswordProtected: false },
  { title: 'International Film Critics Forum',        organizerName: 'critics.circle', status: 'draft',     participants: 0,     createdAt: '2026-03-03T09:00:00Z', isPasswordProtected: false },
];

const PER_PAGE = 20;
export function getDemoEvents({ page = 1, status = 'all' } = {}) {
  const filtered = status === 'all' ? DEMO_EVENT_POOL : DEMO_EVENT_POOL.filter(e => e.status === status);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const slice = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const events = slice.map((e, i) => ({
    _id:                `demo-${i}-${page}`,
    title:              e.title,
    organizerName:      e.organizerName,
    status:             e.status,
    isPasswordProtected: e.isPasswordProtected,
    createdAt:          e.createdAt,
    participants:       Array.from({ length: e.participants }, (_, j) => ({ username: `user${j}` })),
    settings:           { requireApproval: false },
  }));
  return { events, totalPages };
}

// ─── Organizers ───────────────────────────────────────────────────────────────
export function getDemoOrganizers() {
  return [
    { name: 'Sarah Chen',        email: 'sarah.chen@nexusevents.io',       totalEvents: 47, activeEvents: 12, totalParticipants: 84203,  firstEvent: '2024-01-14T10:00:00Z', lastEvent: '2026-03-01T09:00:00Z', isEnterprise: true  },
    { name: 'Marcus Williams',   email: 'mwilliams@globalconferences.com', totalEvents: 89, activeEvents: 6,  totalParticipants: 121840, firstEvent: '2023-08-02T09:00:00Z', lastEvent: '2026-02-28T14:00:00Z', isEnterprise: true  },
    { name: 'Priya Nair',        email: 'priya.nair@eventosphere.co',      totalEvents: 31, activeEvents: 8,  totalParticipants: 47411,  firstEvent: '2024-03-10T19:00:00Z', lastEvent: '2026-03-05T11:00:00Z', isEnterprise: false },
    { name: 'James O\'Sullivan', email: 'james@premier-events.ie',         totalEvents: 22, activeEvents: 3,  totalParticipants: 24820,  firstEvent: '2024-05-18T18:00:00Z', lastEvent: '2026-01-22T16:00:00Z', isEnterprise: true  },
    { name: 'Aiko Tanaka',       email: 'aiko.tanaka@shinsei-events.jp',   totalEvents: 58, activeEvents: 14, totalParticipants: 112044, firstEvent: '2023-11-01T09:00:00Z', lastEvent: '2026-03-07T10:00:00Z', isEnterprise: true  },
    { name: 'Chloe Dupont',      email: 'cdupont@pariseventco.fr',         totalEvents: 41, activeEvents: 5,  totalParticipants: 58317,  firstEvent: '2023-06-12T20:00:00Z', lastEvent: '2026-02-14T18:00:00Z', isEnterprise: true  },
    { name: 'Kwame Asante',      email: 'kwame.asante@afroevents.gh',      totalEvents: 17, activeEvents: 4,  totalParticipants: 22100,  firstEvent: '2024-02-28T08:00:00Z', lastEvent: '2026-03-01T09:00:00Z', isEnterprise: false },
    { name: 'Natasha Ivanova',   email: 'n.ivanova@eventpro-eu.com',      totalEvents: 33, activeEvents: 7,  totalParticipants: 49820,  firstEvent: '2024-01-10T10:00:00Z', lastEvent: '2026-02-20T15:00:00Z', isEnterprise: true  },
    { name: 'Diego Fernandez',   email: 'dfernandez@latam-events.mx',     totalEvents: 26, activeEvents: 9,  totalParticipants: 38403,  firstEvent: '2024-04-22T11:00:00Z', lastEvent: '2026-03-03T12:00:00Z', isEnterprise: false },
    { name: 'Lena Hoffmann',     email: 'lhoffmann@berlinevent-gmbh.de',  totalEvents: 64, activeEvents: 18, totalParticipants: 97840,  firstEvent: '2023-03-01T08:00:00Z', lastEvent: '2026-03-06T16:00:00Z', isEnterprise: true  },
  ];
}

// ─── Staff ────────────────────────────────────────────────────────────────────
export function getDemoStaff() {
  return [
    { _id:'ds-01', username:'checkin_sarah',   eventTitle:'Global Tech Summit 2026',           eventSubdomain:'global-tech-summit',   role:'check-in', lastSeen:'2026-03-08T08:41:00Z', hasPin:true  },
    { _id:'ds-02', username:'door_james',       eventTitle:'Global Tech Summit 2026',           eventSubdomain:'global-tech-summit',   role:'check-in', lastSeen:'2026-03-08T09:02:00Z', hasPin:true  },
    { _id:'ds-03', username:'vip_host_kai',     eventTitle:'World AI Congress — Singapore 2026',eventSubdomain:'wac-sg-2026',          role:'host',     lastSeen:'2026-03-07T22:15:00Z', hasPin:true  },
    { _id:'ds-04', username:'reg_desk_01',      eventTitle:'World AI Congress — Singapore 2026',eventSubdomain:'wac-sg-2026',          role:'check-in', lastSeen:'2026-03-08T07:58:00Z', hasPin:true  },
    { _id:'ds-05', username:'security_a',       eventTitle:'Harvard CS Commencement 2026',      eventSubdomain:'harvard-cs-2026',      role:'security', lastSeen:'2026-03-06T14:30:00Z', hasPin:false },
    { _id:'ds-06', username:'staff_london_01',  eventTitle:'Diwali Cultural Gala — London',     eventSubdomain:'diwali-gala-london',   role:'check-in', lastSeen:'2026-02-10T19:45:00Z', hasPin:true  },
    { _id:'ds-07', username:'vc_night_host',    eventTitle:'NYC Startup Showcase',              eventSubdomain:'nyc-startup-night',    role:'host',     lastSeen:'2026-02-18T17:55:00Z', hasPin:true  },
    { _id:'ds-08', username:'scanner_1',        eventTitle:"Google I/O Community Satellite",    eventSubdomain:'gio-nyc',              role:'check-in', lastSeen:'2026-02-22T11:20:00Z', hasPin:true  },
    { _id:'ds-09', username:'climate_reg',      eventTitle:'Global Climate Summit — Youth Track',eventSubdomain:'climate-summit-yt',  role:'check-in', lastSeen:'2026-01-22T09:15:00Z', hasPin:false },
    { _id:'ds-10', username:'pride_door_1',     eventTitle:'Pride Month Opening Concert',       eventSubdomain:'pride-concert-2026',   role:'security', lastSeen:'2026-01-28T15:30:00Z', hasPin:true  },
    { _id:'ds-11', username:'palace_liaison',   eventTitle:'Royal State Reception',             eventSubdomain:'royal-reception',      role:'host',     lastSeen:'2026-02-28T16:30:00Z', hasPin:true  },
    { _id:'ds-12', username:'ycomb_staff',      eventTitle:'Y Combinator Spring Demo Day (W26)',eventSubdomain:'yc-w26-demo-day',     role:'check-in', lastSeen:'2026-02-10T14:20:00Z', hasPin:true  },
  ];
}

// ─── Employees ────────────────────────────────────────────────────────────────
export const DEMO_EMPLOYEES = [
  { _id:'emp-01', name:'Alex Rivera',   email:'alex.rivera@planit.app',   role:'super_admin', isDemo:false, createdAt:'2023-01-10T09:00:00Z' },
  { _id:'emp-02', name:'Jordan Kim',    email:'jordan.kim@planit.app',    role:'admin',       isDemo:false, createdAt:'2023-03-14T10:00:00Z' },
  { _id:'emp-03', name:'Sam Okafor',    email:'sam.okafor@planit.app',    role:'moderator',   isDemo:false, createdAt:'2023-06-01T11:00:00Z' },
  { _id:'emp-04', name:'Taylor Reeves', email:'taylor.reeves@planit.app', role:'support',     isDemo:false, createdAt:'2023-07-22T09:30:00Z' },
  { _id:'emp-05', name:'Morgan Hayes',  email:'morgan.hayes@planit.app',  role:'analyst',     isDemo:false, createdAt:'2024-01-08T08:00:00Z' },
  { _id:'emp-06', name:'Casey Lin',     email:'casey.lin@planit.app',     role:'developer',   isDemo:false, createdAt:'2024-02-15T10:00:00Z' },
  { _id:'emp-07', name:'Demo Account',  email:'demo@planit.app',          role:'demo',        isDemo:true,  createdAt:'2024-06-01T12:00:00Z' },
];

// ─── All Participants ─────────────────────────────────────────────────────────
const DEMO_USERNAMES = [
  'skyler_events','priya.nair92','marcus_w','lena_h','aiko.t','kwame_a',
  'chloe_d','diego_f','natasha_iv','amara_d','james_os','victor_cheng',
  'fatima_z','oliver_schmidt','yuki_tanaka','carlos_m','isabella_r',
  'noah_anderson','sofia_b','ethan_park','mia_chen','liam_nguyen',
  'emma_garcia','william_brown','ava_johnson','lucas_wilson','harper_taylor',
  'mason_moore','evelyn_jackson','logan_martin','abigail_lee','benjamin_white',
  'ella_harris','james_thompson','scarlett_lewis','elijah_clark','grace_robinson',
  'aiden_walker','chloe_hall','sebastian_young','zoey_allen','matthew_king',
  'riley_wright','henry_scott','nora_green','alexander_baker','lily_adams',
  'daniel_nelson','hannah_carter','oliver_wang',
];

export function getDemoParticipants({ page = 1, search = '' } = {}) {
  const events = DEMO_EVENT_POOL;
  const all = DEMO_USERNAMES.map((u, i) => ({
    _id:           `demo-user-${i}`,
    username:      u,
    eventTitle:    events[i % events.length].title,
    eventSubdomain:events[i % events.length].organizerName.replace(/\./g,'-'),
    joinedAt:      new Date(Date.now() - (i * 86400000 * 3)).toISOString(),
    hasPassword:   i % 3 !== 0,
    rsvp: i % 4 === 0 ? null : { status: ['attending','not_attending','maybe'][i % 3] },
  }));
  const filtered = search ? all.filter(u => u.username.toLowerCase().includes(search.toLowerCase())) : all;
  const limit = 50;
  const pages = Math.ceil(filtered.length / limit);
  return { participants: filtered.slice((page - 1) * limit, page * limit), total: filtered.length, pages };
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export function getDemoAnalytics() {
  return {
    totalEvents:       847193,
    activeEvents:      14281,
    totalParticipants: 94837004,
    totalMessages:     48663027,
    totalPolls:        2994841,
    totalFiles:        7442310,
    recentEvents:      4821,
    exportStats: {
      totalExports:    jitter(84739),
      csvExports:      jitter(54203),
      calendarExports: jitter(28472),
      lastExport:      new Date(Date.now() - 1800000).toISOString(),
      byStatus:        { active: 14281, completed: 721084, draft: 111828 },
      recentGrowth:    +(18.4 + noise(40, 2)).toFixed(1),
    },
  };
}
