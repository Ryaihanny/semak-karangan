// pages/api/semak/results.js

import { db } from '@/lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const snapshot = await db.collection('karanganResults').orderBy('timestamp', 'desc').get();

    const results = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching karangan results from Firestore:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
