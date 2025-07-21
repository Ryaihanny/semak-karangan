// lib/imbuhanRules.js

export const imbuhanRules = [
  {
    pattern: '\\bterlebih\\s+baik\\b',
    suggestion: 'terbaik',
    explanation: '“Terlebih baik” tidak betul; gunakan “terbaik” sahaja sebagai bentuk superlatif.'
  },
  {
    pattern: '\\bberikanlah\\b',
    suggestion: 'beri',
    explanation: '“Berikanlah” adalah ayat tidak formal, lebih sesuai gunakan “beri”.'
  },
  {
    pattern: '\\bterjadilah\\b',
    suggestion: 'terjadi',
    explanation: '“Terjadilah” adalah bentuk perintah, guna “terjadi” untuk pernyataan biasa.'
  },
  {
    pattern: '\\bmenyebutkan\\b',
    suggestion: 'menyebut',
    explanation: '“Menyebutkan” kurang tepat dalam konteks biasa; “menyebut” adalah lebih betul.'
  },
  {
    pattern: '\\bmempergunakan\\b',
    suggestion: 'menggunakan',
    explanation: '“Mempergunakan” kurang formal, lebih baik guna “menggunakan”.'
  },
  {
    pattern: '\\bmengertikan\\b',
    suggestion: 'maksudkan',
    explanation: '“Mengertikan” bukan imbuhan yang tepat, gunakan “maksudkan”.'
  },
  {
    pattern: '\\bmenginformasikan\\b',
    suggestion: 'memberitahu',
    explanation: '“Menginformasikan” kurang biasa dalam bahasa baku, gunakan “memberitahu”.'
  },
  {
    pattern: '\\bmengadakan\\b',
    suggestion: 'mengadakan',
    explanation: 'Pastikan imbuhan dan kata dasar tepat.'
  },
  {
    pattern: '\\bmemperolehkan\\b',
    suggestion: 'memperoleh',
    explanation: '“Memperolehkan” tidak betul; gunakan “memperoleh”.'
  },
  {
    pattern: '\\bmempergunakan\\b',
    suggestion: 'menggunakan',
    explanation: '“Mempergunakan” kurang tepat, gunakan “menggunakan”.'
  },

  // Versi tambahan untuk mengukuhkan pengesanan
  {
    pattern: '\\bmengguna\\b',
    suggestion: 'menggunakan',
    explanation: 'Imbuhan tidak lengkap. Kata kerja ini sepatutnya "menggunakan".'
  },
  {
    pattern: '\\bmenolongkan\\b',
    suggestion: 'menolong',
    explanation: 'Penggunaan imbuhan "-kan" tidak sesuai. Kata kerja ini sepatutnya "menolong".'
  },
  {
    pattern: '\\bmengajarkan\\b',
    suggestion: 'mengajar',
    explanation: 'Dalam konteks biasa, imbuhan "-kan" tidak perlu. Gunakan "mengajar".'
  },
  {
    pattern: '\\bbermaian\\b',
    suggestion: 'bermain',
    explanation: 'Kesalahan pembentukan imbuhan. "Bermaian" bukan kata kerja yang betul.'
  },
  {
    pattern: '\\bterjatuhkan\\b',
    suggestion: 'terjatuh',
    explanation: 'Imbuhan "-kan" tidak perlu dalam bentuk pasif ini. Gunakan "terjatuh".'
  },
  {
    pattern: '\\bdipersilakan\\b',
    suggestion: 'dipersilakan (jika sesuai konteks) atau dijemput',
    explanation: 'Pastikan konteks sesuai untuk penggunaan bentuk pasif ini.'
  },
  {
    pattern: '\\bmemperbaikkan\\b',
    suggestion: 'memperbaiki',
    explanation: 'Kata kerja ini telah membawa maksud memperbaiki. Tambahan "-kan" tidak perlu.'
  },
  {
    pattern: '\\bkeadaan\\s+yang\\s+tidak\\s+berkeadaan\\b',
    suggestion: 'keadaan yang tidak stabil',
    explanation: 'Penggunaan "berkeadaan" dalam konteks ini tidak tepat.'
  },
  {
    pattern: '\\bpemgiraan\\b',
    suggestion: 'pengiraan',
    explanation: 'Kesalahan ejaan imbuhan awalan "pem-". Gunakan "pengiraan".'
  },
  {
    pattern: '\\bdiperbuatkan\\b',
    suggestion: 'diperbuat',
    explanation: 'Penggunaan akhiran "-kan" adalah berlebihan. Gunakan "diperbuat".'
  }
];
