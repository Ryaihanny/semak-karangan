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
  if (!idToken) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const { set } = req.query;

    const snapshot = await db
      .collection('karanganResults')
      .where('uid', '==', uid)
      .where('set', '==', set)
      .orderBy('timestamp', 'asc')
      .get();

const results = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        nama: data.nama,
        kelas: data.kelas || '',
        set: data.set,
        markahIsi: data.markahIsi,
        markahBahasa: data.markahBahasa,
        markahKeseluruhan: data.markahKeseluruhan,
        ulasan: data.ulasan, 
        karangan: data.karangan,
        // ADD THESE 2 LINES BELOW FOR THE PDF:
        karanganUnderlined: data.karanganUnderlined || '', 
        kesalahanBahasa: data.kesalahanBahasa || [],
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp,
      };
    });

    return res.status(200).json({ results });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}