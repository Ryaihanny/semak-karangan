import { OpenAI } from 'openai';
import { imbuhanRules } from './imbuhanRules';
import { detectGayaBahasa } from './gayabahasa';
import { isiRubric56 } from './isiRubric56';
import { bahasaRubric56 } from './bahasaRubric56';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;',
  })[m]);
}

// Underline detected kesalahan in karangan, highlight in red
function generateUnderlinedKarangan(karangan, kesalahanBahasa) {
  let escaped = escapeHtml(karangan);
  kesalahanBahasa.forEach(({ ayatSalah }) => {
    if (!ayatSalah) return;
    const safe = ayatSalah.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safe, 'gi');
    escaped = escaped.replace(
      regex,
      match => `<u style="text-decoration-color:red; text-decoration-thickness:2px;">${match}</u>`
    );
  });
  return escaped.replace(/\n/g, '<br/>');
}

// Adjust markah Isi based on word count and raw AI score, using rubric
function calculateIsiMarkah(raw, wordCount) {
  if (wordCount < 100 && raw > 10) raw = 10;
  else if (wordCount < 150 && raw > 12) raw = 12;
  else if (wordCount < 180 && raw > 15) raw = 15;

  for (const r of isiRubric56) {
    if (raw >= r.minScore && raw <= r.maxScore) {
      return r.markah ?? raw;
    }
  }
  return Math.max(1, raw);
}

// Calculate Bahasa markah based on kesalahan count, word count, gaya bahasa presence and karangan length
function calculateBahasaMarkah(kesalahan, wordCount, gayaBahasa, karangan) {
  const tooManyErrors = kesalahan >= wordCount * 0.5;
  let markah = 20;

  if (wordCount < 100) markah = Math.min(markah, 12);
  else if (wordCount < 150) markah = Math.min(markah, 16);
  if (tooManyErrors) markah = Math.min(markah, 12);
  else {
    for (const r of bahasaRubric56) {
      if (r.maxKesalahan >= kesalahan) {
        markah = Math.min(markah, r.maxMarkah);
        break;
      }
    }
  }

  // Penalize if no gaya bahasa or poor punctuation (no commas, semicolons, quotes)
  if (gayaBahasa.length === 0 || !karangan.match(/[,;:"']/)) {
    markah -= 2;
  }

  return Math.max(4, markah);
}

async function analyseKarangan({
  nama = '', karangan = '', pictureDescription = '',
  pictureUrl = '', set = ''
}) {
  if (!karangan?.trim()) throw new Error('Karangan diperlukan');

  // Get or generate picture description
  let finalPictureDescription = pictureDescription.trim();
  if (!finalPictureDescription && pictureUrl) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{
          role: 'user',
          content: `Berikan deskripsi ringkas dalam Bahasa Melayu Standard Singapura berdasarkan Dewan Bahasa dan Pustaka untuk gambar ini: ${pictureUrl}`
        }],
      });
      finalPictureDescription = response.choices[0].message.content.trim();
    } catch {
      finalPictureDescription = 'Tiada deskripsi gambar.';
    }
  } else if (!finalPictureDescription) {
    finalPictureDescription = 'Tiada deskripsi gambar.';
  }

  const wordCount = karangan.trim().split(/\s+/).length;

  // Dapatkan markah Isi mentah dari AI
  let markahIsiRaw = 0;
  try {
const isiRes = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{
    role: 'user',
    content: `Tugas anda ialah menilai *Markah Isi* (0–20) untuk karangan Bahasa Melayu murid sekolah rendah berdasarkan gambar atau soalan berikut:

${finalPictureDescription}

Guna penanda aras ini:
- 17–20: Isi lengkap, terperinci, sepenuhnya relevan, disusun dengan baik
- 13–16: Isi kebanyakannya relevan dan tersusun, tetapi kurang terperinci
- 9–12: Isi mencukupi tetapi ada isi tidak relevan atau tidak lengkap
- 5–8: Isi tidak mencukupi, ringkas, atau tidak berkembang
- 0–4: Tiada isi yang relevan atau sangat sedikit

Karangan:
${karangan}

Berikan hanya satu nombor antara 0 hingga 20. Balas dengan nombor sahaja, tanpa sebarang penjelasan atau ayat tambahan.`,
  }],
});

    markahIsiRaw = parseInt(isiRes.choices[0].message.content);
    if (isNaN(markahIsiRaw)) markahIsiRaw = 0;
  } catch {
    markahIsiRaw = 0;
  }

  const markahIsi = calculateIsiMarkah(markahIsiRaw, wordCount);

  // Dapatkan senarai kesalahan bahasa (AI)
  let kesalahanBahasa = [];
  try {
const res = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{
    role: 'user',
    content: `Tugas anda ialah mengenal pasti kesalahan bahasa dalam karangan Bahasa Melayu murid sekolah rendah (umur 11–12 tahun). 

Senaraikan satu kesalahan setiap baris, dalam format JSON:
[
  {
    "ayatSalah": "...",
    "kategori": "ejaan / imbuhan / struktur ayat / tanda baca / tatabahasa",
    "cadangan": "...",
    "penjelasan": "Bahasa mudah untuk murid 11–12 tahun."
  }
]

Karangan:
${karangan}

Gunakan Bahasa Melayu Standard Singapura. Nilai seperti guru sekolah rendah Singapura.`,
  }],
});
    kesalahanBahasa = JSON.parse(res.choices[0].message.content);
  } catch {
    kesalahanBahasa = [];
  }

  // Tambah kesalahan imbuhan (manual berdasarkan imbuhanRules)
  let imbuhanSalah = [];
  imbuhanRules.forEach(rule => {
    const regex = new RegExp(rule.pattern, 'gi');
    const matches = karangan.match(regex);
    if (matches) {
      matches.forEach(match => {
        imbuhanSalah.push({
          ayatSalah: match,
          kategori: 'imbuhan',
          cadangan: rule.suggestion,
          penjelasan: rule.explanation,
        });
      });
    }
  });

  kesalahanBahasa = [...kesalahanBahasa, ...imbuhanSalah];

  // Detect gaya bahasa
  const gayaBahasa = detectGayaBahasa(karangan);

  // Hitung markah Bahasa
  let markahBahasa = calculateBahasaMarkah(kesalahanBahasa.length, wordCount, gayaBahasa, karangan);

  // Adjustment to markah Bahasa agar tidak terlalu tinggi jika markah Isi rendah
  if (markahIsi <= 8 && markahBahasa > 8) markahBahasa = 8;
  else if (markahIsi <= 12 && markahBahasa > 16) markahBahasa = 16;

  // Underlined karangan with kesalahan
  const karanganUnderlined = generateUnderlinedKarangan(karangan, kesalahanBahasa);

  // Ulasan ISI
  let ulasanIsi = '';
  try {
    const isiUlasanRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'user',
        content: `Berdasarkan karangan berikut, berikan satu ulasan ISI sahaja. Nyatakan sama ada isi lengkap atau kurang lengkap berdasarkan gambar/soalan. Sertakan satu cadangan untuk menambah baik. Gunakan bahasa mudah untuk murid sekolah rendah.\n\nKarangan:\n${karangan}`,
      }],
    });
    ulasanIsi = isiUlasanRes.choices[0].message.content.trim();
  } catch {
    ulasanIsi = 'Tiada ulasan isi dijana.';
  }

  // Ulasan Bahasa
  let ulasanBahasa = '';
  try {
    const bahasaUlasanRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'user',
        content: `Beri satu ulasan ringkas untuk BAHASA karangan ini.\nNyatakan satu kekuatan dan satu cadangan penambahbaikan. Guna bahasa mudah untuk murid sekolah rendah.\n\nKarangan:\n${karangan}`,
      }],
    });
    ulasanBahasa = bahasaUlasanRes.choices[0].message.content.trim();
  } catch {
    ulasanBahasa = 'Tiada ulasan bahasa dijana.';
  }

  // Ulasan Keseluruhan (pendek dan jelas)
  let ulasanKeseluruhan = '';
  try {
    const keseluruhanRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'user',
        content: `Anda seorang guru Bahasa Melayu yang memberikan ulasan ringkas untuk murid sekolah rendah umur 11–12 tahun. Tulis dalam 2 ayat sahaja menggunakan Bahasa Melayu Standard Singapura, bukan gaya sastera dan tanpa kata ganti diri pertama. Ayat pertama berikan pujian ringkas (isi atau bahasa). Ayat kedua berikan cadangan mudah untuk tambah baik isi atau bahasa berdasarkan karangan murid.\n\nKarangan:\n${karangan}`,
      }],
    });
    ulasanKeseluruhan = keseluruhanRes.choices[0].message.content.trim();
  } catch {
    ulasanKeseluruhan = 'Teruskan berusaha menulis karangan yang lebih baik!';
  }

  return {
    nama,
    set,
    karangan,
    karanganUnderlined,
    pictureDescription: finalPictureDescription,
    markahIsi,
    markahBahasa,
    markahKeseluruhan: markahIsi + markahBahasa,
    kesalahanBahasa,
    gayaBahasa,
    ulasan: {
      isi: ulasanIsi,
      bahasa: ulasanBahasa,
      keseluruhan: ulasanKeseluruhan,
    },
  };
}

// Optional helper to generate combined ulasan kekuatan dan kelemahan (not necessarily used)
function generateUlasan(markahIsi, markahBahasa) {
  let kekuatan = '', kelemahan = '';

  if (markahIsi >= 17) kekuatan += 'Isi lengkap dan tepat. ';
  else if (markahIsi >= 13) kekuatan += 'Isi mencukupi. ';
  else kelemahan += 'Isi tidak cukup atau tidak berkaitan. ';

  if (markahBahasa >= 17) kekuatan += 'Bahasa sangat baik.';
  else if (markahBahasa >= 13) kekuatan += 'Bahasa baik tetapi ada kesalahan kecil.';
  else kelemahan += 'Terdapat banyak kesalahan bahasa.';

  return `Kekuatan: ${kekuatan.trim()} Kelemahan: ${kelemahan.trim()}`;
}

export { analyseKarangan, generateUlasan };
