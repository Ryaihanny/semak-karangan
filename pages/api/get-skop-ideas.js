import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  // Terima imageUrl dari body
  const { title, instructions, imageUrl } = req.body;
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Berdasarkan tugasan karangan ini: "${title}. ${instructions}"
    ${imageUrl ? "Sila lihat gambar yang diberikan dan berikan idea SKOP yang tepat dengan aktiviti dalam gambar tersebut." : ""}
    Berikan senarai perkataan untuk kaedah SKOP (Subjek, Kata Kerja, Objek, Peluasan).
    Kembalikan HANYA objek JSON dengan struktur ini:
    {
      "options": {
        "S": ["Watak 1", "Watak 2"],
        "K": ["Kata kerja 1", "Kata kerja 2"],
        "O": ["Objek 1", "Objek 2"],
        "P": ["Peluasan 1", "Peluasan 2"]
      }
    }
    Keperluan: Tahap sekolah rendah, Bahasa Melayu, 5 item bagi setiap kategori.
  `;

  try {
    let parts = [{ text: prompt }];

    // Jika ada gambar, tukar URL kepada base64 dan masukkan ke dalam array parts
    if (imageUrl) {
      const imageResponse = await fetch(imageUrl);
      const arrayBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(arrayBuffer).toString("base64");
      
      parts.push({
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg", // Pastikan jenis mime sesuai (jpeg/png)
        },
      });
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    let text = response.text();
    
    // Pembersihan JSON yang lebih selamat
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    res.status(200).json(JSON.parse(text));
  } catch (error) {
    console.error("Error SKOP AI:", error);
    res.status(500).json({ error: "Gagal menjana idea SKOP" });
  }
}