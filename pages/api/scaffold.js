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
    1. Berikan **sekurang-kurangnya 5 hingga 6 pilihan** bagi setiap kategori (Kata Nama, Kata Kerja, Kata Adjektif) yang **BETUL-BETUL BERKAITAN** dengan apa yang dilihat dalam gambar ${pictureIndex}.
    2. Sediakan campuran perkataan tunggal dan **frasa yang lebih panjang**.
    3. **ANALISIS WATAK DALAM GAMBAR SEBENAR (PENTING):**
       - Jika hanya ada seorang watak lelaki: Guna nama **Dani**.
       - Jika hanya ada seorang watak perempuan: Guna nama **Siti**.
       - Jika ada dua orang atau lebih (berkumpulan): Boleh guna **Dani**, **Siti**, dan **"kawan-kawannya"**.
    4. **TERJEMAHAN BAHASA INGGERIS:** Setiap elemen mestilah dalam bentuk objek JSON yang mengandungi perkataan/frasa Bahasa Melayu ("bm") dan terjemahan Bahasa Inggerisnya ("bi").
    5. JANGAN tiru contoh perkataan di bawah secara bulat-bulat; cipta perkataan baharu yang sesuai dengan gambar semasa.
    
    Berikan jawapan dalam format JSON tulen mengikut struktur bentuk ini tanpa sebarang teks tambahan:
    {
      "kataNama": [
        { "bm": "perkataan/frasa melayu berkaitan gambar", "bi": "english translation" }
      ],
      "kataKerja": [
        { "bm": "perkataan/frasa melayu berkaitan gambar", "bi": "english translation" }
      ],
      "kataAdjektif": [
        { "bm": "perkataan/frasa melayu berkaitan gambar", "bi": "english translation" }
      ]
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