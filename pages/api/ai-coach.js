import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // UPDATED: Added instructions and taskTitle to destructuring
  const { currentDraft, level, instructions, taskTitle } = req.body;

  if (!currentDraft) {
    return res.status(400).json({ error: "Draft kosong" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // UPDATED: Prompt now includes Bahasa Baku rule and Task Context

const prompt = `
      You are 'Cikgu AI', a friendly Malay Language Writing Coach for Primary School students (Ages 9-12) in Singapore. 
      Level: ${level}. 
      
      STRICT RULES:
      1. Use "BAHASA MELAYU BAKU" (Standard Malay used in Singapore schools).
      2. Tone: Enthusiastic and encouraging (Gaya penyayang seorang guru). Use "Kamu" for the student.
      3. Style: Simple, natural, and avoid wordy/redundant sentences (Avoid structures like "berseri-seri sambil tersenyum lebar").
      4. Length: Keep it under 100 words. Use emojis.

      CONTEXT:
      - Tajuk: "${taskTitle}"
      - Arahan: "${instructions}"
      
      STUDENT'S DRAFT:
      "${currentDraft}"

      YOUR TASK (Respond in Malay):
      1. ✨ **Saranan 'Tunjukkan, Bukan Beritahu' (Show, Don't Tell)**: Ambil satu ayat biasa murid dan jadikan ia lebih menarik. Pastikan ayat itu mengalir (flow) secara semula jadi.
      2. 📚 **Frasa Menarik**: Cadangkan 2 kosa kata atau peribahasa yang "hebat" untuk tahap sekolah rendah di Singapura.
      3. 🚀 **Misi Seterusnya**: Berikan satu soalan pendek untuk bantu murid kembangkan plot cerita mereka.

      Start with: "Bagus usaha kamu!" or "Wah, menarik idea ini!".
    `;

// ... bahagian bawah sama ...

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    res.status(200).json({ suggestion: text });
  } catch (error) {
    console.error("Gemini Coach Error:", error);
    res.status(500).json({ error: "Gagal mendapat respon AI" });
  }
}