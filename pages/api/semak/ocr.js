import formidable from 'formidable';
import fs from 'fs';
import { ImageAnnotatorClient as OcrVisionClient } from '@google-cloud/vision';

export const config = { api: { bodyParser: false } };

const visionClient = new OcrVisionClient({
  projectId: process.env.GOOGLE_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST method allowed' });

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Failed to parse form data', detail: err.message });

    const file = files.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = file.filepath || file.path || file[0]?.filepath || file[0]?.path;
    if (!filePath) return res.status(400).json({ error: 'File path is missing' });

    try {
      const fileBuffer = await fs.promises.readFile(filePath);
      const [result] = await visionClient.textDetection({ image: { content: fileBuffer } });
      const extractedText = result.textAnnotations?.[0]?.description || '';

      res.status(200).json({
        text: extractedText || '', // always return a string
        rawVisionResponse: result || {},
      });
    } catch (error) {
      console.error('❌ OCR error:', error);
      res.status(500).json({ error: 'Google Vision OCR failed', detail: error.message });
    }
  });
}
