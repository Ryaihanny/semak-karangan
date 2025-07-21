// pages/api/stripe/webhook.js

import { buffer } from 'micro';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Initialize Firebase Admin SDK once, using environment variable
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.GOOGLE_CREDENTIALS);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const config = {
  api: {
    bodyParser: false, // Stripe needs raw body for webhook verification
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const uid = session.metadata?.uid;
    const credits = parseInt(session.metadata?.credits || '0', 10);

    if (!uid || !credits) {
      console.log('Missing uid or credits in metadata');
      return res.status(400).send('Missing metadata');
    }

    const userRef = admin.firestore().collection('users').doc(uid);

    await admin.firestore().runTransaction(async (t) => {
      const doc = await t.get(userRef);
      const current = doc.exists ? doc.data().credits || 0 : 0;
      t.set(userRef, { credits: current + credits }, { merge: true });
    });

    console.log(`✅ Added ${credits} credits to user ${uid}`);
  }

  res.json({ received: true });
}
