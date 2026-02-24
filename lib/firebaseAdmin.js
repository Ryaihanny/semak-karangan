import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    const projectId = process.env.GOOGLE_PROJECT_ID;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail: clientEmail,
          // Extra safety for the private key formatting
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      console.log("🚀 Firebase Admin initialized successfully");
    } else {
      // This will show up in Railway Logs so you know which one is missing
      console.error("❌ Firebase Admin Missing Variables:", {
        hasProjectId: !!projectId,
        hasClientEmail: !!clientEmail,
        hasPrivateKey: !!privateKey
      });
    }
  } catch (error) {
    console.error("❌ Firebase Admin initialization error:", error);
  }
}

const db = admin.firestore();

export { db };
export default admin;