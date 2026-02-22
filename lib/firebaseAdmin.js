import admin from "firebase-admin";

// Check if we already have an app initialized to prevent "Duplicate App" errors
if (!admin.apps.length) {
  try {
    // Attempt 1: Use Environment Variables (Best practice for Next.js)
    if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      console.log("🚀 Firebase Admin initialized via Env Vars");
    } 
    // Attempt 2: Fallback to JSON file if Env Vars are missing
    else {
      const serviceAccount = require("../google-credentials.json");
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("📁 Firebase Admin initialized via JSON file");
    }
  } catch (error) {
    console.error("❌ Firebase Admin initialization error:", error);
  }
}

const db = admin.firestore();

export { db };
export default admin;