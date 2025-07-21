// lib/gayaBahasa.js

const peribahasaList = [
  // Darjah 3 & 4
  "ambil berat", "anak angkat", "anak emas", "bawa nasib", "berat sebelah",
  "besar hati", "buah tangan", "buruk siku", "cakar ayam", "campur tangan",
  "cari jalan", "fasih lidah", "hidung tinggi", "jalan tengah", "kaki ayam",
  "kaki bangku", "kecil hati", "keras kepala", "lepas tangan", "lurus akal",
  "manis mulut", "mati akal", "muka tembok", "murah hati", "rendah hati",
  "ringan mulut", "ringan tulang", "tajam akal", "tanda mata", "otak udang",

  // Darjah 5 & 6
  "air dicencang tiada putus", "bagai aur dengan tebing", "bagai dakwat dengan kertas",
  "bagai isi dengan kuku", "bagai menghitung bulu kambing", "bagai tikus membaiki labu",
  "baik budi", "banting tulang", "berani mati", "buang yang keruh ambil yang jernih",
  "cubit paha kanan paha kiri terasa juga", "diam-diam ubi",
  "hendak seribu daya tak hendak seribu dalih", "kata putus", "langkah seribu",
  "lapang dada", "makan suap", "panjang akal", "perah otak", "putih hati",
  "seperti anjing dengan kucing", "seperti garam jatuh di air",
  "seperti kacang lupakan kulit", "seperti katak di bawah tempurung",
  "seperti langit dengan bumi", "seperti lipas kudung", "tahan hati",
  "tangan kosong", "tangan terbuka", "tulang belakang",

  // Tambahan BM Lanjutan
  "ayam tambatan", "buka pintu", "tanam budi", "tumbuk rusuk",
  "bagai cembul dengan tutup", "bagai lebah menghimpun madu",
  "seperti air dalam kolam", "seperti ikan pulang ke lubuk",
  "seperti menatang minyak yang penuh",
  "umpama minyak setitik di laut sekalipun timbul jua"
];

export function detectGayaBahasa(text) {
  const result = [];
  const lowerText = text.toLowerCase();

  // Peribahasa
  for (const p of peribahasaList) {
    if (lowerText.includes(p)) {
      result.push(`Peribahasa: "${p}"`);
    }
  }

  // Simile
  const simileMatches = text.match(/\b(seperti|bagai|umpama|laksana|ibarat)\s[^.,!?]{1,40}/gi);
  if (simileMatches) {
    simileMatches.forEach(match => result.push(`Simile: ${match.trim()}`));
  }

  // Personifikasi
  const personifikasiMatches = text.match(/\b(bintang|matahari|bulan|angin|hujan|laut|pokok|awan|pelangi|mentari)\s+(menari|menangis|berkata|memeluk|tersenyum|merajuk|berbisik|berjalan)\b/gi);
  if (personifikasiMatches) {
    personifikasiMatches.forEach(match => result.push(`Personifikasi: ${match.trim()}`));
  }

  // Metafora
  const metaforaMatches = text.match(/\b(jiwa\s\w+|hati\s\w+|api\s+kemarahan|ombak\s+gelora|badai\s+hidup|mahkota\s+negara|permata\s\w+|bintang\s\w+)\b/gi);
  if (metaforaMatches) {
    metaforaMatches.forEach(match => result.push(`Metafora: ${match.trim()}`));
  }

  // Hiperbola
  const hiperbolaMatches = text.match(/\b(beribu-ribu|beratus-ratus|amat\s+\w+|sangat\s+\w+|teramat\s+\w+|sebanyak\s+bintang|setinggi\s+langit)\b/gi);
  if (hiperbolaMatches) {
    hiperbolaMatches.forEach(match => result.push(`Hiperbola: ${match.trim()}`));
  }

  return result;
}

// NEW: Check if text contains a real known peribahasa
export function containsValidPeribahasa(text) {
  const lowerText = text.toLowerCase();
  return peribahasaList.some((p) => lowerText.includes(p));
}
