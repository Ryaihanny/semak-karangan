// lib/imbuhanRules.js

export const imbuhanRules = [
  // --- DBP: SUPERLATIF (TER) ---
  {
    pattern: '\\bterlebih\\s+baik\\b',
    suggestion: 'terbaik',
    explanation: 'Menurut Tatabahasa Dewan, "terbaik" sudah membawa maksud paling baik. Elakkan penggunaan lewah "terlebih".'
  },
  {
    pattern: '\\bpaling\\s+terbaik\\b',
    suggestion: 'terbaik / paling baik',
    explanation: 'Penggunaan "paling" dan "ter-" secara serentak adalah lewah. Pilih salah satu.'
  },

  // --- DBP: IMBUHAN PINJAMAN & BAKU ---
  {
    pattern: '\\bmenginformasikan\\b',
    suggestion: 'memaklumkan / memberitahu',
    explanation: 'Kata "informasi" adalah kata pinjaman. Dalam bahasa Melayu baku DBP, gunakan "memaklumkan".'
  },
  {
    pattern: '\\bmengertikan\\b',
    suggestion: 'memahami / memberikan pengertian',
    explanation: '"Mengertikan" tidak wujud dalam sistem imbuhan DBP. Gunakan "memahami".'
  },

  // --- DBP: MEMPER...I vs MEMPER...KAN ---
  {
    pattern: '\\bmemperbaikkan\\b',
    suggestion: 'memperbaiki',
    explanation: 'Hukum DBP: Kata kerja "baik" menerima imbuhan "memper- -i". Akhiran "-kan" adalah salah.'
  },
  {
    pattern: '\\bmemperolehi\\b',
    suggestion: 'memperoleh',
    explanation: 'Kesalahan lazim: Kata dasar "oleh" hanya menerima awalan "memper-". Akhiran "-i" tidak diperlukan.'
  },
  {
    pattern: '\\bmemperolehkan\\b',
    suggestion: 'memperoleh',
    explanation: 'Akhiran "-kan" tidak perlu bagi kata kerja "memperoleh".'
  },
  {
    pattern: '\\bmemperbesarkan\\b',
    suggestion: 'memperbesar / membesarkan',
    explanation: 'DBP menyatakan jika kata dasar adalah Kata Adjektif (besar), jangan gunakan "memper-" dan "-kan" serentak.'
  },

  // --- DBP: TRANSITIF & LENGKAP ---
  {
    pattern: '\\bmengguna\\b',
    suggestion: 'menggunakan',
    explanation: 'Kata kerja transitif mesti mempunyai imbuhan yang lengkap (awalan "me-" dan akhiran "-kan").'
  },
  {
    pattern: '\\bmenolongkan\\b',
    suggestion: 'menolong',
    explanation: 'Kata kerja "tolong" tidak memerlukan akhiran "-kan" untuk membawa maksud membantu.'
  },

  // --- DBP: PENGGUNAAN "DI" ---
  {
    pattern: '\\bdi\\s+perbuat\\b',
    suggestion: 'diperbuat',
    explanation: 'Imbuhan "di-" sebagai awalan kata kerja pasif mesti ditulis rapat.'
  },
  {
    pattern: '\\bdiperbuatkan\\b',
    suggestion: 'diperbuat',
    explanation: 'Kata kerja "diperbuat" tidak memerlukan akhiran "-kan".'
  },

  // --- DBP: EJAAN AWALAN (Morfologi / Keluluhan) ---
  {
    pattern: '\\bpemgiraan\\b',
    suggestion: 'pengiraan',
    explanation: 'Hukum penyisipan DBP: Kata dasar "kira" bermula dengan huruf "k", maka awalan yang betul ialah "peng-".'
  },
  {
    pattern: '\\bmempastikan\\b',
    suggestion: 'memastikan',
    explanation: 'Hukum DBP: Huruf "p" pada awal kata dasar (pasti) harus luluh menjadi "m".'
  },
  {
    pattern: '\\bmempunyai\\b',
    suggestion: 'mempunyai',
    explanation: 'Kata dasar "punya" menerima awalan "mem-". Huruf "p" tidak luluh dalam kes terpencil ini menurut DBP.'
  },

  // --- DBP: KATA NAMA & TEMPAT ---
  {
    pattern: '\\bpedalaman\\b',
    suggestion: 'pedalaman',
    explanation: '"Pedalaman" bermaksud kawasan jauh di darat/pedesaan.'
  },
  {
    pattern: '\\bpendalaman\\b',
    suggestion: 'pendalaman',
    explanation: '"Pendalaman" merujuk kepada usaha mendalami sesuatu perkara atau mendalamkan sungai.'
  },

  // --- DBP: LEWAH & TIDAK FORMAL ---
  {
    pattern: '\\bbermaian\\b',
    suggestion: 'bermain',
    explanation: 'Kesalahan ejaan imbuhan. Kata dasar "main" menerima awalan "ber-".'
  },
  {
    pattern: '\\bterjatuhkan\\b',
    suggestion: 'terjatuh',
    explanation: 'Imbuhan "ter-" sudah membawa maksud tidak sengaja, tidak perlu akhiran "-kan".'
  }
];