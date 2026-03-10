import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  const { title, instructions, imageUrl, currentEssay } = req.body;
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const prompt = `
      Anda adalah pakar membina ayat menggunakan kaedah SKOP (Subjek, Kata Kerja, Objek, Peluasan) untuk sekolah rendah.
      Tugas: Berikan 5 pilihan bagi setiap kategori SKOP berdasarkan gambar tugasan: "${title}".
      
      Sila ikut peraturan ketat ini:
      1. S (Subjek): 
         - PENTING: Jika dalam teks karangan sedia ada ini: "${currentEssay || ''}", murid sudah mula menggunakan nama watak tertentu (contohnya: Ali), utamakan nama tersebut dalam pilihan "S".
         - Jika tiada nama spesifik dikesan dalam karangan, ikut peraturan ini:
            - Jika watak lelaki dalam gambar, gunakan "Amir".
            - Jika watak perempuan, gunakan "Ana".
            - Jika lebih 2 watak, gunakan nama Melayu lain (Ali, Siti, Bapa, Ibu, Cikgu).
         - Sertakan juga pilihan kata ganti nama: "Mereka", "Dia".
      
      2. K (Kata Kerja):
         - Lihat gambar yang dilampirkan (biasanya ada 1 hingga 6 aktiviti).
         - Kenalpasti perbuatan spesifik yang sedang berlaku dalam gambar.
      
      3. O (Objek):
         - Lengkapkan objek yang logik dan relevan berdasarkan perbuatan (K) dan situasi dalam gambar.
      
      4. P (Peluasan):
         - Berikan peluasan ayat yang sesuai untuk tahap sekolah rendah (contoh: menggunakan kata hubung "supaya", "kerana", "dengan", "untuk").

      HANTAR JAWAPAN DALAM FORMAT JSON SAHAJA:
      {
        "options": {
          "S": ["Nama/Watak"],
          "K": ["Perbuatan"],
          "O": ["Benda/Penerima"],
          "P": ["Keterangan"]
        }
      }
    `;

    let parts = [{ text: prompt }];

    // PROSES GAMBAR DARI FIREBASE
    if (imageUrl) {
      try {
        const imageResp = await fetch(imageUrl);
        if (!imageResp.ok) throw new Error("Gagal fetch gambar");
        const buffer = await imageResp.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString("base64");
        
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: "image/jpeg"
          }
        });
      } catch (e) {
        console.error("Gagal proses gambar dalam API:", e);
      }
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    let text = response.text();
    
    // Ekstrak JSON daripada respon AI
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      res.status(200).json(JSON.parse(jsonMatch[0]));
    } else {
      throw new Error("AI tidak memulangkan format JSON yang sah");
    }

  } catch (error) {
    console.error("Ralat API SKOP:", error);
    res.status(500).json({ error: "Gagal menjana idea SKOP" });
  }
}