import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    if (process.env.GOOGLE_CREDENTIALS) {
      // Fix: Specifically handle potential newline issues in the private key string
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }

      admin.initializeApp({
        credential: admin.credential.cert(credentials),
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