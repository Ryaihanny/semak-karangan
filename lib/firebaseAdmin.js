import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    // Check if we have the individual variables instead of the full JSON
    if (process.env.GOOGLE_PROJECT_ID && process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.GOOGLE_PROJECT_ID,
          clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
          // This line fixes the common "newline" issue in private keys
          privateKey: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      
      console.log("🚀 Firebase Admin initialized using individual variables");
    } else {
      console.warn("⚠️ Firebase Admin: Missing one or more variables (Project ID, Email, or Private Key).");
    }
  } catch (error) {
    console.error("❌ Firebase Admin initialization error:", error);
  }
}

const db = admin.firestore();

export { db };
export default admin;