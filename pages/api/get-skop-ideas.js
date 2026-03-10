import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  const { title, instructions, imageUrl, currentEssay } = req.body;
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const prompt = `
      Anda adalah pakar kaedah SKOP (Subjek, Kata Kerja, Objek, Peluasan) Bahasa Melayu sekolah rendah.
      Tajuk: "${title}"
      Arahan: "${instructions}"
      
      PERATURAN WATAK (S):
      1. Jika murid sudah tulis nama dalam karangan ini: "${currentEssay || ''}", guna nama itu.
      2. Jika tiada, guna "Amir" untuk lelaki atau "Ana" untuk perempuan.
      3. Tambah pilihan "Mereka" atau "Dia".

      PERATURAN PERBUATAN (K, O, P):
      - Berikan perbuatan yang logik berdasarkan tajuk dan gambar yang diberikan.

      HANTAR JSON SAHAJA (TIADA TEKS LAIN):
      {
        "options": {
          "S": ["..."],
          "K": ["..."],
          "O": ["..."],
          "P": ["..."]
        }
      }
    `;

    let parts = [{ text: prompt }];

    // Cuba proses gambar, jika gagal AI tetap jalan guna teks
    if (imageUrl && imageUrl.startsWith('http')) {
      try {
        const imageResp = await fetch(imageUrl);
        if (imageResp.ok) {
          const buffer = await imageResp.arrayBuffer();
          const base64Data = Buffer.from(buffer).toString("base64");
          parts.push({
            inlineData: { data: base64Data, mimeType: "image/jpeg" }
          });
        }
      } catch (e) {
        console.log("Gambar disekat atau gagal: ", e.message);
      }
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    let text = response.text();
    
    // Pembersihan JSON yang lebih kuat
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}') + 1;
    if (start === -1 || end === 0) throw new Error("JSON tidak ditemui");
    
    const jsonStr = text.substring(start, end);
    res.status(200).json(JSON.parse(jsonStr));

  } catch (error) {
    console.error("Ralat SKOP:", error);
    res.status(500).json({ error: "Gagal", details: error.message });
  }
}