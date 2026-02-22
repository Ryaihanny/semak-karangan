import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, 
  PointElement, LineElement, Title, Tooltip, Legend, Filler 
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function TrendAnalysis() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);

  // --- Filter States (Sama seperti dashboard.js) ---
  const [selectedKelas, setSelectedKelas] = useState('Semua');
  const [selectedTahap, setSelectedTahap] = useState('Semua');
  const [selectedStudent, setSelectedStudent] = useState('Semua');
  const [graphMetric, setGraphMetric] = useState('markahKeseluruhan');

  // --- Auth & Data Fetching ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { router.replace('/login'); return; }
      const userDocSnap = await getDoc(doc(db, 'users', currentUser.uid));
      setUser({ uid: currentUser.uid, ...userDocSnap?.data() });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchData = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, 'karanganResults'), 
        where('userId', '==', auth.currentUser.uid), 
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      setResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  useEffect(() => { if (user?.uid) fetchData(); }, [user]);

  // --- Analisis Prestasi Logic ---
  const uniqueClasses = useMemo(() => ['Semua', ...new Set(results.map(r => r.kelas).filter(Boolean))], [results]);
  const uniqueTahap = useMemo(() => ['Semua', ...new Set(results.map(r => r.level))], [results]);
  const studentList = useMemo(() => [...new Set(results.map(r => r.nama))], [results]);

  const sortedAndFilteredData = useMemo(() => {
    return results
      .filter(item => {
        const matchStudent = selectedStudent === 'Semua' || item.nama === selectedStudent;
        const matchKelas = selectedKelas === 'Semua' || item.kelas === selectedKelas;
        const matchTahap = selectedTahap === 'Semua' || item.level === selectedTahap;
        return matchStudent && matchKelas && matchTahap;
      })
      .sort((a, b) => {
        if (a.level !== b.level) return a.level.localeCompare(b.level);
        if ((a.kelas || "") !== (b.kelas || "")) return (a.kelas || "").localeCompare(b.kelas || "");
        if ((a.set || 0) !== (b.set || 0)) return (a.set || 0) - (b.set || 0);
        return a.nama.localeCompare(b.nama);
      });
  }, [results, selectedStudent, selectedKelas, selectedTahap]);

  if (loading) return <div className="loader-box"><div className="spinner"></div></div>;

  return (
    <div className="dashboard-wrapper">
      {/* SIDEBAR ASAL (Copy-Paste dari dashboard.js) */}
      <aside className="main-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">SI</div>
          <div className="logo-text"><h3>SI-PINTAR</h3><span>VERSI GURU</span></div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-header">UTAMA</div>
          <div className="nav-link" onClick={() => router.push('/dashboard')}>📊 Rekod Murid</div>
          <div className="nav-link active">📈 Analisis Murid</div>
          
          <div className="nav-divider"></div>

          <div className="nav-header">PENGURUSAN</div>
          <div className="nav-link" onClick={() => router.push('/dashboard?view=classes')}>🏫 Urus Kelas</div>
 <div className="nav-link" onClick={() => router.push('/beli-kredit')}>💰 Beli Kredit</div>
          <div className="nav-link" onClick={() => router.push('/profile')}>👤 Profil Guru</div>
          
          <div className="nav-divider"></div>

          <div className="nav-action-zone">
            <div className="nav-link highlight" onClick={() => router.push('/semak')}>✍️ Mulakan Semakan</div>
          </div>
        </nav>

        <button className="btn-logout-sidebar" onClick={() => signOut(auth)}>Keluar Sistem</button>
      </aside>

      {/* VIEWPORT UTAMA */}
      <main className="main-viewport">
        <header className="viewport-header">
          <h1>Analisis Trend Prestasi</h1>
          <div className="credit-badge">Baki Kredit: <b>{user?.credits}</b></div>
        </header>

        <div className="fade-in">
          {/* TOOLBAR PENAPISAN */}
          <div className="pro-card toolbar-filters">
            <div className="t-group">
              <label>Pilih Pelajar</label>
              <div className="dual-search">
                <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
                  <option value="Semua">Semua Pelajar</option>
                  {studentList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
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
            <div className="layout-slider">
              <button className={graphMetric === 'markahIsi' ? 'active' : ''} onClick={() => setGraphMetric('markahIsi')}>Isi</button>
              <button className={graphMetric === 'markahBahasa' ? 'active' : ''} onClick={() => setGraphMetric('markahBahasa')}>Bhs</button>
              <button className={graphMetric === 'markahKeseluruhan' ? 'active' : ''} onClick={() => setGraphMetric('markahKeseluruhan')}>Total</button>
            </div>
          </div>

          {/* CARTA */}
          <div className="pro-card chart-view-container">
            {sortedAndFilteredData.length > 0 ? (
              <Line 
                data={{
                  labels: sortedAndFilteredData.map(r => `${r.nama} (S${r.set || 0})`),
                  datasets: [{
                    label: `Markah ${graphMetric === 'markahKeseluruhan' ? 'Keseluruhan' : graphMetric === 'markahIsi' ? 'Isi' : 'Bahasa'}`,
                    data: sortedAndFilteredData.map(r => r[graphMetric]),
                    borderColor: '#48A6A7',
                    backgroundColor: 'rgba(72, 166, 167, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 5,
                    pointHoverRadius: 8
                  }]
                }}
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  scales: {
                    y: { beginAtZero: true, max: graphMetric === 'markahKeseluruhan' ? 40 : 20 }
                  }
                }}
              />
            ) : (
              <div className="no-data-msg">Tiada rekod ditemui untuk kriteria ini.</div>
            )}
          </div>
        </div>
      </main>

      <style jsx>{`
        /* STYLE DARI DASHBOARD.JS UNTUK SIDEBAR & LAYOUT */
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
        
        .nav-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 1.5rem 10px; }
        .btn-logout-sidebar { margin-top: auto; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 10px; cursor: pointer; }

        .main-viewport { flex: 1; padding: 2.5rem 3.5rem; overflow-y: auto; }
        .viewport-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .viewport-header h1 { margin: 0; font-size: 1.8rem; color: #003D40; }
        .credit-badge { background: white; padding: 8px 16px; border-radius: 50px; border: 1px solid #E0E7E7; font-size: 0.85rem; }

        /* TREND SPECIFIC STYLES */
        .pro-card { background: white; border-radius: 20px; border: 1px solid #E0E7E7; box-shadow: 0 4px 20px rgba(0,61,64,0.04); padding: 1.5rem; margin-bottom: 1.5rem; }
        .toolbar-filters { display: flex; gap: 15px; align-items: flex-end; }
        .t-group { flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .t-group label { font-size: 0.65rem; font-weight: 800; color: #99AFAF; text-transform: uppercase; }
        .t-group select { padding: 10px; border-radius: 10px; border: 1px solid #E0E7E7; background: #F9FAFA; font-size: 0.9rem; width: 100%; }
        
        .layout-slider { background: #F0F4F4; padding: 4px; border-radius: 12px; display: flex; height: 42px; width: 220px; }
        .layout-slider button { flex: 1; border: none; background: transparent; cursor: pointer; border-radius: 8px; font-size: 0.8rem; transition: 0.2s; }
        .layout-slider button.active { background: white; font-weight: bold; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
        
        .chart-view-container { height: 450px; padding: 2rem; }
        .no-data-msg { display: flex; justify-content: center; align-items: center; height: 100%; color: #99AFAF; }
        
        .fade-in { animation: fadeIn 0.5s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}