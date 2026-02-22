import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    if (process.env.GOOGLE_CREDENTIALS) {
      // Parse the full JSON string from your environment variable
      const serviceAccount = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("🚀 Firebase Admin initialized via GOOGLE_CREDENTIALS");
    } else {
      console.warn("⚠️ Firebase Admin: No GOOGLE_CREDENTIALS found in environment.");
    }
  } catch (error) {
    console.error("❌ Firebase Admin initialization error:", error);
  }
}

const db = admin.firestore();

export { db };
export default admin;