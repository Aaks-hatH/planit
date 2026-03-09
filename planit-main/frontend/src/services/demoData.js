// ─── PlanIt Demo Mode Data Engine ────────────────────────────────────────────
// Every number here is fake and designed to impress during demos.
// The engine generates deterministic-looking live data that drifts slowly
// over time so the dashboard feels alive without looking scripted.

const SEED = Date.now();

function noise(offset = 0, amplitude = 1, frequency = 0.001) {
  const t = (Date.now() + offset) * frequency;
  return Math.sin(t) * Math.cos(t * 1.7 + 0.4) * amplitude;
}

function jitter(base, pct = 0.02) {
  return Math.round(base + base * noise(base) * pct);
}

// ── Static infrastructure snapshot (regenerated every render tick) ────────────

export function getDemoStats() {
  return {
    totalEvents:       jitter(2_847_193),
    activeEvents:      jitter(94_281),
    totalMessages:     jitter(418_663_027),
    totalPolls:        jitter(12_994_841),
    totalFiles:        jitter(87_442_310),
    totalParticipants: jitter(1_294_837_004),
    recentEvents:      jitter(4_821),
    totalStorage:      jitter(9_821_000_000_000), // ~9.8 TB in bytes
    averageParticipantsPerEvent: jitter(455),
  };
}

export const DATA_CENTERS = [
  { id: 'us-east-1',    name: 'US East (Virginia)',     region: 'us-east',    servers: 3847, load: 62, lat: 38.9,  lng: -77.0,  status: 'nominal',   tier: 'primary'   },
  { id: 'us-west-2',    name: 'US West (Oregon)',       region: 'us-west',    servers: 2914, load: 58, lat: 45.5,  lng: -122.6, status: 'nominal',   tier: 'primary'   },
  { id: 'eu-west-1',    name: 'EU West (Ireland)',      region: 'eu-west',    servers: 2203, load: 71, lat: 53.3,  lng: -6.2,   status: 'nominal',   tier: 'primary'   },
  { id: 'eu-central-1', name: 'EU Central (Frankfurt)', region: 'eu-central', servers: 1884, load: 67, lat: 50.1,  lng: 8.7,    status: 'nominal',   tier: 'primary'   },
  { id: 'ap-south-1',   name: 'Asia Pacific (Mumbai)',  region: 'ap-south',   servers: 1622, load: 74, lat: 19.1,  lng: 72.9,   status: 'nominal',   tier: 'primary'   },
  { id: 'ap-east-1',    name: 'Asia Pacific (Tokyo)',   region: 'ap-east',    servers: 1408, load: 55, lat: 35.7,  lng: 139.7,  status: 'nominal',   tier: 'primary'   },
  { id: 'sa-east-1',    name: 'South America (São Paulo)', region: 'sa-east', servers: 887,  load: 43, lat: -23.5, lng: -46.6,  status: 'nominal',   tier: 'secondary' },
  { id: 'ca-central-1', name: 'Canada (Montreal)',      region: 'ca-central', servers: 743,  load: 39, lat: 45.5,  lng: -73.6,  status: 'nominal',   tier: 'secondary' },
  { id: 'af-south-1',   name: 'Africa (Cape Town)',     region: 'af-south',   servers: 412,  load: 31, lat: -33.9, lng: 18.4,   status: 'nominal',   tier: 'edge'      },
  { id: 'me-south-1',   name: 'Middle East (Bahrain)',  region: 'me-south',   servers: 388,  load: 48, lat: 26.2,  lng: 50.6,   status: 'nominal',   tier: 'edge'      },
  { id: 'ap-se-1',      name: 'Asia Pacific (Singapore)',region: 'ap-se',     servers: 1104, load: 61, lat: 1.35,  lng: 103.8,  status: 'nominal',   tier: 'primary'   },
  { id: 'au-east-1',    name: 'Oceania (Sydney)',       region: 'au-east',    servers: 621,  load: 44, lat: -33.9, lng: 151.2,  status: 'nominal',   tier: 'secondary' },
];

export function getDemoFleet() {
  const t = Date.now();
  return {
    totalServers:      jitter(18_033),
    activeServers:     jitter(17_944),
    dataCenters:       DATA_CENTERS.length,
    regions:           8,
    reqPerSecond:      jitter(284_117),
    p99LatencyMs:      Math.round(12 + noise(1, 3)),
    p50LatencyMs:      Math.round(3  + noise(2, 1)),
    uptimePct:         99.9997,
    bandwidthGbps:     +(842 + noise(3, 30)).toFixed(1),
    tlsHandshakesPerSec: jitter(184_230),
    cacheHitRate:      +(98.7 + noise(4, 0.4)).toFixed(2),
    backends: DATA_CENTERS.map((dc, i) => ({
      index:     i,
      name:      dc.name,
      region:    dc.region,
      active:    true,
      alive:     true,
      latencyMs: Math.round(dc.load * 0.18 + noise(i * 100, 2)),
      lastPing:  new Date(t - Math.random() * 4000).toISOString(),
      requests:  jitter(dc.servers * 8821),
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
  };
}

export function getDemoSystem() {
  return {
    process: {
      pid:         1,
      nodeVersion: 'v24.14.0',
      platform:    'linux',
      arch:        'x64',
      uptime:      Math.floor((Date.now() - SEED) / 1000) + 7_894_201,
    },
    memory: {
      rss:       jitter(2_847),
      heapUsed:  jitter(1_924),
      heapTotal: jitter(3_072),
      external:  jitter(412),
      pct:       Math.round(63 + noise(10, 4)),
    },
    cpu:   { load1: +(2.84 + noise(11, 0.3)).toFixed(2), load5: +(2.71).toFixed(2), load15: +(2.68).toFixed(2) },
    os:    { totalMem: 65536, freeMem: jitter(24018), cpus: 128, platform: 'linux x64' },
    db:    {
      status:    'connected',
      name:      'planit-prod-global',
      host:      'cluster0-shard-00-00.abc12.mongodb.net',
      poolSize:  500,
      activeConnections: jitter(384),
      opCounters: {
        insert: jitter(982_441_027),
        query:  jitter(48_293_847_102),
        update: jitter(12_847_293_441),
        delete: jitter(394_847_021),
      },
      replicaSet: {
        members: [
          { name: 'primary',    state: 'PRIMARY',   lag: 0,   region: 'us-east-1'    },
          { name: 'secondary1', state: 'SECONDARY', lag: 12,  region: 'eu-west-1'    },
          { name: 'secondary2', state: 'SECONDARY', lag: 18,  region: 'ap-south-1'   },
          { name: 'secondary3', state: 'SECONDARY', lag: 24,  region: 'us-west-2'    },
          { name: 'hidden',     state: 'SECONDARY', lag: 0,   region: 'us-east-1'    },
        ],
      },
      shards: 24,
      totalDocuments: jitter(9_284_738_291),
      storageGB: +(9821 + noise(20, 10)).toFixed(1),
    },
    redis: {
      status:        'connected',
      version:       '7.2.4',
      mode:          'cluster',
      nodes:         48,
      totalKeys:     jitter(284_738_029),
      usedMemoryMB:  jitter(184_291),
      hitRate:       +(98.7 + noise(21, 0.3)).toFixed(2),
      opsPerSec:     jitter(2_847_193),
      clusters: [
        { name: 'cache-primary',     nodes: 12, region: 'us-east-1',    role: 'cache'    },
        { name: 'session-store',     nodes: 6,  region: 'us-east-1',    role: 'session'  },
        { name: 'rate-limit-global', nodes: 6,  region: 'eu-west-1',    role: 'limits'   },
        { name: 'pubsub-cluster',    nodes: 12, region: 'us-west-2',    role: 'pubsub'   },
        { name: 'queue-cluster',     nodes: 12, region: 'ap-south-1',   role: 'queue'    },
      ],
    },
    queues: {
      email:     { pending: jitter(284), processing: jitter(47), throughputPerMin: jitter(4821) },
      webhook:   { pending: jitter(128), processing: jitter(23), throughputPerMin: jitter(2847) },
      analytics: { pending: jitter(8421), processing: jitter(194), throughputPerMin: jitter(28471) },
      cleanup:   { pending: jitter(12), processing: jitter(3), throughputPerMin: jitter(182) },
    },
    cdnNodes: 847,
    edgeCaches: 2847,
    tlsCerts: 18294,
    activeWebsockets: jitter(2_847_193),
    socketRooms: jitter(94_281),
  };
}

export const LIVE_EVENT_NAMES = [
  'Global Tech Summit 2026',
  'World AI Congress — Singapore 2026',
  'Harvard CS Commencement 2026',
  'Diwali Cultural Gala — London',
  'UEFA Finals VIP Experience',
  'NYC Startup Showcase — Investor Night',
  'Coachella Artist Lounge — VIP',
  'Google I/O Community Satellite — NYC',
  'Oxford Ideas Forum',
  'Bollywood Global Night — Dubai',
  'Eid al-Fitr Community Celebration',
  'Y Combinator Spring Demo Day (W26)',
  'Apple WWDC Watch Party — San Francisco',
  'Pride Month Opening Concert',
  'Royal State Reception',
  'Formula 1 Singapore Grand Prix — Terrace',
  'Metropolitan Gala — After Party',
  'Davos Innovation Side-Session',
  'Cannes Film Festival — Premiere Screening',
  'SXSW Interactive Panel — Austin',
  'Berlin Art Biennale — VIP Tour',
  'Global Climate Summit — Youth Track',
  'Luxury Travel Expo — VIP Preview',
  'Blockchain Developer Summit — Seoul',
  'FinTech Leaders Roundtable — London',
  'Paris Fashion Week — Designer Showcase',
  'Global Health Symposium — Research Track',
  'Tokyo Robotics Showcase',
  'NBA All-Star Fan Fest',
  'International Film Critics Forum'
];

export function getLiveFeed() {
  const now = Date.now();
  return Array.from({ length: 12 }, (_, i) => ({
    id: `evt-${now}-${i}`,
    type: ['join', 'create', 'checkin', 'message', 'poll'][i % 5],
    event: LIVE_EVENT_NAMES[i % LIVE_EVENT_NAMES.length],
    region: DATA_CENTERS[i % DATA_CENTERS.length].name,
    ms: Math.round(2 + noise(i * 300, 1.5)),
    ts: new Date(now - i * 847 - noise(i * 400, 200) * 500).toISOString(),
  }));
}

export function getDemoScaling() {
  return {
    activeBackendCount:  18033,
    totalBackends:       20000,
    trippedCount:        0,
    scaleDownStreak:     0,
    thresholds:          { scaleUp: 20, scaleDown: 5 },
    lastAction:          'predictive',
    predictive: {
      level:      +(284.7 + noise(30, 8)).toFixed(2),
      trend:      +(1.4  + noise(31, 0.3)).toFixed(2),
      rampCount:  7,
      forecast:   +(286.1 + noise(32, 5)).toFixed(2),
      headroom:   0.85,
      historyLen: 30,
    },
    pid: { integral: 2.14, lastError: 0.82, lastLoad: 284.7, setpoint: 14, gains: { kp: 0.08, ki: 0.015, kd: 0.04 } },
    anomaly: { mean: 281.4, std: 12.8, zThreshold: 4.0, holdMs: 180000, inHold: false, holdSecsLeft: 0 },
    cooldown: { ms: 150000, active: false, secsLeft: 0, lastAction: 'predictive' },
    circadian: { floor: 3, currentHour: new Date().getUTCHours() },
  };
}

// ── Demo event list ───────────────────────────────────────────────────────────
// Matches the shape that admin/events API returns so the Events tab renders normally.

const DEMO_EVENT_POOL = [
  { title: 'Global Tech Summit 2026',                  organizerName: 'sarah.chen',       status: 'active',    participants: 4821, createdAt: '2026-01-14T10:00:00Z', isPasswordProtected: false },
  { title: 'World AI Congress — Singapore 2026',       organizerName: 'wac.organizers',   status: 'active',    participants: 16240,createdAt: '2026-02-02T09:00:00Z', isPasswordProtected: false },
  { title: 'Harvard CS Commencement 2026',             organizerName: 'harvard.cs',       status: 'active',    participants: 2140, createdAt: '2026-05-20T09:00:00Z', isPasswordProtected: true  },
  { title: 'Diwali Cultural Gala — London',             organizerName: 'uk.culture',       status: 'active',    participants: 5200, createdAt: '2026-02-10T19:00:00Z', isPasswordProtected: false },
  { title: 'UEFA Finals VIP Experience',               organizerName: 'sport.mgmt',       status: 'completed', participants: 11200,createdAt: '2025-11-10T18:00:00Z', isPasswordProtected: true  },
  { title: 'NYC Startup Showcase — Investor Night',     organizerName: 'vc.collective',    status: 'active',    participants: 874,  createdAt: '2026-02-18T17:30:00Z', isPasswordProtected: true  },
  { title: 'Coachella Artist Lounge — VIP',            organizerName: 'festival.ops',     status: 'completed', participants: 1275, createdAt: '2025-04-12T20:00:00Z', isPasswordProtected: true  },
  { title: 'Google I/O Community Satellite — NYC',     organizerName: 'dev.community',    status: 'active',    participants: 1883, createdAt: '2026-02-22T11:00:00Z', isPasswordProtected: false },
  { title: 'Oxford Ideas Forum',                       organizerName: 'oxford.forum',     status: 'completed', participants: 420,  createdAt: '2025-11-01T09:00:00Z', isPasswordProtected: false },
  { title: 'Bollywood Global Night — Dubai',           organizerName: 'events.ae',        status: 'completed', participants: 2800, createdAt: '2025-12-20T20:00:00Z', isPasswordProtected: true  },
  { title: 'Eid al-Fitr Community Celebration',        organizerName: 'community.ae',     status: 'active',    participants: 5200, createdAt: '2026-03-01T08:00:00Z', isPasswordProtected: false },
  { title: 'Y Combinator Spring Demo Day (W26)',       organizerName: 'ycombinator',      status: 'active',    participants: 1120, createdAt: '2026-02-10T14:00:00Z', isPasswordProtected: true  },
  { title: 'Apple WWDC Watch Party — San Francisco',   organizerName: 'apple.fans',       status: 'active',    participants: 677,  createdAt: '2026-03-01T13:00:00Z', isPasswordProtected: false },
  { title: 'Pride Month Opening Concert',              organizerName: 'community.org',    status: 'active',    participants: 10420,createdAt: '2026-01-28T15:00:00Z', isPasswordProtected: false },
  { title: 'Royal State Reception',                    organizerName: 'palace.events',    status: 'active',    participants: 840,  createdAt: '2026-02-28T16:00:00Z', isPasswordProtected: true  },
  { title: 'Formula 1 Singapore Grand Prix — Terrace', organizerName: 'racing.club',      status: 'completed', participants: 430,  createdAt: '2025-09-20T14:00:00Z', isPasswordProtected: true  },
  { title: 'Metropolitan Gala — After Party',          organizerName: 'fashion.inc',      status: 'completed', participants: 1240, createdAt: '2025-05-05T22:00:00Z', isPasswordProtected: true  },
  { title: 'Davos Innovation Side-Session',            organizerName: 'wef.admin',        status: 'draft',     participants: 0,    createdAt: '2026-03-01T08:00:00Z', isPasswordProtected: false },
  { title: 'Cannes Film Festival — Premiere Screening',organizerName: 'cinema.guild',     status: 'draft',     participants: 0,    createdAt: '2026-03-05T10:00:00Z', isPasswordProtected: false },
  { title: 'SXSW Interactive Panel — Austin',          organizerName: 'sxsw.team',        status: 'active',    participants: 2200, createdAt: '2026-02-12T11:00:00Z', isPasswordProtected: false },
  { title: 'Berlin Art Biennale — VIP Tour',           organizerName: 'art.berlin',       status: 'completed', participants: 610,  createdAt: '2025-10-11T10:00:00Z', isPasswordProtected: true  },
  { title: 'Global Climate Summit — Youth Track',      organizerName: 'climate.global',   status: 'active',    participants: 3200, createdAt: '2026-01-22T09:00:00Z', isPasswordProtected: false },
  { title: 'Luxury Travel Expo — VIP Preview',         organizerName: 'luxury.travel',    status: 'completed', participants: 930,  createdAt: '2025-11-30T14:00:00Z', isPasswordProtected: true  },
  { title: 'Blockchain Developer Summit — Seoul',      organizerName: 'block.dev',        status: 'active',    participants: 1450, createdAt: '2026-02-27T13:30:00Z', isPasswordProtected: false },
  { title: 'FinTech Leaders Roundtable — London',      organizerName: 'fintech.london',   status: 'completed', participants: 480,  createdAt: '2025-12-15T16:00:00Z', isPasswordProtected: true  },
  { title: 'Paris Fashion Week — Designer Showcase',   organizerName: 'pfw.organizers',   status: 'completed', participants: 2100, createdAt: '2025-03-02T18:00:00Z', isPasswordProtected: true  },
  { title: 'Global Health Symposium — Research Track',organizerName: 'health.global',    status: 'active',    participants: 760,  createdAt: '2026-02-08T09:30:00Z', isPasswordProtected: false },
  { title: 'Tokyo Robotics Showcase',                  organizerName: 'tokyo.tech',       status: 'active',    participants: 980,  createdAt: '2026-02-19T10:00:00Z', isPasswordProtected: false },
  { title: 'NBA All-Star Fan Fest',                    organizerName: 'nba.events',       status: 'completed', participants: 18400,createdAt: '2025-02-20T12:00:00Z', isPasswordProtected: false },
  { title: 'International Film Critics Forum',         organizerName: 'critics.circle',   status: 'draft',     participants: 0,    createdAt: '2026-03-03T09:00:00Z', isPasswordProtected: false }
];
const PER_PAGE = 20;

export function getDemoEvents({ page = 1, status = 'all' } = {}) {
  const filtered = status === 'all'
    ? DEMO_EVENT_POOL
    : DEMO_EVENT_POOL.filter(e => e.status === status);

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
