import formidable from 'formidable';
import fs from 'fs';
import sharp from 'sharp';
import admin, { db } from "../../../lib/firebaseAdmin";
import { analyseKarangan } from '@/lib/analyseKarangan';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const config = { api: { bodyParser: false } };

const fileToGenerativePart = (buffer, mimeType) => ({
  inlineData: { data: buffer.toString("base64"), mimeType }
});

async function saveResultToFirestore(data, uid, originalId) {
  if (!data.nama) return;
  const docRef = await db.collection('karanganResults').add({
    ...data,
    uid,  
    originalPupilId: originalId,
    timestamp: new Date().toISOString(),
  });
  console.log('✅ Saved to Firestore:', docRef.id);
}

// Fixed Credit Deduction: Now returns true/false to allow conditional deduction
async function deductCredits(userId, amount) {
  const userRef = db.collection('users').doc(userId);
  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) throw new Error('User not found');
    
    const currentCredits = Number(userDoc.data()?.credits ?? 0);
    if (currentCredits < amount) throw new Error('Insufficient credits');
    
    transaction.update(userRef, { credits: currentCredits - amount });
    return currentCredits - amount;
  });
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: true });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let fields, files;
  try {
    ({ fields, files } = await parseForm(req));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to parse form' });
  }

  try {
    const pupilsDataRaw = Array.isArray(fields.pupils) ? fields.pupils[0] : fields.pupils;
    const pupils = JSON.parse(pupilsDataRaw || '[]');
    const idToken = req.headers.authorization?.split('Bearer ')[1];

    if (!pupils.length) return res.status(400).json({ error: 'Tiada murid dipilih.' });
    if (!idToken) return res.status(401).json({ error: 'Unauthorized' });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // We calculate credits but DON'T deduct yet. 
    // We will deduct only for SUCCESSFUL items later.
    const results = [];
    let successfulDeductions = 0;

    // Get the Question Image
    let questionImagePart = null;
    const qFile = files.questionImage ? (Array.isArray(files.questionImage) ? files.questionImage[0] : files.questionImage) : null;
    if (qFile) {
      const qBuffer = await sharp(fs.readFileSync(qFile.filepath)).jpeg().toBuffer();
      questionImagePart = fileToGenerativePart(qBuffer, "image/jpeg");
    }

    for (const pupil of pupils) {
      const { id, nama, kelas, level, set, karangan, mode, pictureDescription } = pupil;
      
      try {
        let studentContent = [];

        // 1. ADD STIMULUS
        if (questionImagePart) {
          studentContent.push(questionImagePart);
          studentContent.push("Imej di atas adalah soalan/rangsangan karangan.");
        } 
        if (pictureDescription) {
          studentContent.push(`Konteks soalan: ${pictureDescription}`);
        }

        // 2. ADD STUDENT ESSAY
        if (mode === 'ocr') {
          const studentFiles = files[`file_${id}`];
          if (!studentFiles) throw new Error("Tiada imej karangan disertakan.");
          
          const filesArray = Array.isArray(studentFiles) ? studentFiles : [studentFiles];
          for (const f of filesArray) {
            const sBuffer = await sharp(fs.readFileSync(f.filepath)).flatten({ background: '#ffffff' }).jpeg().toBuffer();
            studentContent.push(fileToGenerativePart(sBuffer, "image/jpeg"));
          }
          studentContent.push("Sila transkripsi tulisan tangan ini dan semak karangannya.");
        } else {
          studentContent.push(`Karangan murid: ${karangan}`);
        }

        // 3. RUN ANALYSIS
        const analysis = await analyseKarangan({
          nama,
          level,
          studentContent,
          mode
        });

        // 4. SAVE & TRACK SUCCESS
        await saveResultToFirestore({
          nama: nama || 'Pelajar',
          kelas: kelas || '',
          level: level || 'P6',
          set: set || 'default',
          karangan: analysis.transcription || karangan,
          ...analysis,
        }, uid, id);

        results.push({ id, ...analysis });
        
        // Count credits to be deducted (1 for manual, 2 for OCR)
        successfulDeductions += (mode === 'ocr' ? 2 : 1);

      } catch (err) {
        console.error(`Error processing ${nama}:`, err);
        results.push({ id, error: 'Gagal menganalisis.', detail: err.message });
      }
    }

    // FINAL STEP: Deduct credits only for what actually worked
    if (successfulDeductions > 0) {
      await deductCredits(uid, successfulDeductions);
    }

    // Standardize results for frontend
    const safeResults = results.map((r) => {
      const original = pupils.find(p => String(p.id) === String(r.id)) || {};
      return {
        id: r.id,
        nama: original.nama,
        kelas: original.kelas,
        level: original.level,
        markahIsi: r.markahIsi ?? '-',
        markahBahasa: r.markahBahasa ?? '-',
        markahKeseluruhan: r.markahKeseluruhan ?? '-',
        karangan: r.transcription || original.karangan || '', // Return the new transcription!
        karanganUnderlined: r.karanganUnderlined ?? r.transcription ?? '',
        kesalahanBahasa: Array.isArray(r.kesalahanBahasa) ? r.kesalahanBahasa : [],
        ulasan: r.ulasan || { isi: '', bahasa: '', keseluruhan: '' },
        gayaBahasa: Array.isArray(r.gayaBahasa) ? r.gayaBahasa : [],
        error: r.error ?? null,
      };
    });

    res.status(200).json({ results: safeResults });

  } catch (e) {
    console.error("Bulk Handler Error:", e);
    res.status(500).json({ error: 'Ralat pelayan.', detail: e.message });
  }
}