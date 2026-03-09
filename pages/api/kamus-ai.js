import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  // 1. Sekat method selain POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method tidak dibenarkan" });
  }

  const { perkataan } = req.body;
  
  if (!perkataan) {
    return res.status(400).json({ error: "Tiada perkataan yang diberikan" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
      You are a concise Dictionary for Singapore Primary School students learning Malay.
      User input (word or phrase): "${perkataan}"
      
      If the word is valid, provide:
      - Maksud: [Simple Malay definition]
      - English: [Equivalent]
      - Contoh: [One simple Malay sentence]

      If the input is gibberish or not a word, reply: "Maaf, perkataan tidak ditemui dalam pangkalan data kami."

      RULES: Strictly no conversational filler. Keep under 50 words. Use Malay Baku.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // 2. Membersihkan simbol markdown (seperti *** atau ##) jika Gemini terbiasa menggunakannya
    const cleanText = text.replace(/[*#]/g, '').trim();
    
    res.status(200).json({ maksud: cleanText });
  } catch (error) {
    console.error("Kamus API Error:", error);
    res.status(500).json({ error: "Gagal memproses kamus. Sila cuba sebentar lagi." });
  }
}