import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/router';
import { signOut } from 'firebase/auth';

export default function Semak() {
  const router = useRouter();
  const [user, setUser] = useState(null); // Added for consistency with dashboard logic
  const [creditBalance, setCreditBalance] = useState(null);
  const [pictureDescription, setPictureDescription] = useState('');
  const [questionImage, setQuestionImage] = useState(null);
  const [globalLevel, setGlobalLevel] = useState('P6');
  
  const [pupils, setPupils] = useState([
    {
      id: 1,
      nama: '',
      kelas: '',
      karangan: '',
      mode: 'manual',
      ocrFiles: [],
      loading: false,
      result: null,
      error: null,
      checked: false,
      set: '',
      level: globalLevel,
    },
  ]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [includeKarangan, setIncludeKarangan] = useState(true);

  // --- LOGIC: FETCH CREDIT (UNTOUCHED) ---
  const fetchCredit = async (uid) => {
    const db = getFirestore();
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      setCreditBalance(data.credits ?? 0);
      setUser({ uid, ...data });
    } else {
      setCreditBalance(0);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchCredit(user.uid);
      } else {
        router.replace('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // --- LOGIC: PUPIL MANAGEMENT ---
  const addPupil = () => {
    setPupils((prev) => [
      ...prev,
      {
        id: Date.now(),
        nama: '',
        kelas: '',
        karangan: '',
        mode: 'manual',
        ocrFiles: [],
        loading: false,
        result: null,
        error: null,
        checked: false,
        set: '',
        level: globalLevel,
      },
    ]);
  };

  const updatePupil = (index, key, value) => {
    setPupils((prev) => prev.map((p, i) => (i === index ? { ...p, [key]: value } : p)));
  };

  const toggleAllChecked = (checked) => {
    setPupils((prev) => prev.map((p) => ({ ...p, checked })));
  };

// --- LOGIC: SUBMISSION ---
  async function handleSubmitCheckedWrapper(singleIds) {
    const user = auth.currentUser;
    const userId = user?.uid;
    if (!userId) {
      alert('Sesi tamat. Sila log masuk semula.');
      return;
    }

    const selected = pupils.filter((p) => (singleIds ? singleIds.includes(p.id) : p.checked));
    if (selected.length === 0) return;

    setPupils((prev) =>
      prev.map((p) =>
        selected.find((sel) => sel.id === p.id) ? { ...p, loading: true, error: null, result: null } : p
      )
    );

    try {
      const formData = new FormData();
      if (questionImage) formData.append('questionImage', questionImage);

      const pupilsData = selected.map((p) => ({
        id: p.id,
        nama: p.nama || '',
        kelas: p.kelas || '',
        karangan: p.karangan || '',
        mode: p.mode,
        set: p.set || '',
        level: p.level || 'P6',
        pictureDescription: pictureDescription || '',
      }));

      formData.append('pupils', JSON.stringify(pupilsData));

      selected.forEach((p) => {
        if (p.mode === 'ocr' && p.ocrFiles.length > 0) {
          Array.from(p.ocrFiles).forEach((file) => {
            formData.append(`file_${p.id}`, file);
          });
        }
      });

      const idToken = await user.getIdToken();
      const res = await fetch('/api/semak/bulk', {
        method: 'POST',
        body: formData,
        headers: { Authorization: `Bearer ${idToken}` },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ralat pelayan');

      // --- FIRESTORE SAVING LOGIC (STRICTLY INCLUDED) ---
      const { collection, addDoc, serverTimestamp, getFirestore } = await import('firebase/firestore');
      const db = getFirestore();

      for (const resItem of json.results) {
        if (!resItem.error) {
          const originalPupil = selected.find((p) => String(p.id) === String(resItem.id));
          
          if (originalPupil) {
            const currentLevel = originalPupil.level || 'P6';
            
            await addDoc(collection(db, 'karanganResults'), {
              userId: userId,
              nama: originalPupil.nama,
              kelas: originalPupil.kelas,
              level: currentLevel,
              set: originalPupil.set || '',
              karangan: resItem.karangan || originalPupil.karangan,
              markahIsi: resItem.markahIsi,
              markahBahasa: resItem.markahBahasa,
              markahKeseluruhan: resItem.markahKeseluruhan,
              maxPossible: resItem.maxPossible || (currentLevel === 'P3' || currentLevel === 'P4' ? 15 : 40),
              ulasan: resItem.ulasan,
              kesalahanBahasa: resItem.kesalahanBahasa || [],
              gayaBahasa: resItem.gayaBahasa || [],
              timestamp: serverTimestamp(),
            });
          }
        }
      }
      // --- END FIRESTORE SAVING LOGIC ---

      await fetchCredit(userId);

      setPupils((prev) =>
        prev.map((p) => {
          const found = json.results.find((r) => String(r.id) === String(p.id));
          if (!found) return p;
          return {
            ...p,
            loading: false,
            karangan: found.karangan || p.karangan,
            error: found.error || null,
            result: found.error ? null : found,
          };
        })
      );
    } catch (e) {
      console.error(e);
      setPupils((prev) =>
        prev.map((p) => (selected.find((sel) => sel.id === p.id) ? { ...p, loading: false, error: e.message } : p))
      );
    }
  }

  const handleSubmitChecked = async () => {
    const selected = pupils.filter((p) => p.checked);
    if (selected.length === 0) {
      alert('Sila tandakan pelajar yang mahu disemak.');
      return;
    }

    if (!pictureDescription.trim() && !questionImage) {
      alert('Sila masukkan deskripsi atau upload gambar soalan.');
      return;
    }

    // This loop ensures each student is processed individually for high accuracy
    for (const pupil of selected) {
      await handleSubmitCheckedWrapper([pupil.id]);
    }
  };

 // --- MATCHED STYLE & LOGIC FOR PDF GENERATION ---
  const downloadCombinedPDF = () => {
    setPdfLoading(true);
    try {
      const itemsToDownload = pupils
        .filter((p) => p.result && p.checked)
        .map((p) => ({
          ...p.result,
          nama: p.nama,
          kelas: p.kelas,
          level: p.level,
          set: p.set,
          // FIX 1: Prioritize the transcribed text from AI result so OCR images show up
          originalKarangan: p.result.karangan || p.karangan 
        }));

      if (itemsToDownload.length === 0) {
        alert("Sila pastikan pelajar telah disemak dan ditandakan.");
        setPdfLoading(false);
        return;
      }
      generatePDF(itemsToDownload);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Gagal menjana PDF. Sila cuba lagi.");
    } finally {
      setPdfLoading(false);
    }
  };

  const generatePDF = (items) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const usableWidth = pageWidth - (margin * 2);

    const cleanText = (text) => {
      if (!text) return '-';
      return String(text)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/<\/?[^>]+(>|$)/g, '');
    };

    items.forEach((item, index) => {
      if (index > 0) doc.addPage();
      
      let y = 0;

      // 1. EMERALD HEADER BLOCK
      doc.setFillColor(0, 61, 64);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("LAPORAN SEMAKAN SI-PINTAR", 105, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Analisis Karangan Berasaskan Kecerdasan Buatan (AI)", 105, 28, { align: "center" });

      // 2. STUDENT INFO WITH UNDERLINE LOGIC
      y = 55;
      doc.setTextColor(0, 61, 64);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      const nameText = `NAMA: ${cleanText(item.nama).toUpperCase()}`;
      doc.text(nameText, margin, y);
      
      const textWidth = doc.getTextWidth(nameText);
      doc.setDrawColor(0, 61, 64);
      doc.setLineWidth(0.5);
      doc.line(margin, y + 2, margin + textWidth, y + 2);

      y += 12;
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      doc.text(`KELAS: ${item.kelas || '-'}`, margin, y);
      doc.text(`TAHAP: ${item.level}`, 80, y);
      doc.text(`SET: ${item.set || '-'}`, 140, y);

      // 3. SCORE TABLE (Dynamic Max Marks)
      y += 10;
      
      // Determine max marks based on Level
      // P3/P4 usually /15, Others usually /40
      const isJunior = item.level === 'P3' || item.level === 'P4';
      const maxIsi = isJunior ? 7 : 20; 
      const maxBahasa = isJunior ? 8 : 20;
      const totalMax = maxIsi + maxBahasa; // e.g., 15 or 40

      autoTable(doc, {
        startY: y,
        head: [['KOMPONEN PENILAIAN', 'MARKAH']],
        body: [
          ['Isi & Penghuraian', `${item.markahIsi} / ${maxIsi}`],
          ['Bahasa & Tatabahasa', `${item.markahBahasa} / ${maxBahasa}`],
          ['JUMLAH KESELURUHAN', `${item.markahKeseluruhan} / ${totalMax}`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [0, 61, 64], textColor: [255, 255, 255], fontSize: 11 },
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 5 },
        columnStyles: { 1: { halign: 'center', fontStyle: 'bold', fontSize: 12 } }
      });

      y = doc.lastAutoTable.finalY + 15;

      // 4. ORIGINAL ESSAY
      if (includeKarangan && item.originalKarangan) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 61, 64);
        doc.text("TEKS KARANGAN:", margin, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 40);
        const wrappedKarangan = doc.splitTextToSize(cleanText(item.originalKarangan), usableWidth);
        doc.text(wrappedKarangan, margin, y);
        y += (wrappedKarangan.length * 5) + 12;
      }

      if (y > 240) { doc.addPage(); y = 25; }

      // 5. ULASAN BERSTRUKTUR
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 61, 64);
      doc.text("ULASAN PENILAIAN:", margin, y);
      y += 7;

      const ulasanIsi = typeof item.ulasan === 'object' ? item.ulasan?.isi : '-';
      const ulasanBahasa = typeof item.ulasan === 'object' ? item.ulasan?.bahasa : '-';
      const ulasanTotal = typeof item.ulasan === 'object' ? item.ulasan?.keseluruhan : item.ulasan;

      autoTable(doc, {
        startY: y,
        body: [
          ['Aspek Isi', cleanText(ulasanIsi)],
          ['Aspek Bahasa', cleanText(ulasanBahasa)],
          ['Keseluruhan', cleanText(ulasanTotal)]
        ],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35, fillColor: [240, 240, 240] } }
      });

      y = doc.lastAutoTable.finalY + 12;

// 6. ANALISIS KESALAHAN (FIXED: 4 Columns with Category & Full Sentence)
if (item.kesalahanBahasa && item.kesalahanBahasa.length > 0) {
  if (y > 230) { doc.addPage(); y = 25; }
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 61, 64);
  doc.text("ANALISIS KESALAHAN BAHASA:", margin, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [['Kategori', 'Kesalahan Asal', 'Pembetulan (Ayat Penuh)', 'Penjelasan']],
    body: item.kesalahanBahasa.map(kb => [
      cleanText(kb.kategori || 'Umum'),
      cleanText(kb.ayatSalah),
      cleanText(kb.pembetulan), // This now pulls the full sentence from the AI
      cleanText(kb.penjelasan)
    ]),
    theme: 'grid',
    headStyles: { fillColor: [72, 166, 167], textColor: [255, 255, 255] }, 
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 
      0: { cellWidth: 25, fontStyle: 'bold' },
      1: { cellWidth: 45 },
      2: { cellWidth: 50, textColor: [0, 100, 0] }, // Greenish for the fix
      3: { cellWidth: 45 }
    }
  });
  
  y = doc.lastAutoTable.finalY + 10;
}

      // FOOTER
      const pageCount = doc.internal.getNumberOfPages();
      doc.setPage(pageCount);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Dicetak pada: ${new Date().toLocaleString('ms-MY')}`, margin, 285);
      doc.text("Laporan ini dijana secara automatik oleh SI-PINTAR AI", 105, 285, { align: "center" });
    });

    const filename = items.length === 1 
      ? `Laporan_${items[0].nama.replace(/\s+/g, '_')}.pdf` 
      : `Laporan_Pukal_${new Date().getTime()}.pdf`;
      
    doc.save(filename);
  };

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">SI</div>
          <div className="logo-text"><h3>SI-PINTAR</h3><span>VERSI GURU</span></div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-header">UTAMA</div>
          <div className="nav-link" onClick={() => router.push('/dashboard')}>📊 Rekod & Dashboard</div>
          <div className="nav-link" onClick={() => router.push('/trend')}>📈 Analisis Trend</div>
          
          <div className="nav-divider"></div>
          
          <div className="nav-header">PENGURUSAN</div>
          <div className="nav-link" onClick={() => router.push('/urus-kelas')}>🏫 Urus Kelas</div>
          <div className="nav-link" onClick={() => router.push('/beli-kredit')}>💰 Beli Kredit</div>
          <div className="nav-link" onClick={() => router.push('/profile')}>👤 Profil Guru</div>
          
          <div className="nav-divider"></div>
          
          <div className="nav-action-zone">
            <div className="nav-link highlight active">✍️ Mulakan Semakan</div>
          </div>
        </nav>
        <button className="btn-logout-sidebar" onClick={() => signOut(auth).then(() => router.replace('/'))}>Keluar Sistem</button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="header-title">
            <h1>Semak Karangan Pelajar</h1>
            <p>Sila masukkan butiran tugasan di bawah.</p>
          </div>
          <div className="credit-pill">
            Baki Kredit: <span>{creditBalance !== null ? creditBalance : '...'}</span>
          </div>
        </header>

        <div className="info-banner">
          <div className="info-icon">💡</div>
          <div className="info-text">
            <strong>Tip Guru:</strong> Anda kini boleh <b>edit teks karangan</b> dan <b>ulasan</b> terus di dalam jadual sebelum menjana PDF.
          </div>
        </div>

        <section className="semak-card">
          <label className="section-label">Deskripsi Soalan Karangan</label>
          <div className="question-input-container">
            <textarea
              placeholder="Tulis deskripsi soalan ATAU upload gambar soalan di sebelah..."
              value={pictureDescription}
              onChange={(e) => setPictureDescription(e.target.value)}
              className="modern-textarea question-textarea"
              rows={3}
            />
            <div className={`question-image-upload ${questionImage ? 'has-file' : ''}`}>
               <label className="image-label">
                  <span className="upload-icon">{questionImage ? '✅' : '📸'}</span>
                  <span className="upload-text">
                    {questionImage ? questionImage.name.substring(0, 15) + '...' : 'Upload Gambar Soalan'}
                  </span>
                  <input type="file" accept="image/*" onChange={(e) => setQuestionImage(e.target.files[0])} hidden />
               </label>
               {questionImage && <button className="btn-remove-img" onClick={() => setQuestionImage(null)}>Padam</button>}
            </div>
          </div>

          <div className="control-item">
  <label>Peringkat:</label>
  <select 
    value={globalLevel}
    onChange={(e) => {
      const val = e.target.value;
      setGlobalLevel(val); // Update the "memory" for new rows
      setPupils(prev => prev.map(p => ({ ...p, level: val }))); // Update existing rows
    }} 
    className="modern-select small"
  >
    <option value="P6">P6</option>
    <option value="P5">P5</option>
    <option value="P4">P4</option>
    <option value="P3">P3</option>
  </select>
</div>

          <div className="table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th><input type="checkbox" onChange={(e) => toggleAllChecked(e.target.checked)} checked={pupils.length > 0 && pupils.every((p) => p.checked)} /></th>
                  <th>Nama Murid</th>
                  <th>Kelas</th>
<th>Set</th>
                  <th>Karangan (Edit)</th>
                  <th style={{ textAlign: 'center' }}>Tindakan</th>
                  <th>Keputusan & Ulasan</th>
                </tr>
              </thead>
              <tbody>
                {pupils.map((pupil, index) => (
                  <tr key={pupil.id} className={pupil.loading ? 'row-loading' : ''}>
                    <td><input type="checkbox" checked={pupil.checked} onChange={(e) => updatePupil(index, 'checked', e.target.checked)} /></td>
                    <td><input type="text" placeholder="Nama" value={pupil.nama} onChange={(e) => updatePupil(index, 'nama', e.target.value)} className="table-input" disabled={pupil.loading} /></td>
                    <td><input type="text" placeholder="5A" value={pupil.kelas} onChange={(e) => updatePupil(index, 'kelas', e.target.value)} className="table-input" disabled={pupil.loading} /></td>
<td>
      <input 
        type="text" 
        placeholder="A/B/1" 
        value={pupil.set} 
        onChange={(e) => updatePupil(index, 'set', e.target.value)} 
        className="table-input" 
        style={{ width: '60px' }}
        disabled={pupil.loading} 
      />
    </td>
                    <td>
                      {pupil.mode === 'manual' || pupil.result ? (
                        <textarea
                          placeholder="Hasil transkripsi akan muncul di sini..."
                          value={pupil.karangan}
                          onChange={(e) => updatePupil(index, 'karangan', e.target.value)}
                          className="table-textarea"
                          rows={4}
                          disabled={pupil.loading}
                        />
                      ) : (
                        <input type="file" accept="image/*" multiple onChange={(e) => updatePupil(index, 'ocrFiles', Array.from(e.target.files))} disabled={pupil.loading} className="file-input" />
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => handleSubmitCheckedWrapper([pupil.id])} disabled={pupil.loading || !pupil.nama} className={`btn-action-small ${pupil.result ? 'done' : ''}`}>
                        {pupil.loading ? '...' : pupil.result ? 'Semak Semula' : 'Semak'}
                      </button>
                      <select 
                        value={pupil.mode} 
                        onChange={(e) => updatePupil(index, 'mode', e.target.value)} 
                        className="table-select-mini"
                        disabled={pupil.loading}
                      >
                        <option value="manual">Manual</option>
                        <option value="ocr">Upload</option>
                      </select>
                    </td>
                    <td>
                      {pupil.error && <span className="status-err">⚠️ Ralat</span>}
                      {pupil.result && (
                        <div className="mini-result">
                          <div className="mark-row"><b>{pupil.result.markahKeseluruhan}</b>/{pupil.result.maxPossible}</div>
                          <textarea 
                             className="ulasan-edit"
                             value={pupil.result.ulasan.keseluruhan}
                             onChange={(e) => {
                               const newResult = { ...pupil.result };
                               newResult.ulasan.keseluruhan = e.target.value;
                               updatePupil(index, 'result', newResult);
                             }}
                             rows={3}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-footer">
            <button onClick={addPupil} className="btn-secondary">+ Tambah Murid</button>
            <div className="main-actions">
              <button onClick={handleSubmitChecked} disabled={!pictureDescription.trim() && !questionImage} className="btn-primary">Semak Murid Terpilih</button>
              <button onClick={downloadCombinedPDF} disabled={pdfLoading} className="btn-success">{pdfLoading ? 'Menjana PDF...' : 'Muat Turun PDF'}</button>
            </div>
          </div>
        </section>
      </main>

      <style jsx>{`
        .dashboard-layout { display: flex; min-height: 100vh; background: #F2F6F6; font-family: 'Inter', sans-serif; color: #003D40; }
        .sidebar { width: 280px; background: #003D40; color: white; display: flex; flex-direction: column; padding: 2rem 1.5rem; position: sticky; top: 0; height: 100vh; }
        .sidebar-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 3rem; }
        .logo-icon { background: #FFD700; color: #003D40; font-weight: 900; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
        .logo-text h3 { margin: 0; font-size: 1.1rem; letter-spacing: 1px; }
        .logo-text span { font-size: 0.6rem; opacity: 0.5; font-weight: 700; }
        .sidebar-nav { flex: 1; }
        .nav-header { font-size: 0.65rem; font-weight: 800; color: rgba(255,255,255,0.4); letter-spacing: 1.5px; margin: 1.5rem 0 0.8rem 15px; }
        .nav-link { padding: 12px 15px; border-radius: 12px; cursor: pointer; margin-bottom: 4px; transition: 0.2s; color: rgba(255,255,255,0.7); font-size: 0.9rem; }
        .nav-link:hover { background: rgba(255,255,255,0.05); color: white; }
        .nav-link.active { background: #48A6A7; color: white; font-weight: 600; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .nav-link.highlight { background: #FFD700; color: #003D40; font-weight: 700; margin-top: 10px; }
        .nav-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 1.5rem 10px; }
        .btn-logout-sidebar { margin-top: auto; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 10px; cursor: pointer; }
        .main-content { flex: 1; padding: 2.5rem 3.5rem; overflow-y: auto; }
        .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .header-title h1 { margin: 0; font-size: 1.8rem; color: #003D40; }
        .header-title p { color: #888; margin: 4px 0 0; font-size: 0.9rem; }
        .credit-pill { background: white; padding: 8px 16px; border-radius: 50px; border: 1px solid #E0E7E7; font-size: 0.85rem; font-weight: 600; }
        .credit-pill span { color: #48A6A7; font-weight: 800; }
        .info-banner { display: flex; gap: 1rem; background: #FFF9E6; border: 1px solid #FFE4B3; padding: 1rem; border-radius: 12px; margin-bottom: 2rem; align-items: center; }
        .info-text { font-size: 0.85rem; color: #7A5C00; line-height: 1.4; }
        .semak-card { background: white; border-radius: 20px; padding: 2rem; border: 1px solid #E0E7E7; box-shadow: 0 4px 20px rgba(0,61,64,0.04); }
        .section-label { display: block; font-size: 0.75rem; font-weight: 700; color: #AAA; text-transform: uppercase; margin-bottom: 10px; }
        .question-input-container { display: flex; gap: 15px; margin-bottom: 1.5rem; align-items: flex-start; }
        .question-textarea { flex: 1; }
        .question-image-upload { width: 180px; height: 95px; border: 2px dashed #48A6A7; border-radius: 12px; background: #f0fbfc; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; transition: 0.3s; }
        .question-image-upload.has-file { border-style: solid; background: #e6f9f0; border-color: #28a745; }
        .image-label { display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center; width: 100%; }
        .upload-icon { font-size: 1.2rem; }
        .upload-text { font-size: 0.7rem; color: #003D40; font-weight: 600; margin-top: 4px; padding: 0 5px; }
        .btn-remove-img { background: none; border: none; color: #dc3545; font-size: 0.65rem; text-decoration: underline; cursor: pointer; }
        .modern-textarea { width: 100%; padding: 1rem; border-radius: 12px; border: 1px solid #F0F0F0; background: #FAFAFA; font-size: 0.95rem; transition: 0.2s; }
        .modern-textarea:focus { border-color: #48A6A7; outline: none; background: white; }
        .control-item { display: flex; align-items: center; gap: 10px; font-size: 0.85rem; font-weight: 600; color: #555; margin-bottom: 1.5rem; }
        .modern-select.small { padding: 5px 10px; border-radius: 8px; border: 1px solid #DDD; }
        .table-wrapper { overflow-x: auto; margin-bottom: 2rem; }
        .modern-table { width: 100%; border-collapse: collapse; min-width: 900px; }
        .modern-table th { text-align: left; padding: 12px; font-size: 0.75rem; color: #AAA; text-transform: uppercase; border-bottom: 2px solid #F5F5F5; }
        .modern-table td { padding: 12px; border-bottom: 1px solid #F9F9F9; vertical-align: top; }
        .table-input, .table-textarea { width: 100%; border: 1px solid #EEE; padding: 8px; border-radius: 8px; font-size: 0.85rem; }
        .table-textarea { min-height: 80px; font-family: inherit; resize: vertical; }
        .table-select-mini { display: block; width: 100%; margin-top: 5px; font-size: 0.7rem; border: none; background: #f0f0f0; border-radius: 4px; padding: 2px; }
        .btn-secondary { background: white; border: 1px solid #DDD; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: 600; }
        .btn-primary { background: #003D40; color: white; border: none; padding: 10px 24px; border-radius: 10px; cursor: pointer; font-weight: 700; transition: 0.2s; }
        .btn-primary:disabled { background: #CCC; cursor: not-allowed; }
        .btn-success { background: #48A6A7; color: white; border: none; padding: 10px 24px; border-radius: 10px; cursor: pointer; font-weight: 700; }
        .btn-action-small { background: #E6F2F2; color: #48A6A7; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; width: 100%; }
        .btn-action-small.done { background: #E6F9F0; color: #28A745; }
        .mini-result { font-size: 0.75rem; }
        .mark-row { color: #48A6A7; font-size: 1rem; margin-bottom: 5px; }
        .ulasan-edit { width: 100%; font-size: 0.75rem; border: 1px solid #F0F0F0; background: #FFF; padding: 5px; border-radius: 6px; color: #666; font-style: italic; }
        .row-loading { opacity: 0.5; pointer-events: none; }
        .status-err { color: #dc3545; font-size: 0.7rem; font-weight: bold; }
        .file-input { font-size: 0.7rem; }
      `}</style>
    </div>
  );
}