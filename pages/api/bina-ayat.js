import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { idea, studentLevel, taskTitle, taskStimulus } = req.body;

    if (!idea) {
      return res.status(400).json({ message: 'Nama watak diperlukan' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Instructing AI to take the custom character name input (idea) and generate rich structural cards
    const prompt = `Anda adalah Cikgu AI Bahasa Melayu Sekolah Rendah.
    Murid memberikan nama watak / subjek fokus ini: "${idea}".
    Konteks tugasan: ${taskStimulus || 'Tiada'}
    
    TUGASAN ANDA:
    1. Bina satu ayat lengkap yang gramatis dan sangat bermutu tinggi untuk peringkat sekolah rendah (${studentLevel || 'Umum'}) bermula dengan atau berpusat pada subjek/watak "${idea}".
    2. Pisahkan ayat tersebut menjadi 4 hingga 7 kepingan blok perkataan/frasa ringkas ("kataKunci") supaya murid boleh menyusunnya semula.
    3. Untuk setiap kepingan kata kunci, berikan label terjemahan bahasa Inggeris berserta huraian pendek struktur tatabahasa (contoh: "Subject (Watak)", "Verb (Aktiviti)", "Object"). 
    Semua string nilai teks kepingan mestilah tepat dan mencakupi keseluruhan susunan ayat asal.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            ayatPenuh: { type: "string" },
            kataKunci: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  teks: { type: "string" },
                  jenis: { type: "string" },
                  label: { type: "string" }
                },
                required: ["id", "teks", "jenis", "label"]
              }
            },
            susunanBetul: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["ayatPenuh", "kataKunci", "susunanBetul"]
        }
      }
    });

    const responseText = result.response.text();
    const data = JSON.parse(responseText.trim());

    return res.status(200).json(data);
  } catch (error) {
    console.error("Bina Ayat API Error:", error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}