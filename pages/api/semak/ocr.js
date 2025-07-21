import formidable from 'formidable';
import fs from 'fs';
import { ImageAnnotatorClient } from '@google-cloud/vision';

export const config = {
  api: {
    bodyParser: false, // Required for formidable to parse files
  },
};

// Init Google Vision client
const visionClient = new ImageAnnotatorClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST method allowed' });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('❌ Form parse error:', err);
      return res.status(500).json({ error: 'Failed to parse form data' });
    }

    const file = files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Handle different versions of formidable
    const filePath = file.filepath || file.path || file[0]?.filepath || file[0]?.path;
    if (!filePath) {
      return res.status(400).json({ error: 'File path is missing' });
    }

    try {
      const fileBuffer = await fs.promises.readFile(filePath);

      const [result] = await visionClient.textDetection({ image: { content: fileBuffer } });
      const detections = result.textAnnotations;

      const extractedText = detections?.[0]?.description || '';

      res.status(200).json({
        text: extractedText, // ✅ renamed to match frontend expectation
        rawVisionResponse: result, // optional for debugging
      });
    } catch (error) {
      console.error('❌ Google Vision error:', error);
      res.status(500).json({ error: 'Google Vision OCR failed', detail: error.message });
    }
  });
}
