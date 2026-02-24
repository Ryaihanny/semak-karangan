// pages/api/get-task.js
import { db } from '@/lib/firebaseAdmin';

export default async function handler(req, res) {
  // 1. ADD THIS: Allows your frontend to access the API without CORS errors
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { taskId } = req.query;

  // 2. Safety check for taskId
  if (!taskId || taskId === 'undefined') {
    return res.status(400).json({ message: "ID Tugasan tidak sah" });
  }

  try {
    const taskSnap = await db.collection('assignments').doc(taskId).get();

    if (!taskSnap.exists) {
      return res.status(404).json({ message: "Tugasan tidak dijumpai" });
    }

    const taskData = taskSnap.data();
    
    return res.status(200).json({
      imageUrl: taskData.attachmentUrl || null, 
      instructions: taskData.instructions || "Tulis karangan berdasarkan tugasan ini.",
      title: taskData.title
    });
  } catch (error) {
    // 3. THIS IS CRUCIAL: It prints the REAL error in your Railway Logs
    console.error("❌ Firestore Error in get-task:", error);
    
    return res.status(500).json({ 
        message: "Ralat teknikal", 
        error: error.message // This helps us debug
    });
  }
}