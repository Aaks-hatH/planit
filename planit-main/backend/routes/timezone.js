const express = require('express');
const axios = require('axios');
const { realIp } = require('../middleware/realIp');

const router = express.Router();

function isValidTimeZone(tz) {
  if (!tz || typeof tz !== 'string' || tz.length > 80) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return true;
  } catch (_) {
    return false;
  }
}

function privateOrLocalIp(ip) {
  if (!ip) return true;
  const clean = String(ip).replace(/^::ffff:/, '');
  return clean === '::1' || clean === '127.0.0.1' || clean === 'localhost' || clean.startsWith('10.') || clean.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(clean);
}

router.get('/detect', async (req, res) => {
  const browserTz = req.query.browserTz;
  const cfTz = req.headers['cf-timezone'];
  const ip = realIp(req);

  if (isValidTimeZone(cfTz)) {
    return res.json({ timezone: cfTz, source: 'cloudflare', ipBased: true });
  }

  // Privacy guard: do not send visitor IPs to a third-party geolocation
  // provider unless the deployment explicitly opts in. The response never
  // includes the raw IP or precise geolocation details.
  const externalIpLookupEnabled = process.env.TZ_IP_LOOKUP_ENABLED === 'true';
  if (externalIpLookupEnabled && !privateOrLocalIp(ip)) {
    try {
      const r = await axios.get(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { timeout: 2500 });
      if (isValidTimeZone(r.data?.timezone)) {
        return res.json({ timezone: r.data.timezone, source: 'ipapi', ipBased: true });
      }
    } catch (_) {}
  }

  if (isValidTimeZone(browserTz)) {
    return res.json({ timezone: browserTz, source: 'browser', ipBased: false });
  }

  res.json({ timezone: 'UTC', source: 'fallback', ipBased: false });
});

module.exports = router;
module.exports.isValidTimeZone = isValidTimeZone;
