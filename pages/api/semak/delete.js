import admin from '@/lib/firebaseAdmin';

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // ✅ Step 1: Extract & verify ID token
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  let uid;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    uid = decodedToken.uid;
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  try {
    const { nama } = req.body;

    if (!nama || (Array.isArray(nama) && nama.length === 0)) {
      return res.status(400).json({ error: 'Nama pelajar diperlukan' });
    }

    const namaList = Array.isArray(nama) ? nama : [nama];

    const batch = db.batch();
    let foundAny = false;

    for (const n of namaList) {
      const snapshot = await db
        .collection('karanganResults')
        .where('nama', '==', n)
        .where('uid', '==', uid) // ✅ Ensure only delete their own
        .get();

      if (!snapshot.empty) {
        foundAny = true;
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
      }
    }

    if (!foundAny) {
      return res.status(404).json({ error: 'Tiada data pelajar milik anda yang dijumpai' });
    }

    await batch.commit();
    return res.status(200).json({ message: 'Data pelajar berjaya dipadam' });

  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Ralat pelayan semasa memadam data' });
  }
}
