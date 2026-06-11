import { GoogleGenAI } from "@google/genai";

// Initialize your AI client (ensure your API key is in your .env file)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  // CORS & method guard rails
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // 1. DATA EXTRACTION (Matches what your front-end will send)
  const { idea, studentLevel, taskTitle, taskStimulus } = req.body;

  if (!idea || !idea.trim()) {
    return res.status(400).json({ success: false, message: 'Idea kasar murid diperlukan.' });
  }

  try {
    // 2. CONSTRUCT SYSTEM PROMPT WITH FIRESTORE SCHEMA FIELDS
    const systemPrompt = `
      Anda adalah pakar bahasa Melayu KPM (Pedagogi Terbeza). Tugas anda adalah membantu murid yang lemah membina ayat berdasarkan tugasan atau bahan rangsangan yang diberikan oleh guru mereka.

      KONTEKS TUGASAN DARIPADA FIREBASE (taskData):
      - Tajuk Tugasan (taskData.title): "${taskTitle || 'Umum / Tiada Tajuk'}"
      - Stimulus/Arahan Guru (taskData.stimulus): "${taskStimulus || 'Bina ayat bebas yang bersesuaian.'}"

      INPUT DARIPADA MURID:
      - Idea Kasar Murid: "${idea}"
      - Tahap Akademik Murid (studentLevel): "${studentLevel || 'P6'}"

      ARAHAN PEMPROSESAN AYAT:
      1. Rujuk Tajuk dan Stimulus Guru untuk memahami batasan tema tugasan.
      2. Ambil Idea Kasar murid, baiki kesalahan ejaan/tatabahasa, dan tingkatkan kualiti struktur sintaksisnya agar matang serta relevan secara langsung dengan tema tugasan guru. Jangan biarkan ayat lari daripada tema!
      3. Pecahkan ayat lengkap yang telah disempurnakan itu kepada minimum 3 dan maksimum 5 blok frasa (tokens) supaya murid boleh menyusun semula frasa tersebut seperti permainan puzzle/kata.
      4. Kelaskan setiap kelompok frasa kepada kategori ini SAHAJA: 'kata-nama', 'kata-kerja', atau 'kata-adjektif'.
      5. Berikan label ringkas yang menunjukkan peranan perkataan tersebut (Contoh: "Subjek 🧑‍🤝‍🧑", "Perbuatan 🧼", "Sifat/Keadaan ✨", "Keterangan/Penerang 📍").
      6. Sediakan susunan kunci ID yang betul di dalam array 'susunanBetul' (Contoh urutan: ["w1", "w2", "w3"]).

      FORMAT RESPONS (WAJIB JSON TULEN):
      Kembalikan respons dalam bentuk format JSON sahaja tanpa sebarang blok kod markdown (seperti \`\`\`json) atau teks luaran tambahan.

      {
        "tema": "Tema atau tajuk kecil ayat",
        "ayatPenuh": "Teks ayat lengkap gubahan baharu yang sudah disempurnakan",
        "kataKunci": [
          { "id": "w1", "teks": "Frasa Pertama", "jenis": "kata-nama", "label": "Subjek 🧑‍🤝‍🧑" },
          { "id": "w2", "teks": "Frasa Kedua", "jenis": "kata-kerja", "label": "Perbuatan 🧼" },
          { "id": "w3", "teks": "Frasa Ketiga", "jenis": "kata-adjektif", "label": "Sifat ✨" }
        ],
        "susunanBetul": ["w1", "w2", "w3"]
      }
    `;

    // 3. GENERATE DYNAMIC CONTENT WITH STRUCTURAL JSON ENFORCEMENT
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsedData = JSON.parse(response.text);
    
    return res.status(200).json(parsedData);

  } catch (error) {
    console.error("Ralat inside api/bina-ayat:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Gagal memproses dan memecah struktur ayat game.",
      details: error.message 
    });
  }
}