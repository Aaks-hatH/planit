'use strict';



const { signResponse } = require('../keys');

/**
 * Express middleware.  Wraps res.json() to intercept the serialised body
 * and append the signature header before the response is flushed.
 */
function attachResponseSignature(req, res, next) {
  const _json = res.json.bind(res);

  res.json = function signedJson(body) {
    try {
      const serialised = JSON.stringify(body);
      const sig        = signResponse(serialised, req.path);
      res.setHeader('X-PlanIt-Sig', sig);
    } catch (_) {
      // Never let a signing failure break a real response — but do log it.
      console.error('[PlanIt] Warning: response signing failed for', req.path);
    }
    return _json(body);
  };

  next();
}

module.exports = { attachResponseSignature };
