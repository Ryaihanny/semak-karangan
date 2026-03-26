import { analyseKarangan } from '@/lib/analyseKarangan';
import admin, { db } from '@/lib/firebaseAdmin';

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
    if (currentCredits <= 0) throw new Error("Kredit tidak mencukupi"); 
    const newTotal = Math.max(0, currentCredits - amount);
    transaction.update(userRef, { credits: newTotal });
    return newTotal;
  });
}
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // 1. DATA EXTRACTION
  const { essay, studentId, taskId, studentLevel, classId, submissionId, nama: providedName } = req.body;

  if (!studentId || !essay) {
    return res.status(400).json({ success: false, message: "ID Pelajar atau karangan tidak dikesan." });
  }

  try {
    // 2. FETCH DATA (Added Error Catching for Firestore)
    let userSnap, taskSnap;
    try {
      [userSnap, taskSnap] = await Promise.all([
        db.collection('users').doc(studentId).get(),
        (taskId && taskId !== 'umum') ? db.collection('assignments').doc(taskId).get() : Promise.resolve({ exists: false })
      ]);
    } catch (dbErr) {
      console.error("Firestore Fetch Error:", dbErr);
      throw new Error("Gagal menyambung ke pangkalan data.");
    }

    const userData = userSnap.exists ? userSnap.data() : {};
    const effectiveName = providedName || userData.name || "Pelajar";
    const effectiveLevel = studentLevel || userData.level || 'P6'; // Default to P6 if missing
    const taskData = taskSnap.exists ? taskSnap.data() : { title: 'Misi Karangan' };
    const config = LEVEL_SETTINGS[effectiveLevel] || LEVEL_SETTINGS['P6'];

    // 3. AI ANALYSIS (Synced with bulk logic)
    const analysis = await analyseKarangan({
      nama: effectiveName,
      studentContent: [`Karangan murid: ${essay}`], // Wrapped exactly like bulk
      level: effectiveLevel,
      stimulus: taskData.imageUrl || taskData.attachmentUrl || null
    });

    // 4. PREPARE PAYLOAD
    const isiMark = Number(analysis.markahIsi || 0);
    const bahasaMark = Number(analysis.markahBahasa || 0);
    const totalMark = isiMark + bahasaMark;

    const finalPayload = {
      nama: effectiveName,
      level: effectiveLevel,
      classId: classId || "umum", 
      status: "completed",
      tajuk: taskData.title || "Analisis Karangan",
      karanganAsal: essay,
      karanganUnderlined: analysis.karanganUnderlined || essay,
      markah: totalMark, 
      markahKeseluruhan: totalMark,
      ulasanKeseluruhan: analysis.ulasan?.keseluruhan || "Tahniah!",
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

// 5. SAVE & DEDUCT
const resultsRef = db.collection('karanganResults');
let docId = submissionId && submissionId !== "undefined" ? submissionId : null;

const { isOverwrite } = req.body;

if (isOverwrite) {
  // Reset rewrite progress for the new version
  finalPayload.lastRewrite = ""; 
  finalPayload.solvedMissions = [];
  finalPayload.status = "completed"; // Reset from 'murni_completed' to fresh 'completed'

  const existing = await resultsRef
    .where('studentId', '==', studentId)
    .where('taskId', '==', taskId || 'umum')
    .limit(1)
    .get();

  if (!existing.empty) {
    docId = existing.docs[0].id;
    await resultsRef.doc(docId).set(finalPayload); 
  } else {
    const newDoc = await resultsRef.add(finalPayload);
    docId = newDoc.id;
  }
} else if (docId) {
  // Normal update/merge
  await resultsRef.doc(docId).set(finalPayload, { merge: true });
} else {
  // Brand new submission
  const newDoc = await resultsRef.add(finalPayload);
  docId = newDoc.id;
}
    // Try to deduct credits but don't crash if it fails (optional safety)
    let remaining = 0;
    try {
      remaining = await deductCredits(studentId, 1);
    } catch (creditErr) {
      console.error("Credit Deduction Failed:", creditErr);
    }

    return res.status(200).json({ 
      success: true, 
      id: docId,
      remainingCredits: remaining 
    });

  } catch (error) {
    console.error("API Route Error:", error);
    return res.status(500).json({ 
        success: false, 
        message: error.message || "Ralat pelayan." 
    });
  }
}