// pages/api/checkout.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const creditMapping = {
  'price_1RkLm9JtYEymv1ohW2UsdXwW': 10,    // Lite
  'price_1RkLm8JtYEymv1ohQZWw37UY': 40,   // Standard
  'price_1RkLm8JtYEymv1ohHqKogD7L': 80,   // Premium
  'price_1RkLm8JtYEymv1ohv4vPnbJb': 160,  // Bulk
  'price_1RkLm8JtYEymv1ohApMLRNwh': 500,  // School Pack
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { priceId, uid, email } = req.body;

  if (!priceId || !uid) {
    return res.status(400).json({ error: 'Missing priceId or uid' });
  }

  const credits = creditMapping[priceId] || 0;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        uid,
        credits: credits.toString(),
        email: email || '',
      },
      success_url: `${req.headers.origin}/success`,
      cancel_url: `${req.headers.origin}/cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
