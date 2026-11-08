import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  // 1. Sekat method selain POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method tidak dibenarkan" });
  }

  const { perkataan } = req.body;
  
  if (!perkataan) {
    return res.status(400).json({ error: "Tiada perkataan atau soalan yang diberikan" });
  }

  try {
    // Force Gemini to always respond with valid JSON without needing markdown hacks
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are an interactive, smart bilingual conversational dictionary tool for primary school students (Ages 9-12) in Singapore. Many users are English-dominant or non-Malay speakers.

      The user input can be a single word (e.g., "excited", "gembira") OR a conversational question/phrase (e.g., "how to say excited in malay?", "what is the meaning of terpinga-pinga?", "help me with standard phrases for happy").

      YOUR TASK:
      1. Extract the core concept, word, or phrase the student is asking about.
      2. Translate, explain, and extract it into the requested JSON schema below.
      
      User input: "${perkataan}"

      Return ONLY a JSON object matching this schema:
      {
        "status": "success",
        "malayWord": "The target translated Malay word or phrase extracted from the student's query",
        "englishWord": "The English equivalent of that target word/phrase",
        "maksud": "A simple, child-friendly explanation or conversational answer to their question, written in clear English so they instantly understand.",
        "contohAyat": "One simple, high-scoring composition sentence in Malay Baku using the malayWord",
        "contohAyatEnglish": "The English translation of the contohAyat sentence",
        "bonusKosakata": ["Related high-scoring word or idiom 1 (with English in brackets)", "Related high-scoring word or idiom 2 (with English in brackets)"]
      }

      If the input is complete gibberish or highly inappropriate, return exactly this structure:
      {
        "status": "error",
        "message": "Alamak! I couldn't understand that. Try typing a word or asking a question like 'how to say happy in Malay'!"
      }

      RULES: Be concise but highly helpful to a child struggling with Malay. Keep descriptions encouraging and easy to digest. Use Malay Baku. Do not wrap in markdown block tags.
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