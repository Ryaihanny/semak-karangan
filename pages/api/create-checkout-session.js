import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { priceId, userId } = req.body;

    if (!priceId || !userId) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price: priceId, // Stripe Price ID (pre-created in Stripe Dashboard)
          quantity: 1,
        },
      ],
      success_url: `${req.headers.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/payment-cancel`,
      metadata: {
        userId, // Pass userId for later use
      },
    });

    res.status(200).json({ sessionId: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
