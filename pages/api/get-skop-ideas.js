import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  const { title, instructions, imageUrl } = req.body;
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const prompt = `
      Tugas: Berikan idea membina ayat menggunakan kaedah SKOP (Subjek, Kata Kerja, Objek, Peluasan).
      Tajuk: ${title}
      Arahan: ${instructions}
      
      Sila teliti gambar yang dilampirkan. Berikan pilihan yang benar-benar ada dalam gambar tersebut.
      Format JSON sahaja:
      {
        "options": {
          "S": ["..."],
          "K": ["..."],
          "O": ["..."],
          "P": ["..."]
        }
      }
      Syarat: Bahasa Melayu, tahap sekolah rendah, 5 pilihan setiap satu.
    `;

    let parts = [{ text: prompt }];

    // PROSES GAMBAR
    if (imageUrl) {
      try {
        const imageResp = await fetch(imageUrl);
        if (!imageResp.ok) throw new Error("Gagal download gambar");
        
        const buffer = await imageResp.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString("base64");
        const mimeType = imageResp.headers.get("content-type") || "image/jpeg";

        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
      } catch (imgErr) {
        console.error("Akses gambar gagal:", imgErr);
        // Jika gambar gagal, AI akan teruskan guna teks sahaja (fallback)
      }
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = response.text();
    
    // Membersihkan simbol markdown ```json ... ```
    const cleanJson = text.replace(/```json|```/g, "").trim();
    const parsedData = JSON.parse(cleanJson);

    res.status(200).json(parsedData);

  } catch (error) {
    console.error("Ralat API SKOP:", error);
    res.status(500).json({ error: "Gagal menjana idea SKOP" });
  }
}