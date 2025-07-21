import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  const { set } = req.query;
  if (!set) return res.status(400).json({ error: 'Set is required' });

  const snapshot = await db.collection('karanganResults').where('set', '==', set).get();
  const results = snapshot.docs.map(doc => doc.data());

  res.status(200).json({ results });
}
