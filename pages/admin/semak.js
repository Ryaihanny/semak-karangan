import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore'; // Cleaned up imports
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/AdminLayout';

export default function Semak() {
  const router = useRouter();
  const [creditBalance, setCreditBalance] = useState(null);
  const [pictureDescription, setPictureDescription] = useState('');
  const [questionImage, setQuestionImage] = useState(null);
  const [globalLevel, setGlobalLevel] = useState('P6');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [user, setUser] = useState(null);

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
      level: 'P6',
    },
  ]);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [includeKarangan, setIncludeKarangan] = useState(true);

  // --- LOGIC: FETCH CREDIT ---
  const fetchCredit = async (uid) => {
    try {
      const db = getFirestore();
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setCreditBalance(userData.credits ?? 0);
        setUser({ uid, ...userData });
      }
    } catch (err) {
      console.error("Error fetching credits:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) fetchCredit(user.uid);
      else router.replace('/');
    });
    return () => unsubscribe();
  }, [router]);

  const handleToggleAdmin = () => {
    setIsAdminMode(true);
    router.push('/admin/dashboard');
  };

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
  const userAuth = auth.currentUser;
  const userId = userAuth?.uid;
  if (!userId) return;

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

    const idToken = await userAuth.getIdToken();
    const res = await fetch('https://semak-karangan-production.up.railway.app/api/semak/bulk', {
      method: 'POST',
      body: formData,
      headers: { Authorization: `Bearer ${idToken}` },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Ralat pelayan');

    // --- ADD THIS SAVING LOGIC BACK IN ---
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
    // --- END SAVING LOGIC ---

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

    await fetchCredit(userId);

  } catch (e) {
    console.error("Submission Error:", e);
    setPupils((prev) => 
      prev.map((p) => 
        selected.find((sel) => sel.id === p.id) ? { ...p, loading: false, error: e.message } : p
      )
    );
  }
}

  const handleSubmitChecked = async () => {
    const selected = pupils.filter((p) => p.checked);
    if (selected.length === 0) return alert('Sila tandakan pelajar.');
    if (!pictureDescription.trim() && !questionImage) return alert('Sila masukkan deskripsi atau upload gambar soalan.');
    
    // Process one by one to avoid timeout issues on large batches
    for (const pupil of selected) {
      await handleSubmitCheckedWrapper([pupil.id]);
    }
  };

  // --- PDF GENERATION LOGIC (UNCHANGED) ---
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
          originalKarangan: p.result.karangan || p.karangan 
        }));

      if (itemsToDownload.length === 0) {
        alert("Sila pastikan pelajar telah disemak dan ditandakan.");
        setPdfLoading(false);
        return;
      }
      generatePDF(itemsToDownload);
    } catch (error) {
      console.error("PDF Error:", error);
      alert("Gagal menjana PDF.");
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
      return String(text).replace(/<\/?[^>]+(>|$)/g, "").trim();
    };

    items.forEach((item, index) => {
      if (index > 0) doc.addPage();
      
      doc.setFillColor(0, 61, 64);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("LAPORAN SEMAKAN SI-PINTAR", 105, 22, { align: "center" });

      let y = 55;
      doc.setTextColor(0, 61, 64);
      doc.setFontSize(12);
      doc.text(`NAMA: ${cleanText(item.nama).toUpperCase()}`, margin, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`KELAS: ${item.kelas || '-'} | TAHAP: ${item.level} | SET: ${item.set || '-'}`, margin, y);

      y += 10;
      const isJunior = item.level === 'P3' || item.level === 'P4';
      const maxIsi = isJunior ? 7 : 20; 
      const maxBahasa = isJunior ? 8 : 20;

      autoTable(doc, {
        startY: y,
        head: [['KOMPONEN', 'MARKAH']],
        body: [
          ['Isi & Penghuraian', `${item.markahIsi} / ${maxIsi}`],
          ['Bahasa & Tatabahasa', `${item.markahBahasa} / ${maxBahasa}`],
          ['JUMLAH', `${item.markahKeseluruhan} / ${maxIsi + maxBahasa}`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [0, 61, 64] }
      });

      y = doc.lastAutoTable.finalY + 10;

      if (includeKarangan && item.originalKarangan) {
        doc.setFont("helvetica", "bold");
        doc.text("TEKS KARANGAN:", margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(cleanText(item.originalKarangan), usableWidth);
        doc.text(lines, margin, y);
        y += (lines.length * 5) + 10;
      }

      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.text("ULASAN PENILAIAN:", margin, y);
      y += 5;
      
      const ulasanObj = item.ulasan || {};
      autoTable(doc, {
        startY: y,
        body: [
          ['Isi', cleanText(ulasanObj.isi || '-')],
          ['Bahasa', cleanText(ulasanObj.bahasa || '-')],
          ['Keseluruhan', cleanText(ulasanObj.keseluruhan || (typeof item.ulasan === 'string' ? item.ulasan : '-'))]
        ],
        theme: 'grid',
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 } }
      });
    });

    doc.save(`Laporan_Semakan_${new Date().getTime()}.pdf`);
  };

  return (
    <AdminLayout activePage="semak" user={user}>
      <main className="main-content">
        <header className="topbar">
          <div className="header-title">
            <h1>Semak Karangan Pelajar</h1>
            <p>Gunakan AI untuk menyemak tugasan dengan pantas.</p>
          </div>
          <div className="topbar-actions">
            <div className="mode-toggle-inline">
              <button className={isAdminMode ? 'active' : ''} onClick={handleToggleAdmin}>Admin View</button>
              <button className={!isAdminMode ? 'active' : ''} onClick={() => setIsAdminMode(false)}>Guru View</button>
            </div>
            <div className="credit-pill">
              Baki Kredit: <span>{creditBalance !== null ? creditBalance : '...'}</span>
            </div>
          </div>
        </header>

        <section className="semak-card">
          <div className="control-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
             <div className="level-select">
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', marginRight: '10px' }}>Peringkat:</label>
                <select 
                  value={globalLevel} 
                  onChange={(e) => {
                    setGlobalLevel(e.target.value);
                    setPupils(prev => prev.map(p => ({ ...p, level: e.target.value })));
                  }}
                  className="table-input" style={{ width: '100px' }}
                >
                  <option value="P6">P6</option>
                  <option value="P5">P5</option>
                  <option value="P4">P4</option>
                  <option value="P3">P3</option>
                </select>
             </div>
          </div>

          <label className="section-label">Deskripsi Soalan Karangan</label>
          <div className="question-input-container">
            <textarea
              placeholder="Tulis deskripsi soalan ATAU upload gambar soalan..."
              value={pictureDescription}
              onChange={(e) => setPictureDescription(e.target.value)}
              className="modern-textarea question-textarea"
              rows={3}
            />
            <div className={`question-image-upload ${questionImage ? 'has-file' : ''}`}>
               <label className="image-label">
                  <span className="upload-icon">{questionImage ? '✅' : '📸'}</span>
                  <input type="file" accept="image/*" onChange={(e) => setQuestionImage(e.target.files[0])} hidden />
               </label>
               {questionImage && <button onClick={() => setQuestionImage(null)} style={{fontSize:'10px', color:'red', border:'none', background:'none', cursor:'pointer'}}>Padam</button>}
            </div>
          </div>

          <div className="table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th><input type="checkbox" onChange={(e) => toggleAllChecked(e.target.checked)} checked={pupils.length > 0 && pupils.every(p => p.checked)} /></th>
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
                    <td><input value={pupil.nama} placeholder="Nama" onChange={(e) => updatePupil(index, 'nama', e.target.value)} className="table-input" /></td>
                    <td><input value={pupil.kelas} placeholder="Kelas" onChange={(e) => updatePupil(index, 'kelas', e.target.value)} className="table-input" style={{width:'60px'}} /></td>
                    <td><input value={pupil.set} placeholder="A/B" onChange={(e) => updatePupil(index, 'set', e.target.value)} className="table-input" style={{width:'50px'}} /></td>
                    <td>
                      {pupil.mode === 'manual' || pupil.result ? (
                        <textarea value={pupil.karangan} onChange={(e) => updatePupil(index, 'karangan', e.target.value)} className="table-textarea" rows={3} />
                      ) : (
                        <input type="file" multiple onChange={(e) => updatePupil(index, 'ocrFiles', Array.from(e.target.files))} />
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => handleSubmitCheckedWrapper([pupil.id])} className={`btn-action-small ${pupil.result ? 'done' : ''}`} disabled={pupil.loading}>
                        {pupil.loading ? '...' : pupil.result ? 'Semak Lagi' : 'Semak'}
                      </button>
                      <select value={pupil.mode} onChange={(e) => updatePupil(index, 'mode', e.target.value)} style={{fontSize:'10px', marginTop:'5px', width:'100%'}}>
                        <option value="manual">Manual</option>
                        <option value="ocr">Upload</option>
                      </select>
                    </td>
                    <td>
                      {pupil.error && <span style={{color:'red', fontSize:'10px'}}>⚠️ Ralat: {pupil.error}</span>}
                      {pupil.result && (
                        <div className="mini-result">
                          <div style={{fontWeight:'bold', color:'#48A6A7'}}>{pupil.result.markahKeseluruhan}/{pupil.result.maxPossible}</div>
                          <textarea 
                            className="ulasan-edit"
                            value={typeof pupil.result.ulasan === 'object' ? pupil.result.ulasan.keseluruhan : pupil.result.ulasan}
                            onChange={(e) => {
                              const newResult = { ...pupil.result };
                              if (typeof newResult.ulasan === 'object') newResult.ulasan.keseluruhan = e.target.value;
                              else newResult.ulasan = e.target.value;
                              updatePupil(index, 'result', newResult);
                            }}
                            rows={2}
                            style={{width:'100%', fontSize:'11px', fontStyle:'italic', marginTop:'5px'}}
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
            <div className="main-actions" style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleSubmitChecked} className="btn-primary">Semak Terpilih</button>
              <button onClick={downloadCombinedPDF} disabled={pdfLoading} className="btn-success" style={{background:'#48A6A7', color:'white', border:'none', padding:'10px 20px', borderRadius:'10px', fontWeight:'700', cursor:'pointer'}}>
                {pdfLoading ? 'Menjana...' : 'Muat Turun PDF'}
              </button>
            </div>
          </div>
        </section>
      </main>

      <style jsx>{`
        .main-content { padding: 1.5rem 0; }
        .topbar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
        .topbar-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
        .mode-toggle-inline { display: flex; background: #f0f4f4; padding: 4px; border-radius: 10px; }
        .mode-toggle-inline button { border: none; padding: 6px 15px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; transition: 0.2s; color: #668385; background: transparent; }
        .mode-toggle-inline button.active { background: #003032; color: #ffd700; }
        .credit-pill { background: white; padding: 8px 16px; border-radius: 50px; border: 1px solid #EEE; font-size: 0.9rem; font-weight: 700; }
        .credit-pill span { color: #48A6A7; }
        .semak-card { background: white; border-radius: 20px; padding: 2rem; border: 1px solid #EEE; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
        .section-label { display: block; font-size: 0.75rem; font-weight: 700; color: #AAA; text-transform: uppercase; margin-bottom: 10px; }
        .question-input-container { display: flex; gap: 15px; margin-bottom: 1.5rem; }
        .modern-textarea { width: 100%; padding: 1rem; border-radius: 12px; border: 1px solid #F0F0F0; background: #FAFAFA; resize: none; font-family: inherit; }
        .question-image-upload { width: 100px; height: 100px; border: 2px dashed #DDD; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-direction: column; }
        .question-image-upload.has-file { border-color: #28A745; background: #E6F9F0; }
        .table-wrapper { overflow-x: auto; margin-bottom: 2rem; }
        .modern-table { width: 100%; border-collapse: collapse; min-width: 800px; }
        .modern-table th { text-align: left; padding: 12px; font-size: 0.7rem; color: #AAA; text-transform: uppercase; border-bottom: 2px solid #F5F5F5; }
        .modern-table td { padding: 12px; border-bottom: 1px solid #F9F9F9; vertical-align: top; }
        .table-input, .table-textarea { width: 100%; border: 1px solid #EEE; padding: 8px; border-radius: 8px; font-size: 0.85rem; outline: none; transition: 0.2s; }
        .table-input:focus, .table-textarea:focus { border-color: #48A6A7; }
        .table-textarea { min-height: 60px; }
        .btn-action-small { background: #E6F2F2; color: #48A6A7; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; width: 100%; }
        .btn-action-small.done { background: #E6F9F0; color: #28A745; }
        .btn-primary { background: #003D40; color: white; border: none; padding: 10px 24px; border-radius: 10px; cursor: pointer; font-weight: 700; }
        .btn-secondary { background: white; border: 1px solid #DDD; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: 600; }
        .row-loading { opacity: 0.5; pointer-events: none; }
        .form-footer { display: flex; justify-content: space-between; align-items: center; }
      `}</style>
    </AdminLayout>
  );
}