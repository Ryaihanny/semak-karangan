import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { generateUlasan } from '@/lib/analyseKarangan'; // ✅ NEW


export const config = {
  api: {
    bodyParser: false,
  },
};

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const visionClient = new ImageAnnotatorClient({ credentials });


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, use POST' });
  }

  const form = formidable({ multiples: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parse error:', err);
      return res.status(500).json({ error: 'Failed to parse form data' });
    }

    try {
      console.log('📥 OCR fields received:', fields);

      const fileItems = files.file;
      const filesArray = Array.isArray(fileItems) ? fileItems.slice(0, 5) : [fileItems];

      let combinedText = '';

      for (const file of filesArray) {
        const filepath = file.filepath || file.path;
        if (!filepath) continue;

        const fileBuffer = fs.readFileSync(filepath);
        const [result] = await visionClient.textDetection({ image: { content: fileBuffer } });
        const extractedText = result.textAnnotations?.[0]?.description || '';
        combinedText += extractedText + '\n\n';

        console.log('📄 Extracted OCR text chunk:', extractedText.substring(0, 100), '...');
      }

      if (!combinedText.trim()) {
        return res.status(400).json({ error: 'No text extracted from uploaded images.' });
      }

      const { analyseKarangan } = await import('../../../lib/analyseKarangan.js');
      const analysis = await analyseKarangan({
        nama: fields.nama || '',
        karangan: combinedText,
        pictureDescription: fields.pictureDescription ? String(fields.pictureDescription) : '',
        pictureUrl: fields.pictureUrl ? String(fields.pictureUrl) : '',
      });

// ✅ Tambah ulasan keseluruhan ringkas
const ulasanKeseluruhan = generateUlasan(analysis.markahIsi, analysis.markahBahasa);
analysis.ulasan.keseluruhan = ulasanKeseluruhan;


      res.status(200).json(analysis);
    } catch (error) {
      console.error('Google Vision error:', error);
      res.status(500).json({ error: 'Google Vision OCR failed', detail: error.message });
    }
  });
}
