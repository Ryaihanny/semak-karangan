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
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const { id } = req.query; // This is the Document ID from Firestore

    const docRef = db.collection('karanganResults').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) return res.status(404).json({ error: 'Record not found' });
    if (docSnap.data().uid !== uid) return res.status(403).json({ error: 'Unauthorized access' });

    await docRef.delete();
    return res.status(200).json({ message: 'Success' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}