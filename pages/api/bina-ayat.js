import { GoogleGenerativeAI, Type } from '@google/generative-ai';

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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Anda adalah Cikgu AI Bahasa Melayu yang penyayang untuk sekolah rendah.
    Murid memasukkan idea mentah ini: "${idea}".
    
    TUGASAN ANDA:
    1. Fahami maksud tersirat murid walaupun ada kesilapan ejaan (typo), tatabahasa rosak, atau jika mereka menaip sepenuhnya dalam Bahasa Inggeris/Manglish.
    2. Bina satu ayat tunggal/majmuk Bahasa Melayu yang betul, sangat gramatis, bersih, sesuai dengan Tahap Sekolah Rendah (${studentLevel || 'Umum'}).
    3. Cerai-cerai ayat lengkap tersebut menjadi beberapa blok perkataan/frasa ringkas (Wajib menghasilkan LEBIH daripada 2 blok, selalunya 4 hingga 7 blok kata kunci bergantung panjang ayat) supaya mereka boleh bermain game susun suai.
    4. Untuk setiap blok kepingan perkataan ("kataKunci"), berikan label bantuan terjemahan bahasa Inggeris di bawahnya supaya murid faham maknanya. Contoh: Jika perkataannya "Kucing itu", letakkan label "The cat (Subjek)". Jika "sedang mengejar", letakkan label "is chasing (Predikat)".`;

    // Enforce strict JSON structure via the SDK config schema to guarantee no conversational text breaks JSON.parse
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ayatPenuh: { type: Type.STRING },
            kataKunci: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  teks: { type: Type.STRING },
                  jenis: { type: Type.STRING },
                  label: { type: Type.STRING }
                },
                required: ["id", "teks", "jenis", "label"]
              }
            },
            susunanBetul: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
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