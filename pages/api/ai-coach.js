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
      1. Use "BAHASA MELAYU BAKU" only.
      2. Tone: Enthusiastic, supportive, and simple. Use "Kamu" for the student.
      3. Length: Keep the entire response short and scannable (under 120 words).
      4. Avoid complex jargon.

      CONTEXT:
      - Tajuk: "${taskTitle}"
      - Arahan: "${instructions}"
      
      STUDENT'S DRAFT:
      "${currentDraft}"

      YOUR TASK (Response must be in Malay):
      1. ✨ **Saranan 'Show, Don't Tell'**: Ambil satu ayat mudah murid dan tunjukkan cara jadikannya lebih "hidup". (Contoh: Daripada "Dia takut", tukar kepada "Jantungnya berdegup kencang").
      2. 📚 **Kosa Kata Hebat**: Berikan 2 perkataan atau peribahasa mudah yang relevan.
      3. 🚀 **Langkah Seterusnya**: Berikan satu soalan pendek untuk bantu mereka sambung cerita berdasarkan arahan guru.

      Start with a short praise like "Bagus usaha kamu!" or "Idea yang menarik!". Use emojis.
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