import { GoogleGenerativeAI } from "@google/generative-ai";
import { imbuhanRules } from './imbuhanRules'; 
import { detectGayaBahasa, containsValidPeribahasa } from './gayaBahasa';
import { generateSmartUlasan } from './studentUlasan';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const LEVEL_SETTINGS = {
  'P3': { maxIsi: 7,  maxBahasa: 8,  total: 15, pics: 4 },
  'P4': { maxIsi: 7,  maxBahasa: 8,  total: 15, pics: 4 },
  'P5': { maxIsi: 20, maxBahasa: 20, total: 40, pics: 6 },
  'P6': { maxIsi: 20, maxBahasa: 20, total: 40, pics: 6 },
};

export async function analyseKarangan({
  nama = '', studentContent = [], level = 'P6', stimulus = null
}) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const config = LEVEL_SETTINGS[level] || LEVEL_SETTINGS['P6'];

  const prompt = `Anda adalah Guru Pakar Bahasa Melayu Sekolah Rendah di Singapura (Pemeriksa PSLE yang tegas). 
  
  TUGAS UTAMA:
  1. ANALISIS STIMULUS: Lihat gambar stimulus atau huraian situasi. Kenalpasti perincian aksi, emosi watak, dan latar.
  2. SEMAK KEDALAMAN (EXPANSION): Adakah murid menghuraikan "Isi Tersirat" (apa yang dirasa/difikir/dibualkan) atau sekadar menceritakan apa yang nampak (Touch-and-go)?

  PANDUAN PEMARKAHAN PSLE (SANGAT KETAT):

  1. ANALISIS ISI (0-20 markah):
     - CEMERLANG (18-20): Huraian sangat matang. Ada penggunaan teknik "Show, Don't Tell" (cth: jantung berdegup kencang, peluh membasahi dahi). 
     - BAIK (13-17): Cerita lengkap dan relevan, tetapi huraian emosi atau dialog kurang mendalam.
     - SEDERHANA/TOUCH-AND-GO (9-12): SEPERTI KARANGAN ALI. Cerita lengkap tapi sangat pendek (ringkas). Murid hanya menyebut aksi dasar (cth: "Ali tendang bola. Bola jatuh jalan. Pemandu marah."). JANGAN beri lebih 12 markah jika karangan ringkas.
     - LEMAH (0-8): Karangan tidak tamat, terpesong dari tajuk, atau terlalu sedikit huraian (di bawah 80 patah perkataan untuk P5/P6).

  2. ANALISIS BAHASA (0-20 markah):
     - SYARAT MINIMA (10-12): Bahasa boleh difahami walaupun ada kesalahan ejaan/imbuhan.
     - PENALTI BAHASA PASAR: Jika ada penggunaan "org, nak, tak, tu, dorang, kitorang, jugak", markah BAHASA TIDAK BOLEH melebihi 11/20. Ini dianggap tidak formal dan sangat lemah.
     - STRUKTUR AYAT: Utamakan Ayat Majmuk. Jika hanya menggunakan Ayat Tunggal yang berulang-ulang (Ali... Ali... Ali...), markah capped pada 13/20.
     - KOSA KATA: Beri markah 16 ke atas jika ada Peribahasa yang TEPAT dan kosa kata darjah tinggi (cth: 'terpinga-pinga', 'insaf', 'berwaspada').

  ARAHAN OUTPUT JSON (WAJIB):
  {
    "transcription": "Teks asal tanpa pindaan",
    "markahIsiRaw": 0-20,
    "markahBahasaRaw": 0-20,
    "analisisStimulus": "Jelaskan aksi kunci dalam stimulus yang anda gunakan untuk menyemak relevansi.",
    "isIncomplete": boolean,
    "isUnbalanced": boolean,
"kesalahanBahasa": [
  {
    "ayatSalah": "...",
    "pembetulan": "Sila tulis semula SELURUH AYAT LENGKAP yang telah dibetulkan di sini.",
    "kategori": "Ejaan / Tatabahasa / Bahasa Pasar / Tanda Baca",
    "penjelasan": "Kenapa salah? (cth: Gunakan bahasa formal 'hendak' bukan 'nak')"
  }
],
    "peribahasaDikesan": [],
    "ulasanIsi": "Nyatakan dengan jujur jika karangan terlalu ringkas atau touch-and-go.",
    "ulasanBahasa": "Sebutkan kesalahan bahasa pasar jika ada."
  }

  *PERINGATAN: Jadilah pemeriksa yang realistik. Karangan yang pendek dan menggunakan bahasa harian tidak layak mendapat gred A (15+).*`;

  try {
    const formattedParts = [
      { text: prompt },
      // Send Teacher's Image if exists
      stimulus?.startsWith('http') 
        ? { inlineData: { data: await fetchImageAsBase64(stimulus), mimeType: "image/jpeg" } }
        : { text: `Stimulus Soalan (Situasi/Gambar): ${stimulus || "Tiada stimulus disediakan."}` },
      ...studentContent.map(item => typeof item === 'string' ? { text: item } : item)
    ];

    const result = await model.generateContent({
      contents: [{ role: "user", parts: formattedParts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
    });

    const aiData = JSON.parse(result.response.text());
    let finalKarangan = aiData.transcription || (typeof studentContent[0] === 'string' ? studentContent[0] : "");

    const wordCount = finalKarangan.trim().split(/\s+/).filter(Boolean).length;
    
    // 1. Ambil data asal daripada AI (Hanya isytihar SEKALI di sini)
    const combinedKesalahan = aiData.kesalahanBahasa || [];
    const peribahasaFound = aiData.peribahasaDikesan || [];
    let rawIsi = aiData.markahIsiRaw || 10;
    let rawBahasa = aiData.markahBahasaRaw || 10;

    // 2. LOGIK KELENGKAPAN CERITA (Baseline anda)
    if (aiData.isIncomplete) {
      rawIsi = Math.min(rawIsi, 4); // Gagal jika tergantung
    } else {
      // Jika cerita LENGKAP, kita bagi baseline minimum 9
      // (Supaya usaha mereka habiskan cerita dihargai)
      rawIsi = Math.max(9, rawIsi); 
    }

    // 3. LOGIK SILING PERKATAAN (Peraturan Baru)
    // Ini akan override baseline tadi jika perkataan tidak cukup
    if (level === 'P5' || level === 'P6') {
      if (wordCount < 80) {
        rawIsi = Math.min(rawIsi, 4); 
      } else if (wordCount < 100) {
        rawIsi = Math.min(rawIsi, 8); 
      } else if (wordCount < 150) {
        rawIsi = Math.min(rawIsi, 12); 
      }
    }

    // 4. SCALING LOGIC (P3/P4: /7 & /8)
    let finalIsi, finalBahasa;
    if (level === 'P3' || level === 'P4') {
      finalIsi = (rawIsi / 20) * config.maxIsi;
      finalBahasa = (rawBahasa / 20) * config.maxBahasa;
    } else {
      finalIsi = rawIsi;
      finalBahasa = rawBahasa;
    }

    const markahIsiFinal = Math.round(finalIsi);
    const markahBahasaFinal = Math.round(finalBahasa);

    return {
      nama, level,
      karangan: finalKarangan,
      analisisStimulus: aiData.analisisStimulus,
      isTergantung: aiData.isIncomplete || false,
      karanganUnderlined: generateUnderlinedKarangan(finalKarangan, combinedKesalahan),
      markahIsi: markahIsiFinal,
      markahBahasa: markahBahasaFinal,
      markahKeseluruhan: markahIsiFinal + markahBahasaFinal,
      maxPossible: config.total,
      kesalahanBahasa: combinedKesalahan,
      gayaBahasa: peribahasaFound,
      ulasan: {
        isi: aiData.ulasanIsi || "",
        bahasa: aiData.ulasanBahasa || "",
        keseluruhan: generateSmartUlasan(
          markahIsiFinal, 
          markahBahasaFinal, 
          peribahasaFound.length, 
          combinedKesalahan.length, 
          aiData.isIncomplete || false, 
          level,
          wordCount
        )
      },
    };
  } catch (err) {
    console.error("Critical AI Error:", err);
    throw new Error(`Gagal memproses analisis: ${err.message}`);
  }
}

async function fetchImageAsBase64(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

function generateUnderlinedKarangan(karangan, kesalahanBahasa) {
  if (!karangan) return "";
  let escaped = karangan.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  const sorted = [...kesalahanBahasa].sort((a, b) => b.ayatSalah.length - a.ayatSalah.length);
  sorted.forEach(({ ayatSalah }) => {
    const safe = String(ayatSalah).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safe})(?![^<]*</u>)`, 'gi');
    escaped = escaped.replace(regex, `<u style="text-decoration-color:#ff7675; text-decoration-thickness:2px;">$1</u>`);
  });
  return escaped.replace(/\n/g, '<br/>');
}
export const generateUlasan = analyseKarangan;