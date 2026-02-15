const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Support/Donation Model
const supportSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: String,
  amount: { type: Number, required: true },
  message: String,
  stripePaymentId: String,
  type: { type: String, enum: ['support', 'feature_request'], default: 'support' },
  featureRequest: String,
  createdAt: { type: Date, default: Date.now }
});

const Support = mongoose.model('Support', supportSchema);

// ══════════════════════════════════════════════════════════════════════════
// DISCORD NOTIFICATION (Optional)
// ══════════════════════════════════════════════════════════════════════════

async function sendDiscordNotification(data) {
  if (!process.env.DISCORD_WEBHOOK_URL) return;

  const { name, amount, type, message, feature } = data;
  const isFeature = type === 'feature_request';
  const displayName = (name && name.trim()) ? name.trim() : 'Anonymous';
  const amountFormatted = `$${(amount / 100).toFixed(2)}`;

  const embed = {
    title: isFeature ? 'New Feature Request' : 'New Donation',
    description: isFeature
      ? `**${displayName}** submitted a feature request with ${amountFormatted}`
      : `**${displayName}** just supported PlanIt with ${amountFormatted}`,
    color: isFeature ? 0x3B82F6 : 0x10B981,
    fields: [
      { name: 'From', value: displayName, inline: true },
      { name: 'Amount', value: amountFormatted, inline: true },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'PlanIt' },
  };

  // Only push non-empty string values — Discord rejects empty/undefined field values
  if (isFeature && feature && feature.trim()) {
    embed.fields.push({ name: 'Feature Request', value: feature.trim().substring(0, 1024) });
  } else if (!isFeature && message && message.trim()) {
    embed.fields.push({ name: 'Message', value: message.trim().substring(0, 1024) });
  }

  // Top-level content gives Discord something to show even if embed rendering fails
  const content = isFeature
    ? `New feature request from **${displayName}** — ${amountFormatted}`
    : `New donation from **${displayName}** — ${amountFormatted}`;

  try {
    const response = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, embeds: [embed] }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('Discord webhook error:', response.status, text);
    }
  } catch (error) {
    console.error('Discord notification failed:', error);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// CREATE DONATION PAYMENT
// ══════════════════════════════════════════════════════════════════════════

router.post('/create-payment',
  [
    body('amount').isInt({ min: 300 }).withMessage('Minimum $3'),
    body('email').isEmail().withMessage('Valid email required'),
    body('name').optional().trim(),
    body('message').optional().trim().isLength({ max: 500 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { amount, email, name, message } = req.body;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: ' Support PlanIt',
              description: message || 'Thank you for your support!',
            },
            unit_amount: amount,
          },
          quantity: 1,
        }],
        customer_email: email,
        success_url: `${process.env.FRONTEND_URL}/support/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/support`,
        metadata: {
          type: 'support',
          name: name || 'Anonymous',
          message: message || '',
        },
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      console.error('Payment creation error:', error);
      res.status(500).json({ error: 'Failed to create payment session' });
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════
// CREATE FEATURE REQUEST PAYMENT
// ══════════════════════════════════════════════════════════════════════════

router.post('/feature-request',
  [
    body('amount').isInt({ min: 500 }).withMessage('Minimum $5'),
    body('email').isEmail().withMessage('Valid email required'),
    body('name').optional().trim(),
    body('feature').trim().isLength({ min: 10, max: 500 }).withMessage('Feature description required'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { amount, email, name, feature } = req.body;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: '🚀 Feature Request',
              description: feature.substring(0, 100),
            },
            unit_amount: amount,
          },
          quantity: 1,
        }],
        customer_email: email,
        success_url: `${process.env.FRONTEND_URL}/support/success?session_id={CHECKOUT_SESSION_ID}&type=feature`,
        cancel_url: `${process.env.FRONTEND_URL}/support`,
        metadata: {
          type: 'feature_request',
          name: name || 'Anonymous',
          feature: feature,
        },
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      console.error('Feature request error:', error);
      res.status(500).json({ error: 'Failed to create feature request' });
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════
// VERIFY PAYMENT
// ══════════════════════════════════════════════════════════════════════════

router.get('/verify-payment/:sessionId', async (req, res, next) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    
    if (session.payment_status === 'paid') {
      // Avoid duplicate DB entries if verify is called more than once
      const existing = await Support.findOne({ stripePaymentId: session.payment_intent });
      if (!existing) {
        const support = new Support({
          email: session.customer_details.email,
          name: session.metadata.name,
          amount: session.amount_total,
          message: session.metadata.message,
          stripePaymentId: session.payment_intent,
          type: session.metadata.type,
          featureRequest: session.metadata.feature,
        });
        await support.save();

        // Send Discord notification
        await sendDiscordNotification({
          name: session.metadata.name,
          amount: session.amount_total,
          type: session.metadata.type,
          message: session.metadata.message,
          feature: session.metadata.feature,
        });
      }

      res.json({
        success: true,
        amount: session.amount_total / 100,
        type: session.metadata.type,
        message: session.metadata.message || session.metadata.feature,
      });
    } else {
      res.json({ success: false, message: 'Payment not completed' });
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET SUPPORTERS
// ══════════════════════════════════════════════════════════════════════════

router.get('/supporters', async (req, res, next) => {
  try {
    const supporters = await Support.find({ type: 'support' })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('name amount message createdAt -_id')
      .lean();

    const total = await Support.aggregate([
      { $match: { type: 'support' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalCount = await Support.countDocuments({ type: 'support' });

    res.json({
      supporters: supporters.map(s => ({
        name: s.name || 'Anonymous',
        amount: s.amount / 100,
        message: s.message,
        date: s.createdAt,
      })),
      totalRaised: total[0]?.total / 100 || 0,
      supporterCount: totalCount,
    });
  } catch (error) {
    console.error('Supporters fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch supporters' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET FEATURE REQUESTS
// ══════════════════════════════════════════════════════════════════════════

router.get('/feature-requests', async (req, res, next) => {
  try {
    const requests = await Support.find({ type: 'feature_request' })
      .sort({ amount: -1, createdAt: -1 })
      .select('name featureRequest amount createdAt -_id')
      .lean();

    res.json({
      requests: requests.map(r => ({
        name: r.name || 'Anonymous',
        feature: r.featureRequest,
        amount: r.amount / 100,
        date: r.createdAt,
      })),
      totalRequests: requests.length,
    });
  } catch (error) {
    console.error('Feature requests fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch feature requests' });
  }
});

module.exports = router;
