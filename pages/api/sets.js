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
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) return res.status(401).json({ error: 'Unauthorized: No token provided' });

  let uid;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    uid = decodedToken.uid;
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  try {
    const snapshot = await db.collection('karanganResults').where('uid', '==', uid).get();

    const sets = Array.from(
      new Set(snapshot.docs.map((doc) => String(doc.data().set)).filter(Boolean))
    ).sort();

    return res.status(200).json({ sets });
  } catch (error) {
    console.error('Error fetching sets:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
