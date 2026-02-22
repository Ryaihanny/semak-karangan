import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  doc, getDoc, updateDoc, writeBatch, collection, 
  query, where, getDocs, orderBy 
} from 'firebase/firestore'; 
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState([]);
  const [viewMode, setViewMode] = useState('all'); 
  const [layoutStyle, setLayoutStyle] = useState('list');
  
  // --- Filters ---
  const [selectedKelas, setSelectedKelas] = useState('Semua');
  const [selectedTahap, setSelectedTahap] = useState('Semua');
  const [selectedSet, setSelectedSet] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  // --- Derived Data & Sorting ---
  const uniqueClasses = useMemo(() => ['Semua', ...new Set(results.map(r => r.kelas).filter(Boolean))], [results]);
  const uniqueTahap = useMemo(() => ['Semua', ...new Set(results.map(r => r.level))], [results]);
  const uniqueSets = useMemo(() => ['Semua', ...new Set(results.map(r => r.set).filter(Boolean).sort((a,b)=>a-b))], [results]);

  const sortedAndFilteredData = useMemo(() => {
    return results
      .filter(item => {
        const matchSearch = item.nama?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchKelas = selectedKelas === 'Semua' || item.kelas === selectedKelas;
        const matchTahap = selectedTahap === 'Semua' || item.level === selectedTahap;
        const matchSet = selectedSet === 'Semua' || String(item.set) === String(selectedSet);
        return matchSearch && matchKelas && matchTahap && matchSet;
      })
      .sort((a, b) => {
        if (a.level !== b.level) return a.level.localeCompare(b.level);
        if ((a.kelas || "") !== (b.kelas || "")) return (a.kelas || "").localeCompare(b.kelas || "");
        if ((a.set || 0) !== (b.set || 0)) return (a.set || 0) - (b.set || 0);
        return a.nama.localeCompare(b.nama);
      });
  }, [results, searchQuery, selectedKelas, selectedTahap, selectedSet]);

  // --- Core Lifecycle ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { router.replace('/login'); return; }
      const userDocSnap = await getDoc(doc(db, 'users', currentUser.uid));
      setUser({ uid: currentUser.uid, ...userDocSnap?.data() });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const refreshData = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(collection(db, 'karanganResults'), where('userId', '==', auth.currentUser.uid), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      setResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) { 
      console.error("Error refreshing data:", err); 
    }
  };

  useEffect(() => { if (user?.uid) refreshData(); }, [user]);

  // --- Logic Handlers ---
  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (confirm(`Padam ${selectedIds.length} rekod?`)) {
      const batch = writeBatch(db);
      selectedIds.forEach(id => batch.delete(doc(db, 'karanganResults', id)));
      await batch.commit();
      setSelectedIds([]);
      refreshData();
    }
  };

  const generatePDF = (items) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const usableWidth = pageWidth - margin * 2;

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
      doc.setFillColor(0, 61, 64);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("times", "bold");
      doc.setFontSize(20);
      doc.text("LAPORAN SEMAKAN SI-PINTAR", 105, 18, { align: "center" });
      doc.setFontSize(10);
      doc.setFont("times", "normal");
      doc.text("Standard Penilaian Karangan MOE Singapura", 105, 26, { align: "center" });

      let y = 50;
      doc.setTextColor(0, 61, 64);
      doc.setFontSize(12);
      doc.setFont("times", "bold");
      doc.text(`NAMA: ${cleanText(item.nama).toUpperCase()}`, margin, y);
      
      doc.setFontSize(10);
      doc.setFont("times", "normal");
      doc.setTextColor(80, 80, 80);
      y += 7;
      doc.text(`Peringkat: ${item.level}`, margin, y);
      doc.text(`Kelas: ${item.kelas || '-'}`, 60, y);
      doc.text(`Set: ${item.set || '-'}`, 110, y);
      doc.text(`Tarikh: ${new Date().toLocaleDateString('ms-MY')}`, 160, y);

      y += 8;
      const isJunior = (item.level === 'P3' || item.level === 'P4');
      const maxIsi = isJunior ? 7 : 20;
      const maxBhs = isJunior ? 8 : 20;
      const totalMax = isJunior ? 15 : 40;

      autoTable(doc, {
        startY: y,
        head: [['KRITERIA', 'MARKAH']],
        body: [
          ['Isi & Huraian', `${item.markahIsi} / ${maxIsi}`],
          ['Bahasa & Tatabahasa', `${item.markahBahasa} / ${maxBhs}`],
          ['JUMLAH KESELURUHAN', `${item.markahKeseluruhan} / ${totalMax}`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [0, 61, 64], textColor: [255, 255, 255] },
        styles: { font: 'times', fontSize: 10 },
        columnStyles: { 1: { halign: 'center', fontStyle: 'bold' } }
      });

      y = doc.lastAutoTable.finalY + 12;

      doc.setTextColor(0, 61, 64);
      doc.setFont("times", "bold");
      doc.text("TEKS KARANGAN:", margin, y);
      y += 7;
      doc.setFont("times", "normal");
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);

      const rawKarangan = cleanText(item.karangan);
      const lines = doc.splitTextToSize(rawKarangan, usableWidth);
      
      lines.forEach((line) => {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text(line, margin, y);
        if (item.kesalahanBahasa) {
          item.kesalahanBahasa.forEach((error) => {
            const phrase = error.ayatSalah;
            if (phrase && line.includes(phrase)) {
              const startX = margin + doc.getTextWidth(line.substring(0, line.indexOf(phrase)));
              const phraseWidth = doc.getTextWidth(phrase);
              doc.setDrawColor(200, 0, 0);
              doc.setLineWidth(error.severity === 'Major' ? 0.5 : 0.2);
              doc.line(startX, y + 1, startX + phraseWidth, y + 1);
            }
          });
        }
        y += 7;
      });

      if (item.kesalahanBahasa && item.kesalahanBahasa.length > 0) {
        y += 5;
        if (y > 230) { doc.addPage(); y = 20; }
        doc.setTextColor(200, 0, 0);
        doc.setFont("times", "bold");
        doc.text("ANALISIS KESALAHAN:", margin, y);
        autoTable(doc, {
          startY: y + 2,
          head: [['Kesalahan', 'Pembetulan', 'Penjelasan']],
          body: item.kesalahanBahasa.map(k => [k.ayatSalah, k.cadangan, k.penjelasan]),
          theme: 'striped',
          styles: { font: 'times', fontSize: 9 },
          headStyles: { fillColor: [200, 0, 0] }
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFillColor(245, 250, 250);
      doc.rect(margin, y, usableWidth, 25, 'F');
      doc.setTextColor(0, 61, 64);
      doc.setFont("times", "bold");
      doc.text("ULASAN KESELURUHAN:", margin + 3, y + 8);
      doc.setFont("times", "normal");
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      const ulasanSummary = cleanText(item.ulasan?.keseluruhan || "");
      const wrappedUlasan = doc.splitTextToSize(ulasanSummary, usableWidth - 6);
      doc.text(wrappedUlasan, margin + 3, y + 15);

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Keputusan ini dijana secara digital berasaskan sistem SI-PINTAR.", 105, 290, { align: "center" });
    });

    const filename = items.length === 1 ? `Laporan_${items[0].nama}.pdf` : `Laporan_Pukal.pdf`;
    doc.save(filename);
  };

  const handleQuickEditSet = async (id, currentSet) => {
    const newSet = prompt("Masukkan No. Set Baru:", currentSet);
    if (newSet !== null && newSet !== "") {
      await updateDoc(doc(db, 'karanganResults', id), { set: parseInt(newSet) });
      refreshData();
    }
  };

  if (loading) return <div className="loader-box"><div className="spinner"></div></div>;

  return (
    <div className="dashboard-wrapper">
      <aside className="main-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">SI</div>
          <div className="logo-text"><h3>SI-PINTAR</h3><span>VERSI GURU</span></div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-header">UTAMA</div>
          <div className={`nav-link ${viewMode === 'all' ? 'active' : ''}`} onClick={() => setViewMode('all')}>📊 Rekod Murid</div>
          <div className="nav-link" onClick={() => router.push('/trend')}>📈 Analisis Murid</div>
          
          <div className="nav-divider"></div>

          <div className="nav-header">PENGURUSAN</div>
          <div className="nav-link" onClick={() => router.push('/urus-kelas')}>🏫 Urus Kelas</div>
           <div className="nav-link" onClick={() => router.push('/beli-kredit')}>💰 Beli Kredit</div>
          <div className="nav-link" onClick={() => router.push('/profile')}>👤 Profil Guru</div>
          <div className="nav-divider"></div>

          <div className="nav-action-zone">
            <div className="nav-link highlight" onClick={() => router.push('/semak')}>✍️ Mulakan Semakan</div>
          </div>
        </nav>

        <button className="btn-logout-sidebar" onClick={() => signOut(auth)}>Keluar Sistem</button>
      </aside>

      <main className="main-viewport">
        <header className="viewport-header">
          <h1>Keputusan Karangan</h1>
          <div className="credit-badge">Baki Kredit: <b>{user?.credits}</b></div>
        </header>

        {/* --- MAIN DASHBOARD --- */}
        {viewMode === 'all' && (
          <div className="fade-in">
            <div className="pro-card toolbar-filters">
              <div className="t-group"><label>Cari Nama</label><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
              <div className="t-group"><label>Tahap</label><select value={selectedTahap} onChange={(e) => setSelectedTahap(e.target.value)}>{uniqueTahap.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div className="t-group"><label>Kelas</label><select value={selectedKelas} onChange={(e) => setSelectedKelas(e.target.value)}>{uniqueClasses.map(k => <option key={k} value={k}>{k}</option>)}</select></div>
              <div className="t-group"><label>Set</label><select value={selectedSet} onChange={(e) => setSelectedSet(e.target.value)}>{uniqueSets.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div className="layout-slider">
                <button className={layoutStyle === 'list' ? 'active' : ''} onClick={() => setLayoutStyle('list')}>Senarai</button>
                <button className={layoutStyle === 'grid' ? 'active' : ''} onClick={() => setLayoutStyle('grid')}>Grid</button>
              </div>
            </div>

            {layoutStyle === 'list' ? (
              <div className="pro-card no-padding">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{width:'40px'}}><input type="checkbox" onChange={(e) => setSelectedIds(e.target.checked ? sortedAndFilteredData.map(r => r.id) : [])} /></th>
                      <th>Nama Pelajar</th>
                      <th>Set</th>
                      <th>Tahap</th>
                      <th>Kelas</th>
                      <th>Markah</th>
                      <th style={{textAlign:'right'}}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAndFilteredData.map(item => (
                      <tr key={item.id} className={selectedIds.includes(item.id) ? 'active-row' : ''}>
                        <td><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id])} /></td>
                        <td className="st-name" onClick={() => router.push(`/pelajar/${item.nama}`)}>{item.nama}</td>
                        <td><span className="set-editable" onClick={() => handleQuickEditSet(item.id, item.set)}>{item.set || '-'}</span></td>
                        <td>{item.level}</td>
                        <td>{item.kelas || 'Umum'}</td>
                        <td className="st-score">{item.markahKeseluruhan}</td>
                        <td style={{textAlign:'right'}}><button className="btn-action" onClick={() => generatePDF([item])}>PDF</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="original-grid-system">
                {sortedAndFilteredData.map(item => (
                  <div key={item.id} className={`og-card ${selectedIds.includes(item.id) ? 'og-selected' : ''}`}>
                    <div className="og-header">
                      <span className="og-set" onClick={() => handleQuickEditSet(item.id, item.set)}>SET {item.set || '?'}</span>
                      <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id])} />
                    </div>
                    <h3 onClick={() => router.push(`/pelajar/${item.nama}`)}>{item.nama}</h3>
                    <p className="og-meta">{item.level} • {item.kelas || 'Umum'}</p>
                    <div className="og-score-box">
                      <div className="sc-item"><span>Isi</span><b>{item.markahIsi}</b></div>
                      <div className="sc-item"><span>Bhs</span><b>{item.markahBahasa}</b></div>
                      <div className="sc-item total"><span>Jumlah</span><b>{item.markahKeseluruhan}</b></div>
                    </div>
                    <button className="btn-og-print" onClick={() => generatePDF([item])}>Cetak Laporan</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- ACTION BAR --- */}
        <div className={`bulk-control-bar ${selectedIds.length > 0 ? 'visible' : ''}`}>
          <span><b>{selectedIds.length}</b> rekod dipilih</span>
          <div className="bc-actions">
            <button className="bc-btn print" onClick={() => generatePDF(results.filter(r => selectedIds.includes(r.id)))}>Cetak PDF</button>
            <button className="bc-btn delete" onClick={handleBulkDelete}>Padam</button>
            <button className="bc-close" onClick={() => setSelectedIds([])}>✕</button>
          </div>
        </div>
      </main>

      <style jsx>{`
        .dashboard-wrapper { display: flex; min-height: 100vh; background: #F2F6F6; font-family: 'Inter', sans-serif; color: #003D40; }
        .main-sidebar { width: 280px; background: #003D40; color: white; display: flex; flex-direction: column; padding: 2rem 1.5rem; position: sticky; top: 0; height: 100vh; }
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
        .nav-link.highlight:hover { background: #ffdf33; }
        
        .nav-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 1.5rem 10px; }
        .btn-logout-sidebar { margin-top: auto; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 10px; cursor: pointer; }

        .main-viewport { flex: 1; padding: 2.5rem 3.5rem; overflow-y: auto; }
        .viewport-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .viewport-header h1 { margin: 0; font-size: 1.8rem; color: #003D40; }
        .credit-badge { background: white; padding: 8px 16px; border-radius: 50px; border: 1px solid #E0E7E7; font-size: 0.85rem; }

        .pro-card { background: white; border-radius: 20px; border: 1px solid #E0E7E7; box-shadow: 0 4px 20px rgba(0,61,64,0.04); padding: 1.5rem; margin-bottom: 1.5rem; }
        .no-padding { padding: 0; overflow: hidden; }
        .toolbar-filters { display: flex; gap: 15px; align-items: flex-end; }
        .t-group { flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .t-group label { font-size: 0.65rem; font-weight: 800; color: #99AFAF; text-transform: uppercase; }
        .t-group input, .t-group select { padding: 10px; border-radius: 10px; border: 1px solid #E0E7E7; background: #F9FAFA; font-size: 0.9rem; width: 100%; }

        .layout-slider { background: #F0F4F4; padding: 4px; border-radius: 12px; display: flex; height: 42px; width: 220px; }
        .layout-slider button { flex: 1; border: none; background: transparent; cursor: pointer; border-radius: 8px; font-size: 0.8rem; transition: 0.2s; }
        .layout-slider button.active { background: white; font-weight: bold; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }

        .modern-table { width: 100%; border-collapse: collapse; }
        .modern-table th { background: #F9FAFA; padding: 15px 20px; text-align: left; font-size: 0.7rem; color: #99AFAF; border-bottom: 1px solid #E0E7E7; text-transform: uppercase; }
        .modern-table td { padding: 15px 20px; border-bottom: 1px solid #F0F4F4; font-size: 0.9rem; }
        .st-name { font-weight: 600; cursor: pointer; color: #003D40; }
        .st-score { font-weight: 800; color: #48A6A7; font-size: 1.1rem; }
        .set-editable { background: #003D40; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; cursor: pointer; }
        .active-row { background: #F0FBFB; }

        .original-grid-system { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .og-card { background: white; border-radius: 20px; padding: 1.8rem; border: 1px solid #E0E7E7; }
        .og-selected { border-color: #48A6A7; background: #F0FBFB; }
        .og-header { display: flex; justify-content: space-between; margin-bottom: 1rem; }
        .og-set { font-size: 0.75rem; font-weight: 900; color: #99AFAF; cursor: pointer; }
        .og-card h3 { margin: 0 0 5px; color: #003D40; cursor: pointer; }
        .og-meta { font-size: 0.85rem; color: #889999; margin-bottom: 1.5rem; }
        .og-score-box { display: flex; justify-content: space-between; background: #F9FAFA; padding: 15px; border-radius: 12px; margin-bottom: 1.5rem; }
        .sc-item { display: flex; flex-direction: column; align-items: center; }
        .sc-item span { font-size: 0.6rem; color: #99AFAF; text-transform: uppercase; }
        .sc-item b { font-size: 1rem; color: #003D40; }
        .sc-item.total b { color: #48A6A7; font-size: 1.2rem; }
        .btn-og-print { width: 100%; padding: 12px; background: #003D40; color: white; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; }

        .bulk-control-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(120px); background: #003D40; color: white; padding: 15px 30px; border-radius: 100px; display: flex; align-items: center; gap: 30px; transition: 0.4s; z-index: 1000; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
        .bulk-control-bar.visible { transform: translateX(-50%) translateY(0); }
        .bc-btn { border: none; padding: 8px 20px; border-radius: 50px; font-weight: bold; cursor: pointer; }
        .bc-btn.print { background: #48A6A7; color: white; }
        .bc-btn.delete { background: #E63946; color: white; }
        .bc-close { background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem; }
        
        .fade-in { animation: fadeIn 0.5s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}