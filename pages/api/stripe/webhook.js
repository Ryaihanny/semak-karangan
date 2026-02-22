// pages/api/stripe/webhook.js

import { buffer } from 'micro';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

export const config = {
  api: {
    bodyParser: false,
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
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    if (session.payment_status !== 'paid') {
      console.log(`⏳ Session completed but payment status is: ${session.payment_status}`);
      return res.json({ received: true });
    }

    const uid = session.metadata?.uid;
    const creditsToAdd = parseInt(session.metadata?.credits || '0', 10);

    if (!uid || isNaN(creditsToAdd)) {
      console.error('❌ Missing uid or credits in metadata');
      return res.status(400).send('Missing metadata');
    }

    try {
      const db = admin.firestore();
      const userRef = db.collection('users').doc(uid);
      const paymentRef = db.collection('payments').doc(session.id); // Idempotency key

      await db.runTransaction(async (transaction) => {
        const paymentDoc = await transaction.get(paymentRef);
        
        // 1. Check if this payment was already processed
        if (paymentDoc.exists) {
          console.log(`⚠️ Payment ${session.id} already processed. Skipping.`);
          return;
        }

        const userDoc = await transaction.get(userRef);
        const currentCredits = userDoc.exists ? (userDoc.data().credits || 0) : 0;

        // 2. Update user credits
        transaction.set(userRef, { 
          credits: currentCredits + creditsToAdd,
          last_purchase: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 3. Log the payment to prevent re-processing and for history
        transaction.set(paymentRef, {
          uid,
          amount: session.amount_total / 100,
          currency: session.currency,
          credits: creditsToAdd,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'completed'
        });
      });

      console.log(`✅ Successfully added ${creditsToAdd} credits to user ${uid}`);
    } catch (dbError) {
      console.error('❌ Firestore update failed:', dbError);
      return res.status(500).send('Internal Server Error');
    }
  }

  res.json({ received: true });
}