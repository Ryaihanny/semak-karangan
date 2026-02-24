// lib/firebaseAdmin.js
import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (serviceAccountVar) {
      // This handles both a stringified JSON or a direct object
      const serviceAccount = JSON.parse(serviceAccountVar);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("🚀 Firebase Admin initialized successfully");
    } else {
      console.error("❌ Missing FIREBASE_SERVICE_ACCOUNT Variable");
    }
  } catch (error) {
    console.error("❌ Firebase Init Error:", error);
  }
}

const db = admin.firestore();
export { db };
export default admin;