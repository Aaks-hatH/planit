'use strict';

const crypto = require('crypto');

function deriveKey(purpose) {
  const raw = process.env.PLANIT_LICENSE_KEY;
  if (!raw || !/^[0-9a-f]{64}$/i.test(raw)) {
    console.error('\n  [PlanIt] Fatal: server configuration invalid.\n');
    process.exit(1);
  }
  return crypto.createHmac('sha256', raw).update('planit::' + purpose).digest('hex');
}

function safeEqual(a, b) {
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

function loadProofs() {
  const p1 = process.env.PLANIT_INTEGRITY_PROOF_1;
  const p2 = process.env.PLANIT_INTEGRITY_PROOF_2;
  const p3 = process.env.PLANIT_INTEGRITY_PROOF_3;
  const hex64 = /^[0-9a-f]{64}$/i;
  if (!p1 || !p2 || !p3 || !hex64.test(p1) || !hex64.test(p2) || !hex64.test(p3)) {
    console.error('\n  [PlanIt] Fatal: server configuration invalid.\n');
    process.exit(1);
  }
  return { p1, p2, p3 };
}

function verifyIntegrity() {
  const raw   = process.env.PLANIT_LICENSE_KEY;
  const proof = loadProofs();

  const t1        = deriveKey('server-integrity-check');
  const computed1 = crypto.createHmac('sha256', raw).update(t1).digest('hex');

  const t2        = deriveKey('deployment-seal');
  const computed2 = crypto.createHmac('sha256', t2).update('planit::secondary-anchor').digest('hex');

  const t3        = deriveKey('module-chain');
  const computed3 = crypto.createHmac('sha256', raw).update(t3 + t2).digest('hex');

  if (!safeEqual(computed1, proof.p1) || !safeEqual(computed2, proof.p2) || !safeEqual(computed3, proof.p3)) {
    console.error('\n  [PlanIt] Fatal: server configuration invalid.\n');
    process.exit(1);
  }
}

function scheduleReverification() {
  const t = setInterval(verifyIntegrity, 4 * 60 * 60 * 1000);
  if (t.unref) t.unref();
}

function signResponse(payload, path) {
  const sigKey = deriveKey('response-signing');
  return crypto.createHmac('sha256', sigKey).update(path + ':' + payload).digest('hex');
}

const secrets = {
  get jwt()    { return deriveKey('jwt-signing-secret'); },
  get socket() { return deriveKey('socket-auth-secret'); },
  get db()     { return deriveKey('db-field-encryption'); },
};

module.exports = { secrets, verifyIntegrity, scheduleReverification, signResponse };
