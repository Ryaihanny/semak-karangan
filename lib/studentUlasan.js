export function generateSmartUlasan(markahIsi, markahBahasa, peribahasaCount, kesalahanCount, isIncomplete = false, level = 'P6') {
  let ulasan = "";
  const isUpper = (level === 'P5' || level === 'P6');
  const maxIsi = isUpper ? 20 : 7;
  const maxBahasa = isUpper ? 20 : 8;
  const totalMarkah = markahIsi + markahBahasa;
  const maxTotal = isUpper ? 40 : 15;
  const percentage = (totalMarkah / maxTotal) * 100;

  // 1. Peringkat Pencapaian (The Teacher's Voice - Now Stricter)
  if (percentage >= 80) {
    ulasan = "Syabas! Karangan kamu sangat matang dan menunjukkan penguasaan bahasa yang tinggi. ";
  } else if (percentage >= 50) {
    ulasan = "Usaha yang baik! Kamu mempunyai asas penulisan yang kukuh, namun masih ada ruang untuk penambahbaikan yang ketara. ";
  } else if (percentage >= 40) {
    ulasan = "Pencapaian kamu di tahap sederhana. Kamu perlu lebih serius dalam memperbaiki mutu penulisan agar mencapai tahap lulus yang lebih baik. ";
  } else {
    ulasan = "Pencapaian kamu sangat lemah. Kamu perlu banyak berlatih dan merujuk kamus serta buku tatabahasa untuk memperbaiki asas penulisan. ";
  }

  // 2. Maklum Balas ISI (Focus on Depth & Elaboration)
  if (isIncomplete) {
    ulasan += "Sayangnya, karangan kamu nampaknya tergantung. Dalam peperiksaan sebenar, ketiadaan penutup akan menjejaskan markah Isi secara drastik. ";
  } else {
    const isiRatio = markahIsi / maxIsi;
    if (isiRatio >= 0.8) {
      ulasan += "Penyampaian idea kamu sangat jelas, tersusun, dan mempunyai kedalaman huraian yang matang. ";
    } else if (isiRatio >= 0.6) {
      ulasan += "Isi kamu mencukupi, tetapi huraiannya boleh dipelbagaikan lagi dengan teknik peluasan idea (elaboration) supaya tidak nampak mendatar. ";
    } else if (isiRatio >= 0.4) {
      ulasan += "Huraian isi kamu agak ringkas (touch-and-go). Kamu perlu menghuraikan aksi gambar dengan lebih mendalam dan menyelitkan dialog watak. ";
    } else {
      ulasan += "Isi karangan terlalu nipis dan gagal menunjukkan kematangan idea. Kamu wajib memanjangkan setiap perenggan dengan huraian perasaan dan situasi watak. ";
    }
  }

  // 3. Maklum Balas BAHASA & PERIBAHASA (The Gatekeeper Voice)
  if (peribahasaCount > 0) {
    ulasan += `Cikgu bangga kamu menggunakan ${peribahasaCount} peribahasa yang tepat. Ini membantu meningkatkan gred bahasa kamu. `;
  } else if (isUpper && markahBahasa >= 14) {
    ulasan += "Untuk mencapai markah cemerlang (15-20), kamu wajib menyelitkan sekurang-kurangnya satu peribahasa yang sesuai. ";
  }

  // 4. Teguran Kesalahan (The "Correction" Voice - Stricter on Bahasa Pasar)
  const bahasaRatio = markahBahasa / maxBahasa;
  
  // Teguran khusus untuk Bahasa Pasar (Jika markah rendah atau kesalahan banyak)
  if (bahasaRatio < 0.5) {
    ulasan += "AMARAN: Mutu bahasa kamu sangat terjejas kerana penggunaan 'Bahasa Pasar' (singkatan/slang) yang keterlaluan. Sila gunakan bahasa Melayu formal sepenuhnya dan elakkan singkatan seperti 'nak', 'tak', dan 'org'. ";
  } else if (kesalahanCount > 10) {
    ulasan += "Struktur ayat kamu lemah kerana banyak kesalahan imbuhan dan ejaan. Kamu perlu menyemak semula setiap ayat supaya lebih gramatis. ";
  } else if (kesalahanCount <= 3 && percentage >= 70) {
    ulasan += "Penguasaan tatabahasa kamu sangat membanggakan. Teruskan ketelitian ini! ";
  } else {
    ulasan += "Pastikan setiap kata kerja menggunakan imbuhan yang tepat (meN-, ber-, di-) agar ayat tidak kedengaran seperti bahasa perbualan. ";
  }

  return ulasan;
}