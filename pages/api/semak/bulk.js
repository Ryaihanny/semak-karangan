import formidable from 'formidable';
import fs from 'fs';
import sharp from 'sharp';
import admin, { db } from "../../../lib/firebaseAdmin";
import { analyseKarangan } from '@/lib/analyseKarangan';

// Next.js config to disable body parser for Formidable
export const config = { api: { bodyParser: false } };

const fileToGenerativePart = (buffer, mimeType) => ({
  inlineData: { data: buffer.toString("base64"), mimeType }
});

export default async function handler(req, res) {
  // 1. CORS & Headers (Exactly matching your Railway domain)
  const allowedOrigins = [
    'https://semakbijak.com',
    'https://www.semakbijak.com',
    'https://semak-karangan-production.up.railway.app'
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 2. Parse Multipart Form Data
  const form = formidable({ multiples: true });
  const { fields, files } = await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      resolve({ fields, files });
    });
  });

  try {
    // 3. Extract and Verify Auth
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) return res.status(401).json({ error: 'Unauthorized' });
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 4. Parse Pupils Data from Frontend
    const pupilsDataRaw = Array.isArray(fields.pupils) ? fields.pupils[0] : fields.pupils;
    const pupils = JSON.parse(pupilsDataRaw || '[]');
    
    const results = [];

    // 5. Process Question Image (Shared stimulus)
    let questionImagePart = null;
    const qFile = files.questionImage ? (Array.isArray(files.questionImage) ? files.questionImage[0] : files.questionImage) : null;
    if (qFile) {
      const qBuffer = await sharp(fs.readFileSync(qFile.filepath)).jpeg({ quality: 70 }).toBuffer();
      questionImagePart = fileToGenerativePart(qBuffer, "image/jpeg");
    }

    // 6. Process Individual Pupils
    for (const pupil of pupils) {
      const { id, nama, level, karangan, mode, pictureDescription } = pupil;
      
      try {
        let studentContent = [];

        // Add Stimulus (Image + Description)
        if (questionImagePart) {
          studentContent.push(questionImagePart);
          studentContent.push("Imej di atas adalah soalan/rangsangan karangan.");
        }
        if (pictureDescription) {
          studentContent.push(`Konteks soalan: ${pictureDescription}`);
        }

        // Add Essay Content
        if (mode === 'ocr') {
          const studentFiles = files[`file_${id}`]; // Matches frontend formData.append(`file_${p.id}`, file)
          if (!studentFiles) throw new Error("Tiada imej karangan disertakan.");
          
          const filesArray = Array.isArray(studentFiles) ? studentFiles : [studentFiles];
          for (const f of filesArray) {
            const sBuffer = await sharp(fs.readFileSync(f.filepath))
              .flatten({ background: '#ffffff' })
              .jpeg({ quality: 70 })
              .toBuffer();
            studentContent.push(fileToGenerativePart(sBuffer, "image/jpeg"));
          }
          studentContent.push("Sila transkripsi tulisan tangan ini dan semak karangannya.");
        } else {
          studentContent.push(`Teks Karangan Murid: ${karangan}`);
        }

        // 7. Call AI Analysis
        const analysis = await analyseKarangan({
          nama,
          level,
          studentContent,
          mode
        });

        results.push({ id, ...analysis });

      } catch (err) {
        console.error(`Error processing ${nama}:`, err);
        results.push({ id, error: 'Gagal menganalisis.', detail: err.message });
      }
    }

    // 8. Return formatted results to Frontend
    res.status(200).json({ results });

  } catch (e) {
    console.error("Bulk Handler Main Error:", e);
    res.status(500).json({ error: 'Ralat pelayan.', detail: e.message });
  }
}