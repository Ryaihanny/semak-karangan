import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import Head from 'next/head';
import AdminLayout from '@/components/AdminLayout';

import { 
  Chart as ChartJS, CategoryScale, LinearScale, 
  PointElement, LineElement, Title, Tooltip, Legend, Filler 
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function TrendAnalysis() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [results, setResults] = useState([]);

  // --- Filter States ---
  const [selectedKelas, setSelectedKelas] = useState('Semua');
  const [selectedTahap, setSelectedTahap] = useState('Semua');
  const [selectedStudent, setSelectedStudent] = useState('Semua');
  const [graphMetric, setGraphMetric] = useState('markahKeseluruhan');

  const fetchData = async (uid) => {
    try {
      // Fetch User Profile for Layout
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        setUser({ uid, ...userDoc.data() });
      }

      // Fetch Results
      const q = query(
        collection(db, 'karanganResults'), 
        where('userId', '==', uid), 
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      setResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((userObj) => {
      if (userObj) {
        fetchData(userObj.uid);
      } else {
        router.replace('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // --- Analisis Prestasi Logic ---
  const uniqueClasses = useMemo(() => ['Semua', ...new Set(results.map(r => r.kelas).filter(Boolean))], [results]);
  const uniqueTahap = useMemo(() => ['Semua', ...new Set(results.map(r => r.level))], [results]);
  const studentList = useMemo(() => [...new Set(results.map(r => r.nama))], [results]);

  const sortedAndFilteredData = useMemo(() => {
    return [...results]
      .filter(item => {
        const matchStudent = selectedStudent === 'Semua' || item.nama === selectedStudent;
        const matchKelas = selectedKelas === 'Semua' || item.kelas === selectedKelas;
        const matchTahap = selectedTahap === 'Semua' || item.level === selectedTahap;
        return matchStudent && matchKelas && matchTahap;
      })
      .sort((a, b) => {
        // Sort by timestamp ascending for trend line (Oldest to Newest)
        return a.timestamp?.seconds - b.timestamp?.seconds;
      });
  }, [results, selectedStudent, selectedKelas, selectedTahap]);

  return (
    <AdminLayout activePage="trend" user={user}>
      <Head><title>Analisis Trend | SI-PINTAR</title></Head>

      <header className="page-header">
        <div>
          <h1>Analisis Trend Prestasi</h1>
          <p>Pantau perkembangan markah pelajar mengikut masa dan kriteria.</p>
        </div>
      </header>

      <div className="fade-in">
        {/* TOOLBAR PENAPISAN */}
        <div className="filter-card">
          <div className="filter-grid">
            <div className="f-group">
              <label>Pelajar</label>
              <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
                <option value="Semua">Semua Pelajar</option>
                {studentList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="f-group">
              <label>Tahap</label>
              <select value={selectedTahap} onChange={(e) => setSelectedTahap(e.target.value)}>
                {uniqueTahap.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="f-group">
              <label>Kelas</label>
              <select value={selectedKelas} onChange={(e) => setSelectedKelas(e.target.value)}>
                {uniqueClasses.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="f-group">
              <label>Metrik Visual</label>
              <div className="metric-toggle">
                <button className={graphMetric === 'markahIsi' ? 'active' : ''} onClick={() => setGraphMetric('markahIsi')}>Isi</button>
                <button className={graphMetric === 'markahBahasa' ? 'active' : ''} onClick={() => setGraphMetric('markahBahasa')}>Bhs</button>
                <button className={graphMetric === 'markahKeseluruhan' ? 'active' : ''} onClick={() => setGraphMetric('markahKeseluruhan')}>Total</button>
              </div>
            </div>
          </div>
        </div>

        {/* CARTA */}
        <div className="chart-card">
          {sortedAndFilteredData.length > 0 ? (
            <div className="chart-wrapper">
              <Line 
                data={{
                  labels: sortedAndFilteredData.map(r => `${r.nama} (${new Date(r.timestamp?.seconds * 1000).toLocaleDateString('ms-MY')})`),
                  datasets: [{
                    label: `Markah ${graphMetric === 'markahKeseluruhan' ? 'Keseluruhan' : graphMetric === 'markahIsi' ? 'Isi' : 'Bahasa'}`,
                    data: sortedAndFilteredData.map(r => r[graphMetric]),
                    borderColor: '#48A6A7',
                    backgroundColor: 'rgba(72, 166, 167, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointBackgroundColor: '#fff',
                    pointBorderWidth: 3,
                    pointHoverRadius: 8
                  }]
                }}
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false }
                  },
                  scales: {
                    y: { 
                      beginAtZero: true, 
                      max: graphMetric === 'markahKeseluruhan' ? 40 : 20,
                      grid: { color: '#f1f5f9' }
                    },
                    x: {
                      grid: { display: false }
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="no-data">
              <img src="https://cdn-icons-png.flaticon.com/512/7486/7486744.png" alt="No data" />
              <p>Tiada data untuk kriteria yang dipilih.</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .page-header { margin-bottom: 2rem; }
        .page-header h1 { color: #003D40; margin: 0; font-size: 1.8rem; }
        .page-header p { color: #64748b; margin-top: 5px; }

        .filter-card { background: white; border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid #e2e8f0; }
        .filter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; align-items: flex-end; }
        
        .f-group { display: flex; flex-direction: column; gap: 8px; }
        .f-group label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .f-group select { padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 14px; outline: none; }

        .metric-toggle { background: #f1f5f9; padding: 4px; border-radius: 10px; display: flex; gap: 4px; }
        .metric-toggle button { flex: 1; border: none; background: transparent; padding: 8px; cursor: pointer; border-radius: 8px; font-size: 12px; font-weight: 600; color: #64748b; transition: 0.2s; }
        .metric-toggle button.active { background: white; color: #48A6A7; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

        .chart-card { background: white; border-radius: 20px; padding: 2rem; border: 1px solid #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.01); }
        .chart-wrapper { height: 450px; width: 100%; }

        .no-data { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; color: #94a3b8; }
        .no-data img { width: 80px; opacity: 0.2; margin-bottom: 15px; }

        .fade-in { animation: fadeIn 0.5s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </AdminLayout>
  );
}