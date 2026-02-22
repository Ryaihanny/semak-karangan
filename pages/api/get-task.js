// pages/api/get-task.js
import { db } from '@/lib/firebaseAdmin';

export default async function handler(req, res) {
  const { taskId } = req.query;

  try {
    // 1. Point to 'assignments' (the collection your Class/[id].js uses)
    const taskSnap = await db.collection('assignments').doc(taskId).get();

    if (!taskSnap.exists) {
      return res.status(404).json({ message: "Tugasan tidak dijumpai" });
    }

    const taskData = taskSnap.data();
    
    return res.status(200).json({
      // 2. Map 'attachmentUrl' (Teacher's name) to 'imageUrl' (Student's page name)
      imageUrl: taskData.attachmentUrl || null, 
      instructions: taskData.instructions || "Tulis karangan berdasarkan tugasan ini.",
      title: taskData.title
    });
  } catch (error) {
    return res.status(500).json({ message: "Ralat teknikal" });
  }
}