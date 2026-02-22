import { analyseKarangan } from '@/lib/analyseKarangan';
import { db } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

// Constant settings to match your lib/analyseKarangan.js
const LEVEL_SETTINGS = {
  'P3': { maxIsi: 8,  maxBahasa: 7,  total: 15 },
  'P4': { maxIsi: 8,  maxBahasa: 7,  total: 15 },
  'P5': { maxIsi: 20, maxBahasa: 20, total: 40 },
  'P6': { maxIsi: 20, maxBahasa: 20, total: 40 },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // FIXED: Added submissionId to destructuring
  const { essay, studentId, taskId, studentLevel, classId, submissionId, nama: providedName } = req.body;

  try {
    /**
     * 1. ROBUST DATA FETCHING
     */
    // CHANGED: Fetch from 'users' collection to check credits (matching semakan.js logic)
    const [studentSnap, taskSnap, userSnap] = await Promise.all([
      studentId ? db.collection('students').doc(studentId).get() : Promise.resolve({ exists: false }),
      taskId ? db.collection('assignments').doc(taskId).get() : Promise.resolve({ exists: false }),
      studentId ? db.collection('users').doc(studentId).get() : Promise.resolve({ exists: false })
    ]);

    // --- CREDIT CHECK LOGIC ---
    if (userSnap.exists) {
      const userData = userSnap.data();
      const currentCredits = userData.credits ?? 0;
      // Safety check: Since frontend deducts first, balance should be >= 0
      if (currentCredits < 0) { 
        return res.status(403).json({ message: "Kredit tidak mencukupi. Sila hubungi cikgu." });
      }
    }

    // FALLBACKS: Fixed ReferenceError for 'nama'
    const studentData = studentSnap.exists ? studentSnap.data() : { level: studentLevel || 'P4', name: providedName || 'Pelajar' };
    const taskData = taskSnap.exists ? taskSnap.data() : { title: 'Misi Karangan', imageUrl: null };

    // FIXED: Renamed to effectiveLevel to avoid duplicate declaration error
    const effectiveLevel = studentData.level || studentLevel || 'P4';
    const stimulusImage = taskData.imageUrl || null;
    const config = LEVEL_SETTINGS[effectiveLevel] || LEVEL_SETTINGS['P4'];

    console.log(`Mission Control: Analyzing for ${studentData.name} (${effectiveLevel})`);

    /**
     * 2. AI ANALYSIS
     */
    const analysis = await analyseKarangan({
      nama: studentData.name || "Pelajar",
      studentContent: [essay],
      level: effectiveLevel,
      stimulus: stimulusImage 
    });

    /**
     * 3. DATA CLEANING (GAMIFIED PAYLOAD)
     */
    const isiMark = Number(analysis.markahIsi || 0);
    const bahasaMark = Number(analysis.markahBahasa || 0);
    const totalMark = isiMark + bahasaMark;

    const finalPayload = {
      nama: studentData.name || "Pelajar",
      level: effectiveLevel,
      classId: classId || "umum", 
      // CHANGED: Use 'murni_in_progress' so the dashboard knows it's ready for correction
      status: "murni_in_progress", 
      tajuk: taskData.title || analysis.tajuk || "Analisis Karangan",
      karanganAsal: essay,
      karanganUnderlined: analysis.karanganUnderlined || essay,
      
      markah: totalMark, 
      // ADDED: markahKeseluruhan to match dashboard.js
      markahKeseluruhan: totalMark,
      ulasan: analysis.ulasan?.keseluruhan || analysis.ulasan || "Tahniah!",
      
      pemarkahan: {
        isi: isiMark,
        bahasa: bahasaMark,
        jumlah: totalMark,
        max: config.total
      },

      ulasanKeseluruhan: analysis.ulasan?.keseluruhan || analysis.ulasan || "Tahniah!",
      ulasanIsi: analysis.ulasan?.isi || "",
      ulasanBahasa: analysis.ulasan?.bahasa || "",
      
      kesalahanBahasa: analysis.kesalahanBahasa || [],
      gayaBahasa: analysis.gayaBahasa || [],
      analisisStimulus: analysis.analisisStimulus || "Data stimulus disemak.",
      
      studentId,
      taskId, // This is essential for Class/track/[id].js to find the work
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      solvedMissions: [] 
    };

    /**
     * 4. FIRESTORE UPDATE & CREDIT DEDUCTION
     */
    const resultsRef = db.collection('karanganResults');
    let docId = submissionId; // Now correctly defined from req.body

    // Create a batch or use individual updates
    if (submissionId) {
      await resultsRef.doc(submissionId).set(finalPayload, { merge: true });
    } else {
      const newDoc = await resultsRef.add(finalPayload);
      docId = newDoc.id;
    }

    // --- DEDUCT CREDIT ---
    // DISABLED: Deducting here causes "Double Charging" because SemakanPage.js 
    // already deducts the credit before calling the API.
    /*
    if (studentId && userSnap.exists) {
      await db.collection('users').doc(studentId).update({
        credits: admin.firestore.FieldValue.increment(-1)
      });
    }
    */

    return res.status(200).json({ 
      success: true, 
      id: docId,
      marks: finalPayload.pemarkahan 
    });

  } catch (error) {
    console.error("Critical Submission Error:", error);
    return res.status(500).json({ error: error.message });
  }
}