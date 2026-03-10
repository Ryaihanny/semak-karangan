import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import Head from 'next/head';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AssignmentTracker() {
  const router = useRouter();
  const { id: assignmentId, classId } = router.query;

  const [assignment, setAssignment] = useState(null);
  const [studentStatuses, setStudentStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classNameDisplay, setClassNameDisplay] = useState('');

  useEffect(() => {
    if (assignmentId && classId) { fetchTrackerData(); }
  }, [assignmentId, classId]);

  const fetchTrackerData = async () => {
    try {
      setLoading(true);
      const cSnap = await getDoc(doc(db, 'classes', classId));
      if (cSnap.exists()) setClassNameDisplay(cSnap.data().className || classId);

      const aSnap = await getDoc(doc(db, 'assignments', assignmentId));
      if (!aSnap.exists()) return;
      setAssignment(aSnap.data());

      const sSnap = await getDocs(query(collection(db, 'students'), where('enrolledClasses', 'array-contains', classId)));
      const allStudents = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const rSnap = await getDocs(query(collection(db, 'karanganResults'), where('taskId', '==', assignmentId)));
      const allResults = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const statusMap = allStudents.map(student => {
        const result = allResults.find(r => r.studentId === student.id);
        
        // --- SYNC WITH STUDENT DASHBOARD ---
        const totalMissions = result?.kesalahanBahasa?.length || 0;
        const solvedMissions = result?.solvedMissions?.length || 0;
        
        let status = 'Belum Hantar';
        let progress = 0;

        if (result) {
          if (result.status === 'murni_completed') {
            status = 'Selesai';
            progress = 100;
          } else {
            status = 'Sedang Baiki';
            progress = totalMissions > 0 ? Math.round((solvedMissions / totalMissions) * 100) : 50;
          }
        }

        const mIsi = result?.pemarkahan?.isi || 0;
        const mBahasa = result?.pemarkahan?.bahasa || 0;
        const mTotal = result?.pemarkahan?.jumlah || 0;
        
        const isHighLevel = ['P5', 'P6'].includes(student.level);
        const maxIsi = isHighLevel ? 20 : 8;
        const maxBahasa = isHighLevel ? 20 : 7;
        const maxTotal = isHighLevel ? 40 : 15;

        return {
          ...student,
          checked: false,
          submissionId: result?.id || null,
          result: result || null,
          markahIsi: mIsi,
          markahBahasa: mBahasa,
          score: mTotal,
          maxIsi,
          maxBahasa,
          maxTotal,
          progress,
          status
        };
      }).sort((a, b) => b.progress - a.progress);

      setStudentStatuses(statusMap);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleFlash = async (studentId) => {
    try {
      const broadcastRef = doc(db, 'classes', classId, 'broadcast', 'activeSession');
      await setDoc(broadcastRef, { 
        targetStudentId: studentId, 
        updatedAt: serverTimestamp() 
      });
      alert("Skrin murid telah diflash! ⚡");
    } catch (e) {
      alert("Gagal menghantar isyarat flash.");
    }
  };

  const generatePDF = () => {
    const selectedStudents = studentStatuses.filter(s => s.checked && s.result);
    if (selectedStudents.length === 0) return alert("Sila pilih pelajar yang mempunyai hasil karangan.");

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

    selectedStudents.forEach((student, index) => {
      if (index > 0) doc.addPage();
      
      const item = {
        nama: student.nama || student.name || "Pelajar",
        level: student.level || "P6",
        kelas: classNameDisplay,
        set: student.result?.set || "-",
        markahIsi: student.markahIsi || 0,
        markahBahasa: student.markahBahasa || 0,
        markahKeseluruhan: student.score || 0,
        karangan: student.result?.karangan || student.result?.karanganAsal || "",
        kesalahanBahasa: student.result?.kesalahanBahasa || [],
        ulasan: student.result?.ulasan || "Tiada ulasan."
      };

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
      doc.text(`Kelas: ${item.kelas}`, 60, y);
      doc.text(`Set: ${item.set}`, 110, y);
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
              doc.setLineWidth(0.2);
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
        doc.text("ANALISIS KESALAHAN BAHASA:", margin, y);
        autoTable(doc, {
          startY: y + 2,
          head: [['Kategori', 'Kesalahan Asal', 'Ayat Betul (Penuh)', 'Penjelasan']],
          body: item.kesalahanBahasa.map(k => [
            cleanText(k.kategori || 'Umum'),
            cleanText(k.ayatSalah || k.kesalahan),
            cleanText(k.pembetulan || k.pembetulanPenjelasan),
            cleanText(k.penjelasan)
          ]),
          theme: 'grid',
          styles: { font: 'times', fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [200, 0, 0], textColor: [255, 255, 255] },
          columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 45 }, 2: { cellWidth: 55, textColor: [0, 100, 0] }, 3: { cellWidth: 45 } }
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
      const ulasanSummary = typeof item.ulasan === 'object' ? cleanText(item.ulasan?.keseluruhan || "") : cleanText(item.ulasan);
      const wrappedUlasan = doc.splitTextToSize(ulasanSummary, usableWidth - 6);
      doc.text(wrappedUlasan, margin + 3, y + 15);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Keputusan ini dijana secara digital berasaskan sistem SI-PINTAR.", 105, 290, { align: "center" });
    });
    doc.save(`Koleksi_Laporan_${classNameDisplay.replace(/[^a-z0-9]/gi, '_')}.pdf`);
  };

  if (loading) return <div style={{padding:'50px', textAlign:'center'}}>Memuat naik data...</div>;

  return (
    <div className="tracker-root">
      <Head>
        <title>Pantauan Tugasan | {assignment?.title}</title>
      </Head>

      <header className="tracker-header">
        <div className="inner">
          <div className="header-left">
            <button className="btn-back" onClick={() => router.push(`/Class/${classId}`)}>← Kembali ke Kelas</button>
            <div className="header-info" style={{marginTop: '10px'}}>
               <span className="class-label">{classNameDisplay}</span>
               <h1>{assignment?.title}</h1>
            </div>
          </div>
          <button className="btn-main" onClick={generatePDF}>📥 Cetak Laporan PDF ({studentStatuses.filter(s => s.checked).length})</button>
        </div>
      </header>

      <main className="tracker-content">
        <div className="stats-bar">
           <div className="stat-item">
              <span className="stat-value">{studentStatuses.length}</span>
              <span className="stat-label">Jumlah Murid</span>
           </div>
           <div className="stat-item">
              <span className="stat-value">{studentStatuses.filter(s => s.status === 'Selesai').length}</span>
              <span className="stat-label">Selesai</span>
           </div>
        </div>

        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th width="40"><input type="checkbox" onChange={(e) => setStudentStatuses(prev => prev.map(s => ({...s, checked: s.submissionId ? e.target.checked : false})))} /></th>
                <th>Nama Pelajar</th>
                <th>Status & Progres Misi</th>
                <th>Markah (Isi/Bhs/Jml)</th>
                <th align="right">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {studentStatuses.map((s, idx) => (
                <tr key={s.id} className={s.status === 'Selesai' ? 'row-done' : ''}>
                  <td><input type="checkbox" checked={s.checked} disabled={!s.submissionId} onChange={(e) => { const u = [...studentStatuses]; u[idx].checked = e.target.checked; setStudentStatuses(u); }} /></td>
                  <td>
                    <div className="name-cell">
                      <span className="student-name">{s.nama || s.name}</span>
                      <span className="student-level">Level {s.level}</span>
                    </div>
                  </td>
                  <td>
                    <div className="status-progress-cell">
                      <div className="tag-row">
                        <span className={`status-tag ${s.status === 'Selesai' ? 'done' : s.status === 'Sedang Baiki' ? 'work' : 'none'}`}>{s.status}</span>
                        <span className="pct-text">{s.progress}%</span>
                      </div>
                      <div className="mini-progress-bg"><div className="mini-progress-fill" style={{ width: `${s.progress}%` }}></div></div>
                    </div>
                  </td>
                  <td>
                    {s.submissionId ? (
                      <div className="marks-grid">
                         <div className="mark-sub">Isi <b>{s.markahIsi}</b>/{s.maxIsi}</div>
                         <div className="mark-sub">Bhs <b>{s.markahBahasa}</b>/{s.maxBahasa}</div>
                         <div className="mark-total">Jml <b>{s.score}</b>/{s.maxTotal}</div>
                      </div>
                    ) : <span className="no-data">—</span>}
                  </td>
                  <td align="right">
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      {s.submissionId && (
                        <>
                          <button className="btn-detail" onClick={() => handleFlash(s.id)} title="Flash skrin murid ini">⚡ Flash</button>
                          <button className="btn-detail" onClick={() => router.push(`/analisis/${s.submissionId}?mode=teacher&classId=${classId}`)}>Lihat Analisis</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <style jsx>{`
        .tracker-root { background: #F4F7F7; min-height: 100vh; font-family: 'Plus Jakarta Sans', sans-serif; color: #2D3436; }
        .tracker-header { background: #003D40; color: white; padding: 60px 20px 80px; }
        .inner { max-width: 1100px; margin: 0 auto; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-left { display: flex; flex-direction: column; gap: 15px; }
        .btn-back { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; width: fit-content; }
        .class-label { color: #48A6A7; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; font-size: 0.85rem; }
        h1 { margin: 5px 0 0; font-size: 2rem; font-weight: 800; }
        .btn-main { background: #48A6A7; color: white; border: none; padding: 14px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px rgba(72, 166, 167, 0.4); transition: transform 0.2s; }
        .btn-main:hover { transform: translateY(-2px); }
        .tracker-content { max-width: 1100px; margin: -40px auto 40px; padding: 0 20px; }
        .stats-bar { display: flex; gap: 20px; margin-bottom: 20px; }
        .stat-item { background: white; padding: 15px 25px; border-radius: 12px; display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .stat-value { font-size: 1.5rem; font-weight: 800; color: #003D40; }
        .stat-label { color: #636E72; font-size: 0.9rem; font-weight: 600; }
        .table-card { background: white; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #F8FAFA; padding: 20px; text-align: left; font-size: 0.8rem; text-transform: uppercase; color: #636E72; letter-spacing: 0.05em; border-bottom: 2px solid #F0F4F4; }
        td { padding: 20px; border-bottom: 1px solid #F0F4F4; vertical-align: middle; }
        .name-cell { display: flex; flex-direction: column; }
        .student-name { font-weight: 700; font-size: 1.05rem; color: #2D3436; }
        .student-level { font-size: 0.75rem; color: #B2BEC3; font-weight: 700; }
        .status-progress-cell { display: flex; flex-direction: column; gap: 8px; width: 180px; }
        .tag-row { display: flex; justify-content: space-between; align-items: center; }
        .pct-text { font-size: 0.75rem; font-weight: 800; color: #003D40; }
        .status-tag { padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; width: fit-content; }
        .status-tag.done { background: #E6F4F4; color: #00767B; }
        .status-tag.work { background: #FFF7ED; color: #D97706; }
        .status-tag.none { background: #F5F6F7; color: #B2BEC3; }
        .mini-progress-bg { width: 100%; height: 6px; background: #F0F2F2; border-radius: 10px; overflow: hidden; }
        .mini-progress-fill { height: 100%; background: #48A6A7; transition: width 0.5s ease; }
        .marks-grid { display: flex; gap: 12px; align-items: center; font-size: 0.9rem; color: #636E72; }
        .marks-grid b { color: #003D40; }
        .mark-total { background: #F0F9F9; padding: 4px 10px; border-radius: 6px; color: #003D40; border: 1px solid #D1E7E8; }
        .btn-detail { background: white; border: 1px solid #E2E8F0; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
        .btn-detail:hover { background: #003D40; color: white; border-color: #003D40; }
        .no-data { color: #DFE6E9; font-weight: 800; }
        .row-done { background: #FBFFFF; }
      `}</style>
    </div>
  );
}