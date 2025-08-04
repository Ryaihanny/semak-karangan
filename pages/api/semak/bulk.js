import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { ImageAnnotatorClient as BulkVisionClient } from '@google-cloud/vision';
import { analyseKarangan } from '@/lib/analyseKarangan';
import admin from 'firebase-admin';
import { generateUlasan } from '@/lib/analyseKarangan'; // ✅ NEW

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(process.cwd(), 'google-credentials.json');

// ✅ Inisialisasi Firebase jika belum ada
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const bulkVisionClient = new BulkVisionClient();
export const config = { api: { bodyParser: false } };

// ✅ Simpan hasil analisis ke Firestore (ID: set_id)
async function saveResultToFirestore(set, id, data, uid) {
  if (!id || !data.nama) {
    console.warn('⚠️ Skipping Firestore save — invalid ID or missing nama:', id, data.nama);
    return;
  }

  const docId = `${set}_${id}`; // 🔑 Unique doc ID per set
  const docRef = db.collection('karanganResults').doc(docId);
  await docRef.set({
    ...data,
uid,  // ✅ Save user's UID
    id: docId,
    timestamp: new Date().toISOString(),
  });
}

// === NEW: Deduct credits helper ===
async function deductCredits(userId, deductions) {
  console.log('🧪 UserID from request:', userId);

  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  console.log('📄 userDoc.exists?', userDoc.exists);
  if (!userDoc.exists) {
    throw new Error('User not found for credit deduction');
  }

  const userData = userDoc.data();
  console.log('📦 userDoc data:', userData);

  const currentCredits = userData?.credits ?? 0;
  console.log('🔢 currentCredits:', currentCredits);
  console.log('💸 credits needed:', deductions);

  if (currentCredits < deductions) {
    console.log(`🚫 Not enough credits: Have ${currentCredits}, need ${deductions}`);
    throw new Error('Insufficient credits');
  }

  await userRef.update({
    credits: currentCredits - deductions,
  });

  console.log(`✅ Deducted ${deductions} credits, remaining: ${currentCredits - deductions}`);
}


// ✅ Main handler
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, use POST' });
  }

  const form = formidable({ multiples: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('❌ Form parse error:', err);
      return res.status(500).json({ error: 'Failed to parse form data' });
    }

    try {
      const allPupils = JSON.parse(fields.pupils || '[]');
const pupils = allPupils.filter(p => p.checked); // ✅ Only process checked pupils

const idToken = req.headers.authorization?.split('Bearer ')[1];
if (!idToken) {
  return res.status(401).json({ error: 'Unauthorized: No token provided' });
}

let uid;
try {
  const decoded = await admin.auth().verifyIdToken(idToken);
  uid = decoded.uid;
} catch (tokenError) {
  console.error('❌ Token verification failed:', tokenError.message);
  return res.status(401).json({ error: 'Invalid or expired token' });
}

      console.log('📥 Pupils received:', pupils);

      // Calculate total credits needed:
      let totalCreditsNeeded = 0;
      for (const pupil of pupils) {
        if (pupil.mode === 'manual') totalCreditsNeeded += 1;
        else if (pupil.mode === 'ocr') totalCreditsNeeded += 2;
      }

      // Deduct credits before processing:

console.log('👥 Pupils to process:', pupils.length);
console.log('📊 Credit balance before deduction:', currentCredits);
console.log('🧮 Total credits needed:', totalCreditsNeeded);

      try {
        await deductCredits(uid, totalCreditsNeeded);
        console.log(`🪙 Deducted ${totalCreditsNeeded} credits from user ${uid}`);
      } catch (creditError) {
        console.error('❌ Credit deduction failed:', creditError.message);
        return res.status(403).json({ error: 'Kredit tidak mencukupi untuk melakukan semakan ini.' });
      }

      const results = [];

      for (const pupil of pupils) {
        const { id, nama, set, karangan, mode, pictureDescription, pictureUrl } = pupil;

        if (!nama) {
          results.push({ id, error: 'Nama pelajar diperlukan.' });
          continue;
        }

        if (mode === 'manual') {
          if (!karangan?.trim()) {
            results.push({ id, error: 'Karangan kosong untuk mod manual.' });
            continue;
          }

          try {
            console.log('🚀 Memulakan analisis karangan untuk:', nama);
            const analysis = await analyseKarangan({
              nama,
              set,
              karangan,
              pictureDescription,
              pictureUrl,
            });

            console.log('✅ Analisis selesai untuk', nama, 'Isi:', analysis.markahIsi, 'Bahasa:', analysis.markahBahasa);

await saveResultToFirestore(set, id, {
  nama,
  set,
  karangan,
  ...analysis,
}, uid); // ✅ uid is passed as a separate 4th argument



            results.push({ id, ...analysis });
          } catch (e) {
            console.error('❌ Manual analysis error:', e);
            results.push({ id, error: 'Ralat semasa analisis manual.' });
          }
        } else if (mode === 'ocr') {
         const fileItems = files[`file_${id}`];

if (!fileItems) {
  results.push({ id, error: 'Fail OCR tidak dijumpai.' });
  continue;
}

const filesArray = Array.isArray(fileItems) ? fileItems.slice(0, 5) : [fileItems];


          try {
            let combinedText = '';

            for (const file of filesArray) {
              const filepath = file.filepath || file.path;
              if (!filepath) continue;

              const fileBuffer = fs.readFileSync(filepath);
              const [visionResult] = await bulkVisionClient.textDetection({
                image: { content: fileBuffer },
              });

              const extractedText = visionResult?.textAnnotations?.[0]?.description || '';
              combinedText += extractedText + '\n\n';
            }

            if (!combinedText.trim()) {
              results.push({ id, error: 'Tiada teks dijumpai dari fail OCR.' });
              continue;
            }

            const analysis = await analyseKarangan({
              nama,
              set,
              karangan: combinedText,
              pictureDescription,
              pictureUrl,
            });

            // ✅ Tambah ulasan keseluruhan ringkas
            const ulasanKeseluruhan = generateUlasan(analysis.markahIsi, analysis.markahBahasa);
            analysis.ulasan.keseluruhan = ulasanKeseluruhan;

            await saveResultToFirestore(set, id, {
              nama,
              set,
              karangan: combinedText,
              ...analysis,
}, uid);
        

            results.push({ id, ...analysis });
          } catch (e) {
            console.error(`❌ OCR analysis error for pupil ${nama} (${id}):`, e);
            results.push({ id, error: 'Ralat semasa analisis OCR.', detail: e.message });
          }
        } else {
          results.push({ id, error: 'Mod tidak sah.' });
        }
      }

      res.status(200).json({ results });
    } catch (e) {
      console.error('❌ Bulk handler error:', e);
      res.status(500).json({ error: 'Ralat pelayan semasa pemprosesan bulk.', detail: e.message });
    }
  });
}
