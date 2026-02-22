import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  // Early exit if Stripe is not configured
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("Missing STRIPE_SECRET_KEY");
    return res.status(500).json({ error: 'Stripe is not configured on the server.' });
  }

  try {
    const { priceId, uid, credits } = req.body;

    if (!priceId || !uid || !credits) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const session = await stripe.checkout.sessions.create({
      // Added 'paynow' and 'grabpay' for better localized payment support in SGD
      payment_method_types: ['card', 'paynow', 'grabpay'],
      mode: 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Use origin for dynamic redirect based on environment (local vs production)
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/beli-kredit`, // Redirect back to pricing on cancel
      metadata: {
        uid,
        credits: String(credits), // metadata values must be strings
      },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe Session Error:", err);
    res.status(500).json({ error: err.message });
  }
}