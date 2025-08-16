import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { auth } from '../lib/firebase';  // path as appropriate

export default function Semak() {
const [creditBalance, setCreditBalance] = useState(null);
  const [pictureDescription, setPictureDescription] = useState('');
  const [pupils, setPupils] = useState([
    {
      id: 1,
      nama: '',
      karangan: '',
      mode: 'manual',
      ocrFiles: [],
      loading: false,
      result: null,
      error: null,
      checked: false,
      set: '',
    },
  ]);
  const [pdfLoading, setPdfLoading] = useState(false);
const [includeKarangan, setIncludeKarangan] = useState(true);

const fetchCredit = async (uid) => {
  const db = getFirestore();
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    setCreditBalance(data.credits ?? 0);
  } else {
    setCreditBalance(0);
  }
};

useEffect(() => {
  const unsubscribe = auth.onAuthStateChanged((user) => {
    if (user) {
      fetchCredit(user.uid);
    }
  });

  return () => unsubscribe(); // optional cleanup
}, []);


  // Add new pupil row
  const addPupil = () => {
    setPupils((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        nama: '',
        karangan: '',
        mode: 'manual',
        ocrFiles: [],
        loading: false,
        result: null,
        error: null,
        checked: false,
        set: '',
      },
    ]);
  };

  // Update pupil property by id
// Updated
const updatePupil = (index, key, value) => {
  setPupils((prev) =>
    prev.map((p, i) => (i === index ? { ...p, [key]: value } : p))
  );
};


  // Toggle check/uncheck all pupils
  const toggleAllChecked = (checked) => {
    setPupils((prev) => prev.map((p) => ({ ...p, checked })));
  };

  // Submit selected pupils for bulk analysis
  const handleSubmitChecked = async () => {
    await handleSubmitCheckedWrapper();
  };

  // Wrapper to submit specific pupils by IDs (single submit uses this too)
  async function handleSubmitCheckedWrapper(singleIds) {

    const user = auth.currentUser;
    const userId = user?.uid;

    if (!userId) {
      alert('Sesi tamat. Sila log masuk semula.');
      return;
    }

    const selected = pupils.filter((p) =>
      singleIds ? singleIds.includes(p.id) : p.checked
    );

console.log('All pupils:', pupils);
console.log('Selected pupils:', selected);
console.log("Selected pupils for processing:", selected);


    if (selected.length === 0) {
      alert('Sila tandakan pelajar yang mahu disemak.');
      return;
    }

    // Set loading true for selected pupils and clear previous error/result
    setPupils((prev) =>
      prev.map((p) =>
        selected.find((sel) => sel.id === p.id)
          ? { ...p, loading: true, error: null, result: null }
          : p
      )
    );

    try {
      const formData = new FormData();
      formData.append('userId', userId);

const pupilsData = selected.map(p => ({
  id: p.id,
  nama: p.nama,
  karangan: p.karangan,
  mode: p.mode,
  set: p.set,
  checked: true,               // use actual checked value
  pictureDescription: pictureDescription,  // same description for all selected pupils
  pictureUrl: p.pictureUrl || '',
}));
formData.append('pupils', JSON.stringify(pupilsData));


      // Append OCR files keyed by "file_<id>" for each pupil in OCR mode
      selected.forEach((p) => {
        if (p.mode === 'ocr' && p.ocrFiles.length > 0) {
          Array.from(p.ocrFiles).forEach((file) => {
            formData.append(`file_${p.id}`, file);
          });
        }
      });


console.log("Sending userId to backend:", userId);

const idToken = await user.getIdToken();

console.log("Sending pupils data to backend:", JSON.stringify(pupilsData, null, 2));

// 2️⃣ Send the request
const res = await fetch('/api/semak/bulk', {
  method: 'POST',
  body: formData,
  headers: {
    Authorization: `Bearer ${idToken}`, // ✅ Keep the token
  },
});

const json = await res.json();
console.log('Bulk semak response:', json);
     
      if (!res.ok) throw new Error(json.error || 'Ralat pelayan');
await fetchCredit();


      // Update pupils with their respective results or errors
      setPupils((prev) =>
        prev.map((p) => {
          const found = json.results.find((r) => r.id === p.id);
          if (!found) return p;

          return {
            ...p,
            loading: false,
            error: found.error || null,
            result: found.error ? null : found,
          };
        })
      );
    } catch (e) {
      alert('Ralat semasa semakan: ' + e.message);
      // Reset loading state on error for all selected pupils
      setPupils((prev) =>
        prev.map((p) =>
          selected.find((sel) => sel.id === p.id) ? { ...p, loading: false } : p
        )
      );
    }
  }

  // Generate and download PDF for selected pupils who have result
  const downloadCombinedPDF = async () => {
    setPdfLoading(true);
    const selected = pupils.filter((p) => p.checked && p.result);

    if (selected.length === 0) {
      alert('Sila tandakan pelajar yang ada keputusan untuk dimuat turun.');
      setPdfLoading(false);
      return;
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    const margin = 10;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const usableWidth = pageWidth - margin * 2;
    const lineHeight = 7;
    const fontSize = 12;

    pdf.setFont('Times', 'normal');
    pdf.setFontSize(fontSize);

    const cleanText = (text) =>
      text
        ?.replace(/<br\s*\/?>/gi, '\n')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/<\/?[^>]+(>|$)/g, '') || '-';

    for (let i = 0; i < selected.length; i++) {
      const p = selected[i];
      const result = p.result;
      let y = margin;

      if (i > 0) pdf.addPage();

      pdf.setFont(undefined, 'bold');
      pdf.text(`Keputusan Semakan Karangan untuk: ${result.nama}`, margin, y);
      pdf.setFont(undefined, 'normal');
      y += lineHeight * 2;

      pdf.text(`Markah Isi: ${result.markahIsi ?? '-'}`, margin, y);
      y += lineHeight;
      pdf.text(`Markah Bahasa: ${result.markahBahasa ?? '-'}`, margin, y);
      y += lineHeight;
      pdf.text(`Markah Keseluruhan: ${result.markahKeseluruhan ?? '-'}`, margin, y);
      y += lineHeight * 2;

      pdf.setFont(undefined, 'bold');
      pdf.text('Karangan Asal (Kesalahan digariskan):', margin, y);
      pdf.setFont(undefined, 'normal');
      y += lineHeight;

if (includeKarangan) {
  const karanganClean = cleanText(result.karanganUnderlined);
  const karanganLines = pdf.splitTextToSize(karanganClean, usableWidth);

  for (let lineIndex = 0; lineIndex < karanganLines.length; lineIndex++) {
    const line = karanganLines[lineIndex];
    if (y + lineHeight > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }

        pdf.text(line, margin, y);

        // Underline ayat salah in this line
(result.kesalahanBahasa || []).forEach(({ ayatSalah }) => {
  // Make sure ayatSalah exists and is a string
  const phrase = (ayatSalah || '').trim();
  if (!phrase) return;

  // Make sure current line is a valid string
  if (!line || typeof line !== 'string') return;

  const lineText = line;
  const normalizedLine = lineText.toLowerCase();
  const normalizedPhrase = phrase.toLowerCase();

  const startIdx = normalizedLine.indexOf(normalizedPhrase);
  if (startIdx < 0) return; // phrase not found in line

  const textBefore = lineText.substring(0, startIdx);
  const startX = margin + pdf.getTextWidth(textBefore);
  const phraseWidth = pdf.getTextWidth(lineText.substr(startIdx, phrase.length));
  const underlineY = y + 1.5;

  pdf.setDrawColor(255, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.line(startX, underlineY, startX + phraseWidth, underlineY);
  pdf.setDrawColor(0);
});


    y += lineHeight;
  }
} else {
  pdf.text('(Karangan penuh tidak disertakan atas permintaan)', margin, y);
  y += lineHeight * 2;
}

      pdf.setFont(undefined, 'bold');
      pdf.text('Analisis Kesalahan Bahasa:', margin, y);
      pdf.setFont(undefined, 'normal');
      y += lineHeight;

      if (!result.kesalahanBahasa || result.kesalahanBahasa.length === 0) {
        pdf.text('Tiada kesalahan bahasa dikesan.', margin, y);
        y += lineHeight;
      } else {
        autoTable(pdf, {
          startY: y,
          head: [['Kategori', 'Ayat Salah', 'Pembetulan', 'Penjelasan']],
          body: result.kesalahanBahasa.map((item) => [
            cleanText(item.kategori),
            cleanText(item.ayatSalah),
            cleanText(item.cadangan),
            cleanText(item.penjelasan),
          ]),
          margin: { left: margin, right: margin },
          styles: {
            font: 'times',
            fontSize: 11,
            cellPadding: 2,
            textColor: 0,
            lineColor: [0, 0, 0],
            lineWidth: 0.5,
          },
          headStyles: {
            fillColor: [255, 255, 255],
            textColor: 0,
            fontStyle: 'bold',
            lineColor: [0, 0, 0],
            lineWidth: 0.5,
          },
          theme: 'grid',
          pageBreak: 'auto',
        });

        y = pdf.lastAutoTable.finalY + lineHeight;
      }

      pdf.setFont(undefined, 'bold');
      pdf.text('Gaya Bahasa Dikesan:', margin, y);
      pdf.setFont(undefined, 'normal');
      y += lineHeight;

      if (!result.gayaBahasa || result.gayaBahasa.length === 0) {
        pdf.text('Tiada gaya bahasa dikesan.', margin, y);
        y += lineHeight;
      } else {
        result.gayaBahasa.forEach((g) => {
          const wrapped = pdf.splitTextToSize(`- ${cleanText(g)}`, usableWidth);
          wrapped.forEach((line) => {
            if (y + lineHeight > pageHeight - margin) {
              pdf.addPage();
              y = margin;
            }
            pdf.text(line, margin, y);
            y += lineHeight;
          });
        });
      }

      y += lineHeight;

      pdf.setFont(undefined, 'bold');
      pdf.text('Ulasan Keseluruhan:', margin, y);
      pdf.setFont(undefined, 'normal');
      y += lineHeight;

      const ulasanKeseluruhanLines = pdf.splitTextToSize(cleanText(result.ulasan?.keseluruhan), usableWidth);
      ulasanKeseluruhanLines.forEach((line) => {
        if (y + lineHeight > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += lineHeight;
      });
    }

    pdf.save('Laporan_Semakan_Karangan.pdf');
    setPdfLoading(false);
  };

  return (
    <div style={{ display: 'flex' }}>
      {/* Sidebar */}
<aside style={{ width: 220, backgroundColor: '#003D40', minHeight: '100vh', color: '#fff', padding: '1rem' }}>
  <h2 style={{ color: '#FFFFFF', marginBottom: '2rem' }}>📘 Menu</h2>
  <div style={{ marginBottom: '1.5rem', backgroundColor: '#004C4F', padding: '0.8rem', borderRadius: '8px' }}>
    <strong>Baki Kredit:</strong>
    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#FFD700' }}>
      {creditBalance !== null ? creditBalance : '...'}
    </div>
  </div>
  <nav>
    <ul style={{ listStyle: 'none', padding: 0, lineHeight: 2 }}>
      <li><a href="/dashboard" style={{ color: '#fff', textDecoration: 'none' }}>Dashboard</a></li>
      <li><a href="/semak" style={{ color: '#fff', textDecoration: 'none', fontWeight: 'bold' }}>Semak Karangan</a></li>
    </ul>
  </nav>
</aside>


      {/* Main content */}
      <main style={{ flex: 1, padding: '2rem', backgroundColor: '#F2EFE7' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#006A71' }}>Semak Karangan Pelajar</h1>

        <div style={{ backgroundColor: '#fff3cd', border: '1px solid #ffeeba', padding: 10, borderRadius: 5, marginBottom: '1rem' }}>
          <strong>🔔 Arahan untuk Guru:</strong>
          <ul style={{ margin: '5px 0', paddingLeft: '1.2rem' }}>
            <li>Masukkan <strong>penerangan gambar</strong> di ruang yang disediakan untuk membantu penilaian Markah Isi.</li>
            <li><strong>Sila namakan set karangan anda dengan nama yang unik</strong> untuk mengelakkan penindihan data.</li>
            <li>Tekan butang <strong>Semak Murid Terpilih</strong> untuk memproses karangan pelajar.</li>
            <li>Tandakan murid yang telah disemak untuk muat turun laporan PDF mereka.</li>
          </ul>
        </div>

        <textarea
          placeholder="Deskripsi Soalan Karangan (contoh: Gambar 1: Dua orang murid sedang...)"
          value={pictureDescription}
          onChange={(e) => setPictureDescription(e.target.value)}
          style={{
            width: '100%',
            marginBottom: 10,
            padding: '1rem',
            fontSize: '1rem',
            borderRadius: 5,
            border: '1.5px solid #48A6A7',
            resize: 'vertical',
            backgroundColor: '#FFFFFF',
          }}
          rows={3}
        />

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', border: '1px solid #9ACBD0' }}>
          <thead>
            <tr style={{ backgroundColor: '#9ACBD0', color: '#003D40' }}>
              <th style={{ padding: 10, border: '1px solid #48A6A7' }}>
                <input
                  type="checkbox"
                  onChange={(e) => toggleAllChecked(e.target.checked)}
                  checked={pupils.length > 0 && pupils.every((p) => p.checked)}
                  title="Pilih Semua"
                />
              </th>
              <th style={{ padding: 10, border: '1px solid #48A6A7' }}>Nama Murid</th>
              <th style={{ padding: 10, border: '1px solid #48A6A7' }}>Mod</th>
              <th style={{ padding: 10, border: '1px solid #48A6A7' }}>Set</th>
              <th style={{ padding: 10, border: '1px solid #48A6A7' }}>Karangan / Fail</th>
              <th style={{ padding: 10, border: '1px solid #48A6A7' }}>Tindakan</th>
              <th style={{ padding: 10, border: '1px solid #48A6A7' }}>Status</th>
              <th style={{ padding: 10, border: '1px solid #48A6A7' }}>Keputusan</th>
            </tr>
          </thead>
          <tbody>
            {pupils.map((pupil, index) => (
              <tr key={pupil.id}>
                <td style={{ padding: 10, border: '1px solid #48A6A7', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={pupil.checked}
                    onChange={(e) => updatePupil(index, 'checked', e.target.checked)}
                  />
                </td>
                <td style={{ padding: 10, border: '1px solid #48A6A7' }}>
                  <input
                    type="text"
                    placeholder="Nama Pelajar"
                    value={pupil.nama}
                    onChange={(e) => updatePupil(index, 'nama', e.target.value)}
                    style={{ width: '100%', border: '1px solid #ccc', padding: 6, borderRadius: 4 }}
                    disabled={pupil.loading}
                  />
                </td>
                <td style={{ padding: 10, border: '1px solid #48A6A7', textAlign: 'center' }}>
                  <select
                    value={pupil.mode}
                    onChange={(e) => updatePupil(index, 'mode', e.target.value)}
                    style={{ padding: 6, borderRadius: 4 }}
                    disabled={pupil.loading}
                  >
                    <option value="manual">Manual</option>
                    <option value="ocr">Upload</option>
                  </select>
                </td>
                <td style={{ padding: 10, border: '1px solid #48A6A7' }}>
                  <input
                    type="text"
                    placeholder="Set (Batch)"
                    value={pupil.set}
                    onChange={(e) => updatePupil(index, 'set', e.target.value)}
                    style={{ width: '100%', border: '1px solid #ccc', padding: 6, borderRadius: 4 }}
                    disabled={pupil.loading}
                  />
                </td>
                <td style={{ padding: 10, border: '1px solid #48A6A7' }}>
                  {pupil.mode === 'manual' ? (
                    <textarea
                      placeholder="Tulis Karangan"
                      value={pupil.karangan}
                      onChange={(e) => updatePupil(index, 'karangan', e.target.value)}
                      style={{ width: '100%', border: '1px solid #ccc', padding: 6, borderRadius: 4, resize: 'vertical' }}
                      rows={4}
                      disabled={pupil.loading}
                    />
                  ) : (
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => updatePupil(index, 'ocrFiles', e.target.files)}
                      disabled={pupil.loading}
                    />
                  )}
                </td>
                <td style={{ padding: 10, border: '1px solid #48A6A7', textAlign: 'center' }}>
                  <button
                    onClick={() => handleSubmitCheckedWrapper([pupil.id])}
                    disabled={pupil.loading || !pupil.nama || (!pupil.karangan && pupil.mode === 'manual') || (pupil.mode === 'ocr' && pupil.ocrFiles.length === 0)}
                    style={{ padding: '6px 12px', cursor: 'pointer' }}
                  >
                    {pupil.loading ? 'Memproses...' : 'Semak'}
                  </button>
                </td>
                <td style={{ padding: 10, border: '1px solid #48A6A7', textAlign: 'center' }}>
                  {pupil.loading && <span>⏳</span>}
                  {!pupil.loading && pupil.error && <span style={{ color: 'red' }}>⚠️</span>}
                  {!pupil.loading && pupil.result && <span style={{ color: 'green' }}>✔️</span>}
                </td>
                <td style={{ padding: 10, border: '1px solid #48A6A7', maxWidth: 300, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                  {pupil.error && <div style={{ color: 'red' }}>{pupil.error}</div>}
                  {pupil.result && (
                    <>
                      <div><strong>Markah Isi:</strong> {pupil.result.markahIsi ?? '-'}</div>
                      <div><strong>Markah Bahasa:</strong> {pupil.result.markahBahasa ?? '-'}</div>
                      <div><strong>Markah Keseluruhan:</strong> {pupil.result.markahKeseluruhan ?? '-'}</div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={addPupil}
            style={{ padding: '8px 16px', backgroundColor: '#006A71', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}
          >
            + Tambah Murid
          </button>

          <div>
<div style={{ marginBottom: '1rem' }}>
  <label style={{ cursor: 'pointer' }}>
    <input
      type="checkbox"
      checked={includeKarangan}
      onChange={(e) => setIncludeKarangan(e.target.checked)}
      style={{ marginRight: 8 }}
    />
    Sertakan Karangan Penuh dalam PDF
  </label>
</div>

            <button
              onClick={handleSubmitChecked}
              style={{ padding: '8px 16px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: 5, marginRight: 10, cursor: 'pointer' }}
            >
              Semak Murid Terpilih
            </button>

            <button
              onClick={downloadCombinedPDF}
              disabled={pdfLoading}
              style={{
                padding: '8px 16px',
                backgroundColor: pdfLoading ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: 5,
                cursor: pdfLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {pdfLoading ? 'Memuat turun...' : 'Muat Turun Laporan PDF'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}