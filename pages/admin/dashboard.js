import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { 
  doc, getDoc, updateDoc, collection, 
  query, where, getDocs, orderBy, writeBatch, deleteDoc 
} from 'firebase/firestore'; 
import Head from 'next/head';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- CHART.JS ---
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, 
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function AdminMasterDashboard() {
  const router = useRouter();
  
  // -- APP STATE --
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(true); 
  const [activeTab, setActiveTab] = useState('users'); 

  // -- DATA STATE --
  const [allUsers, setAllUsers] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [allAssignments, setAllAssignments] = useState([]);
  const [myResults, setMyResults] = useState([]);
  const [allResults, setAllResults] = useState([]); 
  const [selectedTeacherStats, setSelectedTeacherStats] = useState(null); 
  const [layoutStyle, setLayoutStyle] = useState('list');
  const [selectedResultsIds, setSelectedResultsIds] = useState([]);
  
  // -- SELECTION & SEARCH --
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState([]);

  // -- NEW FILTER STATE FOR KEPUTUSAN --
  const [selectedTahap, setSelectedTahap] = useState('Semua Tahap');
  const [selectedKelas, setSelectedKelas] = useState('Semua Kelas');
  const [selectedSet, setSelectedSet] = useState('Semua Set');

const [allStudents, setAllStudents] = useState([]); // Add this line

  // 1. BOOTSTRAP DATA
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { router.replace('/login'); return; }
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      
      if (userData?.role !== 'admin') { router.replace('/dashboard'); return; }
      
      setUser({ uid: currentUser.uid, ...userData });
      await loadSystemData();
      await loadGuruData(currentUser.uid);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

const loadSystemData = async () => {
    // 1. Added sSnap to the array below
    // 2. Added the missing commas
    const [uSnap, cSnap, aSnap, rSnap, sSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'classes')),
      getDocs(collection(db, 'assignments')),
      getDocs(collection(db, 'karanganResults')), 
      getDocs(collection(db, 'students'))
    ]);

    setAllUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setAllClasses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setAllAssignments(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setAllResults(rSnap.docs.map(d => ({ id: d.id, ...d.data() }))); 
    setAllStudents(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const loadGuruData = async (uid) => {
    const rSnap = await getDocs(query(collection(db, 'karanganResults'), where('userId', '==', uid), orderBy('timestamp', 'desc')));
    setMyResults(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  // 2. ACTIONS
  const handleBulkCreditUpdate = async () => {
    const amountStr = prompt(`Tambah kredit untuk ${selectedUserIds.length} pengguna:`, "10");
    if (!amountStr || isNaN(amountStr)) return;
    
    const amountPerPerson = parseInt(amountStr);
    const totalNeeded = amountPerPerson * selectedUserIds.length;

    if ((user.credits || 0) < totalNeeded) {
        alert(`Kredit anda tidak mencukupi! Perlu: ${totalNeeded}, Baki anda: ${user.credits}`);
        return;
    }

    const batch = writeBatch(db);
    const adminRef = doc(db, 'users', user.uid);
    batch.update(adminRef, { credits: (user.credits - totalNeeded) });

    selectedUserIds.forEach(uId => {
      const currentU = allUsers.find(u => u.id === uId);
      batch.update(doc(db, 'users', uId), { credits: (currentU.credits || 0) + amountPerPerson });
    });

    await batch.commit();
    alert(`Berjaya! ${totalNeeded} kredit telah ditolak dari akaun anda.`);
    
    setSelectedUserIds([]);
    loadSystemData();
    const updatedAdmin = await getDoc(adminRef);
    setUser({ uid: user.uid, ...updatedAdmin.data() });
  };

  const handleMakeAdmin = async (uId) => {
    if (confirm("Jadikan pengguna ini sebagai ADMIN? Tindakan ini tidak boleh diundur.")) {
        await updateDoc(doc(db, 'users', uId), { role: 'admin' });
        loadSystemData();
    }
  };

  const handleDeleteAssignment = async (id) => {
    if(confirm("Padam tugasan ini secara kekal?")) {
      await deleteDoc(doc(db, 'assignments', id));
      loadSystemData();
    }
  };

  const handleBulkDeleteAssignments = async () => {
  if (confirm(`Padam ${selectedAssignmentIds.length} tugasan terpilih secara kekal?`)) {
    const batch = writeBatch(db);
    selectedAssignmentIds.forEach(id => {
      batch.delete(doc(db, 'assignments', id));
    });
    await batch.commit();
    setSelectedAssignmentIds([]);
    loadSystemData();
  }
};

  // ANALYTICS CALCULATOR
const getTeacherInsights = (teacherUid) => {
  try {
    // 1. Find teacher (using .uid per your Firestore screenshot)
    const teacher = allUsers?.find(u => u.uid === teacherUid || u.id === teacherUid) || {};

    // 2. Date Handling (Requirement 1 & 6)
    // Your 'createdAt' is a STRING, so we don't use .toDate()
    const createdDate = teacher?.createdAt 
      ? new Date(teacher.createdAt).toLocaleDateString('ms-MY') 
      : 'Tiada Data';
    
    // 'lastActive' might be a Timestamp or String, let's be safe
    let lastActive = 'Tiada Data';
    if (teacher?.lastActive) {
      lastActive = teacher.lastActive.toDate 
        ? teacher.lastActive.toDate().toLocaleString('ms-MY') 
        : new Date(teacher.lastActive).toLocaleString('ms-MY');
    }

    // 3. Classes (Requirement 2)
    const teacherClasses = allClasses?.filter(c => c.teacherId === teacherUid) || [];
    const classIds = teacherClasses.map(c => c.id);

    // 4. Assignments (Requirement 3)
    const teacherAssignments = allAssignments?.filter(a => a.teacherId === teacherUid) || [];

    // 5. Students (Requirement 5)
    // Check if any ID in the 'enrolledClasses' array matches our classIds
    const teacherStudents = allStudents?.filter(s => 
      Array.isArray(s.enrolledClasses) && s.enrolledClasses.some(id => classIds.includes(id))
    ) || [];

    // 6. Semakan AI (Requirement 4)
    // Total = Checks by Teacher UID + Checks by Students' Usernames
    const studentUsernames = teacherStudents.map(s => s.username).filter(Boolean);
    const totalSemakan = allResults?.filter(r => 
      r.userId === teacherUid || 
      (r.studentId && studentUsernames.includes(r.studentId))
    ).length || 0;

    // 7. Average Students (Requirement 5)
    const avgMurid = teacherClasses.length > 0 
      ? (teacherStudents.length / teacherClasses.length).toFixed(1) 
      : 0;

    return {
      created: createdDate,
      lastActive: lastActive,
      classes: teacherClasses.length,
      assignments: teacherAssignments.length,
      totalChecks: totalSemakan,
      avgStudents: avgMurid
    };
  } catch (err) {
    console.error("Critical Analysis Error:", err);
    return { created: 'Error Logic', lastActive: 'Error Logic', classes: 0, assignments: 0, totalChecks: 0, avgStudents: 0 };
  }
};

  const uniqueTahap = useMemo(() => ['Semua Tahap', ...new Set(myResults.map(r => r.level).filter(Boolean))], [myResults]);
  const uniqueClasses = useMemo(() => ['Semua Kelas', ...new Set(myResults.map(r => r.kelas).filter(Boolean))], [myResults]);
  const uniqueSets = useMemo(() => ['Semua Set', ...new Set(myResults.map(r => r.set).filter(Boolean))], [myResults]);

  const sortedAndFilteredData = useMemo(() => {
    return myResults.filter(item => {
      const matchSearch = item.nama?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTahap = selectedTahap === 'Semua Tahap' || item.level === selectedTahap;
      const matchKelas = selectedKelas === 'Semua Kelas' || item.kelas === selectedKelas;
      const matchSet = selectedSet === 'Semua Set' || item.set === selectedSet;
      return matchSearch && matchTahap && matchKelas && matchSet;
    }).sort((a, b) => a.nama.localeCompare(b.nama));
  }, [myResults, searchQuery, selectedTahap, selectedKelas, selectedSet]);

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
          head: [['Kategori', 'Ayat Salah', 'Pembetulan', 'Penjelasan']],
          body: item.kesalahanBahasa.map(k => [
            cleanText(k.kategori || 'Umum'),
            cleanText(k.ayatSalah),
            cleanText(k.pembetulan || k.cadangan),
            cleanText(k.penjelasan)
          ]),
          theme: 'grid',
          styles: { font: 'times', fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [200, 0, 0], textColor: [255, 255, 255] },
          columnStyles: { 
            0: { cellWidth: 25 },
            1: { cellWidth: 45 },
            2: { cellWidth: 55, textColor: [0, 100, 0], fontStyle: 'bold' },
            3: { cellWidth: 45 }
          }
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


  // 3. HELPERS 
  const getTeacherName = (tId) => allUsers.find(u => u.id === tId)?.nama || "Guru Tidak Ditemui";
  
  const chartData = useMemo(() => {
    const sorted = [...myResults].reverse();
    return {
      labels: sorted.slice(-10).map(r => r.nama),
      datasets: [{
        label: 'Markah (%)',
        data: sorted.slice(-10).map(r => r.markahKeseluruhan),
        borderColor: '#48a6a7',
        backgroundColor: 'rgba(72, 166, 167, 0.1)',
        fill: true, tension: 0.4,
      }]
    };
  }, [myResults]);

  if (loading) return <div className="loader-box">Memuatkan Sistem Pentadbir...</div>;

  return (
    <div className="dashboard-wrapper">
      <Head><title>Master Dashboard | SI-PINTAR</title></Head>

      <aside className="main-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">SI</div>
          <div className="logo-text"><h3>SI-PINTAR</h3><span>ADMIN PORTAL</span></div>
        </div>

        <div className="mode-switcher-container">
           <button className={isAdminMode ? 'active' : ''} onClick={() => {setIsAdminMode(true); setActiveTab('users')}}>🛡️ Admin View</button>
           <button className={!isAdminMode ? 'active' : ''} onClick={() => {setIsAdminMode(false); setActiveTab('trend')}}>👨‍🏫 Guru View</button>
        </div>

<nav className="sidebar-nav">
  {isAdminMode ? (
    <>
      <div className="nav-header">SYSTEM CONTROL</div>
      <div className={`nav-link ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>👥 Database Pengguna</div>
      <div className={`nav-link ${activeTab === 'classes' ? 'active' : ''}`} onClick={() => setActiveTab('classes')}>🏫 Semua Kelas</div>
      <div className={`nav-link ${activeTab === 'assignments' ? 'active' : ''}`} onClick={() => setActiveTab('assignments')}>📋 Tugasan Guru</div>
    </>
  ) : (
    <>
      <div className="nav-header">UTAMA</div>
      <div className={`nav-link ${activeTab === 'rekod_murid' ? 'active' : ''}`} onClick={() => setActiveTab('rekod_murid')}>📊 Keputusan Murid</div>
      <div className={`nav-link ${activeTab === 'trend' ? 'active' : ''}`} onClick={() => setActiveTab('trend')}>📈 Analisis Murid</div>
      <div className="nav-link" onClick={() => router.push('/admin/semak')}>✍️ Semak Karangan</div>
      <div className="nav-divider"></div>
      <div className="nav-header">PENGURUSAN</div>
      <div className="nav-link" onClick={() => router.push('/admin/urus-kelas')}>🏫 Urus Kelas</div>
      <div className="nav-link" onClick={() => router.push('/admin/profile')}>👤 Profil Guru</div>
    </>
  )}
</nav>

        <button className="btn-logout-sidebar" onClick={() => signOut(auth)}>Keluar Sistem</button>
      </aside>

      <main className="main-viewport">
        <header className="viewport-header">
          <h1>
            {isAdminMode ? 'Master Control' : activeTab === 'rekod_murid' ? 'Keputusan Karangan' : 'Analisis Prestasi'}
          </h1>
          <div style={{display: 'flex', gap: '20px', alignItems: 'center'}}>
            <div className="credit-badge">Baki Kredit: <b>{user?.credits}</b></div>
            <div className="global-search-container">
              <input type="text" placeholder="Cari..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </header>

        <div className="fade-in">
          {/* TAB: USERS */}
          {isAdminMode && activeTab === 'users' && (
            <>
              {selectedUserIds.length > 0 && (
                <div className="bulk-action-bar">
                  <span><b>{selectedUserIds.length}</b> dipilih</span>
                  <button onClick={handleBulkCreditUpdate} className="btn-bulk">+ Tambah Kredit Pukal</button>
                </div>
              )}
              <div className="pro-card no-padding">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{width: '40px'}}><input type="checkbox" onChange={(e) => setSelectedUserIds(e.target.checked ? allUsers.map(u => u.id) : [])} /></th>
                      <th>Nama Guru</th>
                      <th>Email Address</th>
                      <th>Peranan</th>
                      <th>Kredit</th>
                      <th style={{textAlign:'right'}}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                   {allUsers.filter(u => u.nama?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email?.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
  <tr key={u.id} className={selectedUserIds.includes(u.id) ? 'active-row' : ''}>
    {/* First Column: Checkbox */}
    <td>
      <input 
        type="checkbox" 
        checked={selectedUserIds.includes(u.id)} 
        onChange={() => setSelectedUserIds(prev => prev.includes(u.id) ? prev.filter(i => i !== u.id) : [...prev, u.id])} 
      />
    </td>

    {/* Second Column: Name & Analytics Trigger */}
    <td 
      style={{ cursor: 'pointer' }}
      onClick={() => {
        const targetId = u.uid || u.id; 
        const stats = getTeacherInsights(targetId);
        setSelectedTeacherStats({ nama: u.nama || u.username, data: stats });
      }}
    >
      <div className="teacher-name-cell">
        <strong>{u.nama || u.username || 'Tiada Nama'}</strong>
        <br/>
        <span className="analisis-trigger" style={{fontSize: '11px', color: '#00695C'}}>
          📊 Analisis Penggunaan
        </span>
      </div>
    </td>

    {/* Remaining Columns */}
    <td><small>{u.email}</small></td>
    <td><span className={`tag ${u.role}`}>{u.role}</span></td>
    <td><span className="credit-pill">{u.credits || 0}</span></td>
    <td style={{textAlign:'right', display:'flex', gap:'5px', justifyContent:'flex-end'}}>
      {u.role !== 'admin' && (
        <button className="btn-action" style={{background: '#00695C'}} onClick={() => handleMakeAdmin(u.id)}>Admin</button>
      )}
      <button className="btn-action" onClick={() => sendPasswordResetEmail(auth, u.email)}>Reset</button>
    </td>
  </tr>
))}

                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TAB: CLASSES */}
          {isAdminMode && activeTab === 'classes' && (
            <>
              <div className="quick-stats-row">
                <div className="stat-item"><b>{allClasses.length}</b> Jumlah Kelas</div>
                <div className="stat-item"><b>{new Set(allClasses.map(c => c.teacherId)).size}</b> Guru Aktif</div>
              </div>
              <div className="class-grid-system">
                {allClasses.map(c => (
                  <div key={c.id} className="pro-card class-card">
                    <div className="class-badge">{c.level}</div>
                    <h3>{c.className}</h3>
                    <p>Guru: <b>{getTeacherName(c.teacherId)}</b></p>
                    <div className="class-footer">
                      <code>{c.classCode}</code>
                      <span>{allAssignments.filter(a => a.classId === c.id).length} Tugasan</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* TAB: ASSIGNMENTS */}
          {isAdminMode && activeTab === 'assignments' && (
            <>
              {selectedAssignmentIds.length > 0 && (
                <div className="bulk-action-bar" style={{ background: '#C62828' }}>
                  <span><b>{selectedAssignmentIds.length}</b> tugasan dipilih</span>
                  <button onClick={handleBulkDeleteAssignments} className="btn-bulk" style={{ background: 'white', color: '#C62828' }}>
                    🗑️ Padam Pukal
                  </button>
                </div>
              )}
              <div className="pro-card no-padding">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{width: '40px'}}>
                        <input 
                          type="checkbox" 
                          onChange={(e) => setSelectedAssignmentIds(e.target.checked ? allAssignments.map(a => a.id) : [])} 
                        />
                      </th>
                      <th>Tugasan</th>
                      <th>Kelas / Guru</th>
                      <th>Status</th>
                      <th style={{textAlign:'right'}}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allAssignments.map(a => {
                      const isLate = a.dueDate && new Date(a.dueDate) < new Date();
                      return (
                        <tr key={a.id} className={selectedAssignmentIds.includes(a.id) ? 'active-row' : ''}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedAssignmentIds.includes(a.id)} 
                              onChange={() => setSelectedAssignmentIds(prev => prev.includes(a.id) ? prev.filter(i => i !== a.id) : [...prev, a.id])} 
                            />
                          </td>
                          <td><strong>{a.title}</strong><br/><small>Deadline: {a.dueDate || 'N/A'}</small></td>
                          <td>
                            {allClasses.find(c => c.id === a.classId)?.className || '-'}<br/>
                            <small>Oleh: {getTeacherName(a.teacherId)}</small>
                          </td>
                          <td>
                            <span className={`status-pill ${isLate ? 'late' : 'active'}`}>
                              {isLate ? 'Tamat Tempoh' : 'Aktif'}
                            </span>
                          </td>
                          <td style={{textAlign:'right'}}>
                            <button className="btn-delete-small" onClick={() => handleDeleteAssignment(a.id)}>Padam</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TAB: KEPUTUSAN MURID */}
          {!isAdminMode && activeTab === 'rekod_murid' && (
            <div className="fade-in">
              <div className="pro-card toolbar-filters">
                <div className="t-group">
                  <label>Tahap</label>
                  <select value={selectedTahap} onChange={(e) => setSelectedTahap(e.target.value)}>
                    {uniqueTahap.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="t-group">
                  <label>Kelas</label>
                  <select value={selectedKelas} onChange={(e) => setSelectedKelas(e.target.value)}>
                    {uniqueClasses.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div className="t-group">
                  <label>Set</label>
                  <select value={selectedSet} onChange={(e) => setSelectedSet(e.target.value)}>
                    {uniqueSets.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
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
                        <th style={{width:'40px'}}><input type="checkbox" onChange={(e) => setSelectedResultsIds(e.target.checked ? sortedAndFilteredData.map(r => r.id) : [])} /></th>
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
                        <tr key={item.id} className={selectedResultsIds.includes(item.id) ? 'active-row' : ''}>
                          <td><input type="checkbox" checked={selectedResultsIds.includes(item.id)} onChange={() => setSelectedResultsIds(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id])} /></td>
                          <td className="st-name" style={{fontWeight: 600, color: '#48A6A7', cursor: 'pointer'}} onClick={() => router.push(`/pelajar/${item.nama}`)}>{item.nama}</td>
                          <td>{item.set || '-'}</td>
                          <td>{item.level}</td>
                          <td>{item.kelas || 'Umum'}</td>
                          <td><b style={{fontSize: '1.1rem'}}>{item.markahKeseluruhan}</b></td>
                          <td style={{textAlign:'right'}}><button className="btn-action" onClick={() => generatePDF([item])}>PDF</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="original-grid-system">
                  {sortedAndFilteredData.map(item => (
                    <div key={item.id} className={`og-card ${selectedResultsIds.includes(item.id) ? 'og-selected' : ''}`}>
                      <div className="og-header">
                        <span className="og-set">SET {item.set || '?'}</span>
                        <input type="checkbox" checked={selectedResultsIds.includes(item.id)} onChange={() => setSelectedResultsIds(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id])} />
                      </div>
                      <h3 style={{cursor: 'pointer'}} onClick={() => router.push(`/pelajar/${item.nama}`)}>{item.nama}</h3>
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
              
              <div className={`bulk-action-bar floating-bar ${selectedResultsIds.length > 0 ? 'visible' : ''}`}>
                <span><b>{selectedResultsIds.length}</b> rekod dipilih</span>
                <div style={{display: 'flex', gap: '10px'}}>
                   <button className="btn-bulk" onClick={() => generatePDF(myResults.filter(r => selectedResultsIds.includes(r.id)))}>Cetak PDF Pukal</button>
                   <button className="btn-close" onClick={() => setSelectedResultsIds([])} style={{background:'transparent', border:'none', color:'white', cursor:'pointer'}}>✕</button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TREND */}
          {!isAdminMode && activeTab === 'trend' && (
            <div className="pro-card chart-container">
              <h3>Prestasi Murid (10 Terkini)</h3>
              <div style={{height: '400px'}}><Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} /></div>
            </div>
          )}
        </div>
      </main>

      {/* --- DRILL DOWN MODAL (PLACED AT BOTTOM FOR PROPER Z-INDEX) --- */}
     {selectedTeacherStats && (
  <div className="modal-overlay" onClick={() => setSelectedTeacherStats(null)}>
    <div className="insights-modal" onClick={e => e.stopPropagation()}>
      <div style={{ borderBottom: '2px solid #004D40', marginBottom: '20px', paddingBottom: '10px' }}>
        <h2 style={{ color: '#004D40', margin: 0 }}>Analisis Akaun Guru</h2>
        <p style={{ color: '#666', margin: 0 }}>{selectedTeacherStats.nama}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        {/* Row 1: Dates */}
        <div className="stat-box">
          <label>Akaun Dicipta</label>
          <div className="val-small">{selectedTeacherStats.data.created}</div>
        </div>
        <div className="stat-box">
          <label>Sesi Terakhir</label>
          <div className="val-small">{selectedTeacherStats.data.lastActive}</div>
        </div>

        {/* Row 2: Management */}
        <div className="stat-box">
          <label>Jumlah Kelas</label>
          <div className="val-big">{selectedTeacherStats.data.classes}</div>
        </div>
        <div className="stat-box">
          <label>Tugasan Dibuat</label>
          <div className="val-big">{selectedTeacherStats.data.assignments}</div>
        </div>

        {/* Row 3: Performance */}
        <div className="stat-box highlight-green">
          <label>Total Semakan AI</label>
          <div className="val-big">{selectedTeacherStats.data.totalChecks}</div>
          <small>(Guru + Murid)</small>
        </div>
        <div className="stat-box highlight-blue">
          <label>Purata Murid</label>
          <div className="val-big">{selectedTeacherStats.data.avgStudents}</div>
          <small>Per Kelas</small>
        </div>
      </div>

      <button className="close-btn" onClick={() => setSelectedTeacherStats(null)}>
        Tutup Analisis
      </button>
    </div>
  </div>
)}

      <style jsx>{`
        .dashboard-wrapper { display: flex; min-height: 100vh; background: #F2F6F6; color: #003D40; font-family: 'Inter', sans-serif; }
        .main-sidebar { width: 280px; background: #003D40; color: white; display: flex; flex-direction: column; padding: 2rem 1.5rem; position: sticky; top: 0; height: 100vh; }
        .sidebar-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 2rem; }
        .logo-icon { background: #FFD700; color: #003D40; font-weight: 900; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        
        .mode-switcher-container { display: flex; background: rgba(255,255,255,0.05); padding: 5px; border-radius: 12px; margin-bottom: 1.5rem; }
        .mode-switcher-container button { flex: 1; border: none; background: transparent; color: white; padding: 8px; font-size: 0.75rem; font-weight: bold; cursor: pointer; border-radius: 8px; transition: all 0.3s; }
        .mode-switcher-container button.active { background: #48A6A7; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }

        .sidebar-nav { flex: 1; }
        .nav-header { font-size: 0.7rem; color: #48A6A7; font-weight: 800; letter-spacing: 1px; margin: 1.5rem 0 0.5rem; }
        .nav-link { padding: 12px 15px; border-radius: 10px; cursor: pointer; font-size: 0.9rem; transition: 0.2s; color: rgba(255,255,255,0.7); }
        .nav-link:hover { background: rgba(255,255,255,0.1); color: white; }
        .nav-link.active { background: #48A6A7; color: white; font-weight: bold; }

        .main-viewport { flex: 1; padding: 2rem; overflow-y: auto; }
        .viewport-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        
        .pro-card { background: white; border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 20px rgba(0,61,64,0.05); }
        .pro-card.no-padding { padding: 0; overflow: hidden; }

        .modern-table { width: 100%; border-collapse: collapse; }
        .modern-table th { background: #F8FBFA; padding: 15px; text-align: left; font-size: 0.85rem; color: #00695C; border-bottom: 2px solid #E0EDED; }
        .modern-table td { padding: 15px; border-bottom: 1px solid #F0F5F5; font-size: 0.9rem; vertical-align: middle; }
        .modern-table tr:hover { background: #F9FCFC; }

.stat-box {
  padding: 15px;
  background: #fdfdfd;
  border: 1px solid #eee;
  border-radius: 10px;
  text-align: center;
}
.stat-box label {
  display: block;
  font-size: 0.7rem;
  color: #777;
  text-transform: uppercase;
  font-weight: bold;
}
.val-big {
  font-size: 1.6rem;
  font-weight: 800;
  color: #333;
}
.val-small {
  font-size: 0.85rem;
  font-weight: 600;
  color: #444;
  margin-top: 5px;
}
.highlight-green { background: #E8F5E9 !important; border-color: #C8E6C9 !important; }
.highlight-green .val-big { color: #2E7D32; }
.highlight-blue { background: #E3F2FD !important; border-color: #BBDEFB !important; }
.highlight-blue .val-big { color: #1565C0; }
.close-btn {
  margin-top: 20px;
  width: 100%;
  padding: 12px;
  background: #333;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

        .teacher-name-cell { transition: transform 0.2s; }
        .teacher-name-cell:hover { transform: translateX(5px); }
        .analisis-trigger { color: #48A6A7; font-size: 0.75rem; font-weight: bold; text-decoration: underline; opacity: 0.8; }
        .analisis-trigger:hover { opacity: 1; }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 30, 30, 0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .insights-modal { width: 100%; max-width: 600px; animation: modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes modalPop { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }

        .insights-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 15px; }
        .insight-box { background: #F8FBFA; border: 1px solid #E0EDED; padding: 15px; border-radius: 12px; text-align: center; }
        .insight-box span { display: block; font-size: 0.7rem; color: #666; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
        .insight-box strong { font-size: 1.1rem; color: #003D40; }
        .insight-box.highlight { background: #E0F2F1; border-color: #48A6A7; }
        .insight-box.highlight strong { color: #00796B; }

        .tag { padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; }
        .tag.admin { background: #E0F2F1; color: #00796B; }
        .tag.guru { background: #FFF9C4; color: #F57F17; }
        .credit-pill { background: #003D40; color: white; padding: 4px 12px; border-radius: 10px; font-weight: bold; font-size: 0.8rem; }
        
        .btn-action { border: none; background: #48A6A7; color: white; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; }
        .btn-logout-sidebar { margin-top: auto; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 12px; border-radius: 10px; cursor: pointer; transition: 0.3s; }
        .btn-logout-sidebar:hover { background: #C62828; }
      `}</style>
    </div>
  );
}