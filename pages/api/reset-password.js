import admin from 'firebase-admin';

// Inisialisasi Firebase Admin (Pastikan ini hanya dipanggil sekali)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { uid, newPassword } = req.body;

  try {
    // 1. Guna Admin SDK untuk paksa tukar password dalam Auth
    await admin.auth().updateUser(uid, {
      password: newPassword,
    });

    // 2. Tandakan balik dalam Firestore supaya pelajar kena tukar lagi sekali (pilihan)
    const db = admin.firestore();
    await db.collection('users').doc(uid).update({
      mustChangePassword: true
    });

    return res.status(200).json({ message: 'Kata laluan berjaya di-reset!' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}