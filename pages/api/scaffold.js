import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // Pastikan ia adalah permintaan POST
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    const { pictureIndex, imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ status: 'error', message: 'URL gambar tidak dijumpai.' });
    }

    // Inisialisasi Gemini API menggunakan kunci pelayan
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 1. Muat turun imej dari URL supaya boleh dibaca oleh Gemini Vision
    const imageRes = await fetch(imageUrl);
    const arrayBuffer = await imageRes.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = imageRes.headers.get("content-type") || "image/jpeg";

    // 2. Sediakan arahan (prompt) khusus untuk fokus pada nombor gambar tertentu
    const prompt = `Anda ialah seorang guru Bahasa Melayu sekolah rendah di Singapura yang bijak. 
    Rujuk fail imej/PDF karangan berpandukan gambar ini. 
    Fokus HANYA pada petak nombor ${pictureIndex} sahaja (abaikan petak lain).
    
    Sila jana senarai kosa kata dan frasa yang kaya untuk murid lemah dengan syarat ketat berikut:
    1. Berikan **sekurang-kurangnya 5 hingga 6 pilihan** bagi setiap kategori (Kata Nama, Kata Kerja, Kata Adjektif).
    2. Sediakan campuran perkataan tunggal dan **frasa yang lebih panjang** (contoh: "mengulang kaji pelajaran di meja belajar").
    3. **ANALISIS WATAK DALAM GAMBAR SEBENAR (PENTING):**
       - **Jika hanya ada seorang watak lelaki:** Guna nama **Dani** (Jangan masukkan "kawan-kawannya" atau "Siti").
       - **Jika hanya ada seorang watak perempuan:** Guna nama **Siti** (Jangan masukkan "kawan-kawannya" atau "Dani").
       - **Jika ada dua orang atau lebih (berkumpulan):** Boleh guna **Dani**, **Siti**, dan **"kawan-kawannya"** atau "mereka".
    4. JANGAN guna perkataan umum yang malas seperti "budak-budak". Guna nama watak, kata ganti nama (dia, mereka), atau frasa spesifik.
    5. Berikan jawapan dalam format JSON tulen mengikut struktur ini tanpa sebarang teks tambahan:
    {
      "kataNama": ["frasa 1", "frasa 2", "frasa 3", "Dani/Siti", "frasa 5"],
      "kataKerja": ["frasa kerja 1", "frasa 2", "frasa 3", "frasa 4", "frasa 5"],
      "kataAdjektif": ["frasa adjektif 1", "frasa 2", "frasa 3", "frasa 4", "frasa 5"]
    }`;

    // 3. Hantar ke model Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        prompt
      ]
    });

    // ⚠️ PERHATIAN DI SINI: Guna `response.text` (bukan fungsi `response.text()`)
    const textOutput = response.text;
    
    // Cuba ekstrak JSON daripada respons AI (membersihkan sebarang tag markdown jika ada)
    let parsedData;
    try {
      const cleanJsonStr = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleanJsonStr);
    } catch (parseError) {
      // Fallback jika bentuk teks biasa
      parsedData = { rawText: textOutput };
    }

    return res.status(200).json({
      status: 'success',
      pictureIndex,
      data: parsedData
    });

  } catch (error) {
    console.error("Ralat Scaffold API:", error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
}