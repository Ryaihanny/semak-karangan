export function generateSmartUlasan(markahIsi, markahBahasa, peribahasaCount, kesalahanCount, isIncomplete = false, level = 'P6', wordCount = 0) {
  let ulasan = "";
  const isUpper = (level === 'P5' || level === 'P6');
  const maxIsi = isUpper ? 20 : 7;
  const maxBahasa = isUpper ? 20 : 8;
  const totalMarkah = markahIsi + markahBahasa;
  const maxTotal = isUpper ? 40 : 15;
  const percentage = (totalMarkah / maxTotal) * 100;

  // 1. Peringkat Pencapaian (The Teacher's Voice)
  if (percentage >= 80) {
    ulasan = "Syabas! Karangan kamu sangat matang dan menunjukkan penguasaan bahasa yang tinggi. ";
  } else if (percentage >= 50) {
    ulasan = "Usaha yang baik! Kamu mempunyai asas penulisan yang kukuh, namun masih ada ruang untuk penambahbaikan yang ketara. ";
  } else if (percentage >= 40) {
    ulasan = "Pencapaian kamu di tahap sederhana. Kamu perlu lebih serius dalam memperbaiki mutu penulisan agar mencapai tahap lulus yang lebih baik. ";
  } else {
    ulasan = "Pencapaian kamu sangat lemah. Kamu perlu banyak berlatih dan merujuk kamus serta buku tatabahasa untuk memperbaiki asas penulisan. ";
  }

  // 2. Maklum Balas ISI & Word Count (The Strict Inspector)
  if (isIncomplete) {
    ulasan += "Sayangnya, karangan kamu nampaknya tergantung. Tanpa penutup yang jelas, markah Isi terpaksa dipotong secara drastik. ";
  } else {
    // Teguran khusus tentang panjang karangan untuk P5/P6
    if (isUpper && wordCount < 150) {
      ulasan += `Nota: Karangan kamu hanya ${wordCount} patah perkataan. Untuk P6, kamu perlu sekurang-kurangnya 150 patah perkataan untuk menghuraikan isi dengan mendalam. Ini sebabnya markah Isi kamu terhad. `;
    }

    const isiRatio = markahIsi / maxIsi;
    if (isiRatio >= 0.8) {
      ulasan += "Penyampaian idea kamu sangat jelas, tersusun, dan mempunyai kedalaman huraian yang matang. ";
    } else if (isiRatio >= 0.6) {
      ulasan += "Isi kamu mencukupi, tetapi huraiannya boleh dipelbagaikan lagi dengan teknik peluasan idea (elaboration). ";
    } else if (isiRatio >= 0.4) {
      ulasan += "Huraian isi kamu agak ringkas (touch-and-go). Kamu perlu menghuraikan aksi gambar dengan lebih mendalam dan menyelitkan dialog watak. ";
    } else {
      ulasan += "Isi karangan terlalu nipis. Kamu wajib memanjangkan perenggan dengan menghuraikan perasaan dan situasi watak dengan lebih terperinci. ";
    }
  }

  // 3. Maklum Balas BAHASA & PERIBAHASA
  if (peribahasaCount > 0) {
    ulasan += `Cikgu bangga kamu menggunakan ${peribahasaCount} peribahasa yang tepat. Ini sangat membantu meningkatkan gred bahasa kamu. `;
  } else if (isUpper && markahBahasa >= 14) {
    ulasan += "Untuk mencapai markah cemerlang (15 ke atas), kamu digalakkan menyelitkan sekurang-kurangnya satu peribahasa yang sesuai. ";
  }

  // 4. Teguran Kesalahan (Stricter on Bahasa Pasar)
  const bahasaRatio = markahBahasa / maxBahasa;
  
  if (bahasaRatio < 0.5) {
    ulasan += "AMARAN: Mutu bahasa kamu terjejas kerana penggunaan 'Bahasa Pasar' atau singkatan seperti 'nak', 'tak', dan 'org'. Sila gunakan bahasa Melayu formal sepenuhnya. ";
  } else if (kesalahanCount > (isUpper ? 8 : 4)) {
    ulasan += "Terdapat banyak kesalahan ejaan dan imbuhan. Pastikan kamu menyemak semula setiap ayat supaya lebih gramatis sebelum menghantar. ";
  } else if (kesalahanCount <= 2 && percentage >= 70) {
    ulasan += "Penguasaan tatabahasa kamu sangat memuaskan dan teliti! ";
  } else {
    ulasan += "Berhati-hati dengan penggunaan imbuhan kata kerja agar ayat kamu tidak kedengaran seperti bahasa perbualan harian. ";
  }

  return ulasan;
}