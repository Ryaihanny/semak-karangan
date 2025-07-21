// ... (your imports remain the same)
import { OpenAI } from 'openai';
import { imbuhanRules } from '@/lib/imbuhanRules';
import { detectGayaBahasa, containsValidPeribahasa } from '@/lib/gayaBahasa';
import { isiRubric56 } from '@/lib/isiRubric56';
import { bahasaRubric56 } from '@/lib/bahasaRubric56';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function calculateIsiMarkah(rawScore, wordCount) {
  if (wordCount < 150 && rawScore > 12) {
    rawScore = 12;
  }
  for (const item of isiRubric56) {
    if (rawScore >= item.minScore && rawScore <= item.maxScore) {
      return item.markah ?? rawScore;
    }
  }
  return rawScore;
}

function calculateBahasaMarkah(kesalahanCount, wordCount) {
  const kesalahanMengganggu = kesalahanCount >= wordCount * 0.5;
  if (kesalahanMengganggu) {
    for (const item of bahasaRubric56) {
      if (item.maxKesalahan >= kesalahanCount && item.maxMarkah <= 12) {
        return item.maxMarkah;
      }
    }
    return 12;
  } else {
    for (const item of bahasaRubric56) {
      if (item.maxKesalahan >= kesalahanCount) {
        return item.maxMarkah;
      }
    }
  }
  return 20;
}

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, function (m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[m];
  });
}

function generateUnderlinedKarangan(karangan, kesalahanBahasa) {
  let escapedKarangan = escapeHtml(karangan);
  kesalahanBahasa.forEach(({ ayatSalah }) => {
    if (!ayatSalah) return;
    const escapedMistake = ayatSalah.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedMistake, 'gi');
    escapedKarangan = escapedKarangan.replace(
      regex,
      match =>
        `<u style="text-decoration-color:red; text-decoration-thickness: 2px;">${match}</u>`
    );
  });
  escapedKarangan = escapedKarangan.replace(/\n/g, '<br/>');
  return escapedKarangan;
}

function countGayaBahasaUsedInSentence(karangan, gayaList) {
  const sentences = karangan.split(/[.!?。؟\n]/).map(s => s.trim());
  let count = 0;
  gayaList.forEach(gb => {
    const matched = sentences.some(s => s.includes(gb));
    if (matched) count++;
  });
  return count;
}

export default async function handler(req, res) {
  try {
    const { nama, karangan, pictureDescription, pictureUrl } = req.body;

    let markahIsiRaw = 0;
    let markahBahasa = 0;
    let markahIsi = 0;
    let kesalahanBahasa = [];
    let imbuhanSalah = [];
    let gayaBahasa = [];
    let ulasan = {};
    let finalPictureDescription = '';

    const wordCount = karangan.trim().split(/\s+/).length;

    // ✅ Deskripsi gambar
    if (pictureDescription && pictureDescription.trim()) {
      finalPictureDescription = pictureDescription.trim();
    } else if (pictureUrl && pictureUrl.trim()) {
      try {
        const picDescResponse = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'user',
              content: `Sila berikan deskripsi ringkas dalam Bahasa Melayu untuk gambar ini: ${pictureUrl}`,
            },
          ],
        });
        finalPictureDescription = picDescResponse.choices[0].message.content.trim();
      } catch (err) {
        finalPictureDescription = 'Tiada deskripsi gambar.';
        console.warn('Gagal jana deskripsi gambar:', err.message);
      }
    } else {
      finalPictureDescription = 'Tiada deskripsi gambar.';
    }

    // ✅ Markah Isi
    const isiResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: `Berdasarkan gambar berikut:  ${finalPictureDescription}  
Sila berikan skor markah antara 0 hingga 20 bagi kandungan karangan berikut, berdasarkan sejauh mana isi mencukupi dan relevan. Skor sahaja tanpa ulasan.  
Peraturan: - Jika jumlah perkataan kurang daripada 150, markah maksimum isi ialah 12. - Jika jumlah perkataan melebihi 150 dan cerita lengkap, markah tidak boleh kurang daripada 9.  
Karangan: ${karangan}`,
        },
      ],
    });

    markahIsiRaw = parseInt(isiResponse.choices[0].message.content);
    if (isNaN(markahIsiRaw)) markahIsiRaw = 0;
    markahIsi = calculateIsiMarkah(markahIsiRaw, wordCount);

    // ✅ Tambahan: markah Isi tidak boleh 10+ jika kurang 180 perkataan
    if (wordCount < 180 && markahIsi >= 10) {
      markahIsi = 9;
    }

    // ✅ Kesalahan Bahasa
    const bahasaResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: `Tugas anda ialah menyemak karangan di bawah dan mengesan semua kesalahan bahasa. Senaraikan dalam format JSON seperti berikut, tanpa penerangan tambahan:

[
  {
    "ayatSalah": "Ayat salah di sini.",
    "kategori": "ejaan/struktur ayat/imbuhan/tanda baca",
    "cadangan": "Ayat yang betul.",
    "penjelasan": "Sebab kesalahan dan cadangan pembetulan."
  }
]

- Gunakan Bahasa Melayu Standard Singapura dan rujukan Dewan Bahasa dan Pustaka.
- Jika lebih 50% ayat mengandungi kesalahan mengganggu kefahaman, markah Bahasa tidak melebihi 12.

Karangan: ${karangan}`,
        },
      ],
    });

    try {
      kesalahanBahasa = JSON.parse(bahasaResponse.choices[0].message.content);
    } catch (e) {
      console.warn('❌ JSON parse error for kesalahanBahasa:', e.message);
      console.log('🔍 Kandungan asal:', bahasaResponse.choices[0].message.content);
      kesalahanBahasa = [];
    }

    // ✅ Kesalahan Imbuhan
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

    // ✅ Gabungan kesalahan + tapis peribahasa sah
    kesalahanBahasa = [...kesalahanBahasa, ...imbuhanSalah].filter(({ ayatSalah }) => {
      if (!ayatSalah) return false;
      return !containsValidPeribahasa(ayatSalah);
    });

    const totalKesalahan = kesalahanBahasa.length;

    // ✅ Markah Bahasa berdasarkan jumlah kesalahan
    markahBahasa = calculateBahasaMarkah(totalKesalahan, wordCount);

    // ✅ CAP markah Bahasa berdasarkan markah Isi
    markahIsi = Number(markahIsi);
    markahBahasa = Number(markahBahasa);

    if (markahIsi <= 8 && markahBahasa > 8) {
      markahBahasa = 8;
    } else if (markahIsi <= 12 && markahBahasa > 16) {
      markahBahasa = 16;
    }

// ✅ Generate keseluruhan ulasan ringkas
const ulasanKeseluruhan = generateUlasan(markahIsi, markahBahasa); // ✅ NEW


    // ✅ Gaya Bahasa
    gayaBahasa = detectGayaBahasa(karangan);

    // ✅ BONUS jika gaya bahasa digunakan dalam ayat penuh (min 2)
    const gayaDalamAyat = countGayaBahasaUsedInSentence(karangan, gayaBahasa);
    if (gayaDalamAyat >= 2 && markahBahasa < 20) {
      markahBahasa += 1;
      if (markahBahasa > 20) markahBahasa = 20;
    }

    // ✅ Ulasan kekuatan
    const ulasanResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: `Beri satu perenggan tentang KEKUATAN sahaja dalam karangan ini. Jangan nyatakan kelemahan. Gunakan Bahasa Melayu baku dan piawai Singapura.

Karangan: ${karangan}`,
        },
      ],
    });

    ulasan = { kekuatan: ulasanResponse.choices[0].message.content.trim() };

    const karanganUnderlined = generateUnderlinedKarangan(karangan, kesalahanBahasa);

    console.log('✅ Penilaian manual selesai:', {
      nama,
      markahIsi,
      markahBahasa,
      markahKeseluruhan: markahIsi + markahBahasa,
      totalKesalahan,
      gayaBahasaCount: gayaBahasa.length,
      gayaDalamAyat,
    });

    res.status(200).json({
      nama,
      karangan,
      karanganUnderlined,
      pictureDescription: finalPictureDescription,
      markahIsi: Math.round(markahIsi),
      markahBahasa: Math.round(markahBahasa),
      markahKeseluruhan: Math.round(markahIsi + markahBahasa),
      kesalahanBahasa,
      gayaBahasa,
      ulasan : {
  kekuatan: ulasanResponse.choices[0].message.content.trim(),
  keseluruhan: ulasanKeseluruhan, // ✅ NEW
},

    });
  } catch (error) {
    console.error('❌ SEMAK API ERROR:', error);
    res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
}
