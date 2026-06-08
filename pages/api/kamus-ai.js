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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are an interactive bilingual dictionary tool for primary school students (Ages 9-12) in Singapore. Many users are English-dominant or non-Malay speakers.
      User input (word or phrase): "${perkataan}"
      
      Detect if the input is English or Malay. Translate or explain it so a student who struggles with Malay can easily understand.

      Return ONLY a JSON object matching this schema. Do not wrap it in markdown block tags like \`\`\`json:
      {
        "status": "success",
        "malayWord": "The primary translated Malay word or phrase",
        "englishWord": "The English equivalent",
        "maksud": "A simple child-friendly meaning or definition written in clear English so they instantly know what it means",
        "contohAyat": "One simple, high-scoring composition sentence in Malay Baku using the malayWord",
        "contohAyatEnglish": "The English translation of the contohAyat sentence",
        "bonusKosakata": ["Related high-scoring word or idiom 1 (with English in brackets)", "Related high-scoring word or idiom 2 (with English in brackets)"]
      }

      If the input is gibberish or inappropriate, return ONLY:
      {
        "status": "error",
        "message": "Alamak! Word not found. Try typing another word or check your spelling!"
      }

      RULES: Strictly no conversational filler. Keep text simple and concise. Use Malay Baku.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Safely parse JSON structure from the model
    const parsedJSON = JSON.parse(text);
    
    res.status(200).json(parsedJSON);
  } catch (error) {
    console.error("Kamus API Error:", error);
    res.status(500).json({ error: "Gagal memproses kamus. Sila cuba sebentar lagi." });
  }
}