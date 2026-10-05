'use strict';

/**
 * socket/paymentSocket.js — public /pay namespace.
 *
 * Clients join the room for ONE invoice by presenting its 128-bit id. They only
 * ever receive that invoice's public view (no PII). Works across instances via
 * the existing Redis adapter; the pay page also polls, so this is a speed-up,
 * not a dependency.
 */

const Invoice = require('../models/Invoice');
const payments = require('../services/payments');

module.exports = function paymentSocket(io) {
  payments.setIo(io);
  const nsp = io.of('/pay');

  nsp.on('connection', (socket) => {
    let joined = 0;
    socket.on('invoice:join', async (id) => {
      if (typeof id !== 'string' || !/^[0-9a-f]{32}$/.test(id) || joined >= 3) return;
      const inv = await Invoice.findOne({ publicId: id }).select('-pii -ipHash').lean().catch(() => null);
      if (!inv) return;
      joined++;
      socket.join(`invoice:${id}`);
      socket.emit('invoice:update', payments.publicView(inv));
    });
  });
};
