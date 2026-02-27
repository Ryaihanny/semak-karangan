import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Next.js secara automatik parse JSON jika header Content-Type betul
  const { currentDraft, level } = req.body;

  if (!currentDraft) {
    return res.status(400).json({ error: "Draft kosong" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
      You are an expert Malay Language Writing Coach for Primary School students in Singapore (Level: ${level}).
      
      STUDENT'S CURRENT DRAFT:
      "${currentDraft}"

      YOUR TASK:
      1. DO NOT write the story for them.
      2. Analyze what they have written so far.
      3. Provide a response in MALAY with these 3 short sections:
         - ✨ **Saranan 'Show, Don't Tell'**: Pilih satu ayat biasa dalam draf mereka dan tukarkan menjadi ayat yang lebih deskriptif (pilih ayat yang ada emosi atau aksi).
         - 📚 **Kosa Kata Hebat**: Cadangkan 2 perkataan aras tinggi atau peribahasa yang sesuai dengan konteks cerita mereka.
         - 🚀 **Langkah Seterusnya**: Berikan satu soalan bimbingan untuk bantu mereka fikirkan apa yang patut berlaku dalam perenggan seterusnya.

      Keep the tone encouraging, simple, and friendly. Use emojis.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    res.status(200).json({ suggestion: text });
  } catch (error) {
    console.error("Gemini Coach Error:", error);
    res.status(500).json({ error: "Gagal mendapat respon AI" });
  }
}