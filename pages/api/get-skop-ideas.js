import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  const { title, instructions } = req.body;
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Based on this Malay essay task: "${title}. ${instructions}"
    Provide a list of words for the SKOP (Subjek, Kata Kerja, Objek, Peluasan) method.
    Return ONLY a JSON object with this structure:
    {
      "options": {
        "S": ["Watak 1", "Watak 2"],
        "K": ["Kata kerja 1", "Kata kerja 2"],
        "O": ["Objek 1", "Objek 2"],
        "P": ["Peluasan 1", "Peluasan 2"]
      }
    }
    Requirements: Primary school level, Malay language, 5 items per category.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().replace(/```json|```/g, ""); // Clean JSON markers
    res.status(200).json(JSON.parse(text));
  } catch (error) {
    res.status(500).json({ error: "Failed" });
  }
}