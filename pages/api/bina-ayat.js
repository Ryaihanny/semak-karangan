import { GoogleGenerativeAI } from '@google/generative-ai'; // Error fix: changed GoogleGenAI to GoogleGenerativeAI

// Initialize using the correct legacy library class name
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { idea, studentLevel, taskTitle, taskStimulus } = req.body;

    if (!idea) {
      return res.status(400).json({ message: 'Idea is required' });
    }

    // Call using the correct model layout schema for @google/generative-ai
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = `Anda adalah Cikgu AI Bahasa Melayu. Berdasarkan idea mentah murid ini: "${idea}", bina satu ayat yang betul, gramatis, dan lengkap mengikut struktur (Subjek + Predikat). Sediakan output dalam format JSON tulen yang mengandungi struktur perkataan cerai untuk permainan susun ayat. 
    Tahap murid: ${studentLevel || 'Umum'}. 
    Tajuk: ${taskTitle || 'Tiada'}. 
    Konteks: ${taskStimulus || 'Tiada'}.

    Format JSON wajib mengikut skema ini secara tepat:
    {
      "ayatPenuh": "Ayat lengkap yang betul di sini",
      "kataKunci": [
        { "id": "w1", "teks": "Perkataan1", "jenis": "kata-nama", "label": "Subjek" },
        { "id": "w2", "teks": "Perkataan2", "jenis": "kata-kerja", "label": "Predikat" }
      ],
      "susunanBetul": ["w1", "w2"]
    }`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Clean up markdown block wraps if returned by the AI
    const cleanJson = responseText.replace(/```json|```/g, '').trim();
    const data = JSON.parse(cleanJson);

    return res.status(200).json(data);
  } catch (error) {
    console.error("Bina Ayat API Error:", error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}