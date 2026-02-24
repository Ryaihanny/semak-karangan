import { analyseKarangan } from '@/lib/analyseKarangan';
import { db } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

const LEVEL_SETTINGS = {
  'P3': { maxIsi: 8,  maxBahasa: 7,  total: 15 },
  'P4': { maxIsi: 8,  maxBahasa: 7,  total: 15 },
  'P5': { maxIsi: 20, maxBahasa: 20, total: 40 },
  'P6': { maxIsi: 20, maxBahasa: 20, total: 40 },
};

async function deductCredits(userId, amount) {
  const userRef = db.collection('users').doc(userId);
  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) return 0;
    const currentCredits = Number(userDoc.data()?.credits ?? 0);
    const newTotal = Math.max(0, currentCredits - amount);
    transaction.update(userRef, { credits: newTotal });
    return newTotal;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { essay, studentId, taskId, studentLevel, classId, submissionId, nama: providedName } = req.body;

  if (!studentId) {
    return res.status(400).json({ success: false, message: "ID Pelajar tidak dikesan." });
  }

  try {
    // 1. Fetch Data
    const [userSnap, taskSnap] = await Promise.all([
      db.collection('users').doc(studentId).get(),
      taskId ? db.collection('assignments').doc(taskId).get() : Promise.resolve({ exists: false })
    ]);

    const userData = userSnap.exists ? userSnap.data() : {};
    const effectiveName = userData.name || providedName || "Pelajar";
    const effectiveLevel = userData.level || studentLevel || 'P4';
    const taskData = taskSnap.exists ? taskSnap.data() : { title: 'Misi Karangan' };
    const config = LEVEL_SETTINGS[effectiveLevel] || LEVEL_SETTINGS['P4'];

    // 2. AI ANALYSIS
    const analysis = await analyseKarangan({
      nama: effectiveName,
      studentContent: [essay],
      level: effectiveLevel,
      stimulus: taskData.imageUrl || null
    });

    // 3. PREPARE PAYLOAD
    const isiMark = Number(analysis.markahIsi || 0);
    const bahasaMark = Number(analysis.markahBahasa || 0);
    const totalMark = isiMark + bahasaMark;

    const finalPayload = {
      nama: effectiveName, // FIXED THIS
      level: effectiveLevel,
      classId: classId || "umum", 
      status: "murni_in_progress", 
      tajuk: taskData.title || analysis.tajuk || "Analisis Karangan",
      karanganAsal: essay,
      karanganUnderlined: analysis.karanganUnderlined || essay,
      markah: totalMark, 
      markahKeseluruhan: totalMark,
      ulasanKeseluruhan: analysis.ulasan?.keseluruhan || analysis.ulasan || "Tahniah!",
      ulasanIsi: analysis.ulasan?.isi || "",
      ulasanBahasa: analysis.ulasan?.bahasa || "",
      pemarkahan: {
        isi: isiMark,
        bahasa: bahasaMark,
        jumlah: totalMark,
        max: config.total
      },
      kesalahanBahasa: analysis.kesalahanBahasa || [],
      gayaBahasa: analysis.gayaBahasa || [],
      studentId,
      taskId: taskId || 'umum',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    // 4. SAVE TO FIRESTORE
    const resultsRef = db.collection('karanganResults');
    let docId;
    
    if (submissionId && submissionId !== "undefined") {
      await resultsRef.doc(submissionId).set(finalPayload, { merge: true });
      docId = submissionId;
    } else {
      const newDoc = await resultsRef.add(finalPayload);
      docId = newDoc.id;
    }

    // 5. DEDUCT CREDIT
    const remaining = await deductCredits(studentId, 1);

    return res.status(200).json({ 
      success: true, 
      id: docId,
      remainingCredits: remaining 
    });

  } catch (error) {
    console.error("Critical Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}