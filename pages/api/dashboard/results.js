import admin from 'firebase-admin';

const db = admin.firestore();

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const { set } = req.query;
    if (!set) return res.status(400).json({ error: 'Set is required' });

    const snapshot = await db
      .collection('karanganResults')
      .where('uid', '==', uid)
      .where('set', '==', set)
      .get();

    const results = snapshot.docs.map(doc => doc.data());

    res.status(200).json({ results });
  } catch (error) {
    console.error('Dashboard results error:', error);
    return res.status(401).json({ error: 'Unauthorized or token invalid' });
  }
}
