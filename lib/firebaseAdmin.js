// lib/firebaseAdmin.js
import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    const projectId = process.env.GOOGLE_PROJECT_ID;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      // FIX: Clean the private key of extra quotes and fix newlines
      privateKey = privateKey.replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log("🚀 Firebase Admin initialized successfully");
    } else {
      console.error("❌ Missing Firebase Variables");
    }
  } catch (error) {
    console.error("❌ Firebase Init Error:", error);
  }
}

const db = admin.firestore();
export { db };
export default admin;