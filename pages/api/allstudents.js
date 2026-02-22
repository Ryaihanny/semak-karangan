import admin, { db } from "../../lib/firebaseAdmin";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) return res.status(401).json({ error: "Unauthorized: No token provided" });

  let uid;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    uid = decodedToken.uid;
  } catch {
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }

  try {
    const snapshot = await db.collection("karanganResults").where("uid", "==", uid).get();

    // Use a Map to store Name as key and Class as value
    // This ensures we have one entry per name, but can still see their class
    const studentMap = new Map();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.nama) {
        // We store the most recent class found for this student name
        studentMap.set(data.nama, data.kelas || "");
      }
    });

    // Create an array of strings like "Ali (5 Amanah)" or just "Ali"
    const students = Array.from(studentMap.entries())
      .map(([nama, kelas]) => {
        return kelas ? `${nama} (${kelas})` : nama;
      })
      .sort();

    return res.status(200).json({ students });
  } catch (error) {
    console.error("Error fetching all students:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
}