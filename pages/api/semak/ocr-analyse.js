import formidable from 'formidable';
import fs from 'fs';
import { ImageAnnotatorClient as VisionClient } from '@google-cloud/vision';
import { analyseKarangan, generateUlasan } from '@/lib/analyseKarangan';

export const config = { api: { bodyParser: false } };

const visionClient = new VisionClient({
  projectId: process.env.GOOGLE_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed, use POST' });

  const form = formidable({ multiples: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Failed to parse form data', detail: err.message });

    try {
      const fileItems = files.file;
      if (!fileItems) return res.status(400).json({ error: 'No file uploaded' });

      const filesArray = Array.isArray(fileItems) ? fileItems.slice(0, 5) : [fileItems];

      let combinedText = '';
      for (const file of filesArray) {
        const filepath = file.filepath || file.path;
        if (!filepath) continue;

        const fileBuffer = fs.readFileSync(filepath);
        const [result] = await visionClient.textDetection({ image: { content: fileBuffer } });
        combinedText += result.textAnnotations?.[0]?.description || '';
      }

      const safeKarangan = combinedText || '';
      const safeNama = fields.nama || '';
      const safePictureDescription = fields.pictureDescription || '';
      const safePictureUrl = fields.pictureUrl || '';

      if (!safeKarangan.trim()) return res.status(400).json({ error: 'No text extracted from uploaded images.' });

      const analysis = await analyseKarangan({
        nama: safeNama,
        karangan: safeKarangan,
        pictureDescription: safePictureDescription,
        pictureUrl: safePictureUrl,
      });

      analysis.karanganUnderlined = safeKarangan;
      analysis.ulasan.keseluruhan = generateUlasan(analysis.markahIsi, analysis.markahBahasa);

      res.status(200).json(analysis);
    } catch (error) {
      console.error('❌ OCR + analyse error:', error);
      res.status(500).json({ error: 'OCR analysis failed', detail: error.message });
    }
  });
}
