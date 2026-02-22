import { useRouter } from 'next/router';
import { useEffect, useState, useMemo } from 'react';
import { db, auth } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function StudentProfile() {
  const router = useRouter();
  const { id } = router.query; 
  const [studentData, setStudentData] = useState([]);
  const [selectedKarangan, setSelectedKarangan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");

  const getMaxMark = (level) => {
    const lvl = String(level || '').toUpperCase();
    if (lvl.includes('P3') || lvl.includes('P4')) return 15;
    if (lvl.includes('P5') || lvl.includes('P6')) return 40;
    return 100;
  };

  useEffect(() => {
    if (!id) return;

    const fetchAllData = async (user) => {
      try {
        // 1. Get the specific karangan record to find the studentId/studentName
        const docRef = doc(db, 'karanganResults', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const currentData = docSnap.data();
          const targetStudentId = currentData.studentId;
          const targetName = currentData.nama;
          
          setStudentName(targetName);
          setSelectedKarangan({ id: docSnap.id, ...currentData });

          // 2. Fetch all history for this specific studentId
          // Using studentId is more reliable than name
          const q = query(
            collection(db, 'karanganResults'),
            where('studentId', '==', targetStudentId),
            orderBy('timestamp', 'asc') // Oldest to newest for graph
          );
          
          const querySnapshot = await getDocs(q);
          const history = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          
          setStudentData(history);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchAllData(user);
      } else if (!loading) {
        router.replace('/login');
      }
    });

    return () => unsubscribe();
  }, [id]);

  const chartData = useMemo(() => ({
    labels: studentData.map((r, i) => r.tajuk ? r.tajuk.substring(0, 10) + '...' : `Latihan ${i + 1}`),
    datasets: [{
      label: 'Trend Markah (%)',
      data: studentData.map(r => {
        // Use the new payload structure: r.markah or r.pemarkahan.jumlah
        const actualMark = r.markah ?? r.pemarkahan?.jumlah ?? 0;
        const max = r.pemarkahan?.max ?? getMaxMark(r.level);
        return ((Number(actualMark) / max) * 100).toFixed(1);
      }),
      borderColor: '#48A6A7',
      backgroundColor: 'rgba(72, 166, 167, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 6,
    }]
  }), [studentData]);

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div className="student-profile">
      <header className="s-header">
        <button className="btn-back" onClick={() => router.back()}>← Kembali</button>
        <div className="s-info">
          <h1>{studentName || 'Profil Pelajar'}</h1>
          <p>Pelajar {studentData[0]?.level || 'P4'} • {studentData.length} Karangan Disemak</p>
        </div>
      </header>

      <div className="s-grid">
        <div className="s-main-col">
          {selectedKarangan && (
            <div className="s-card detail-card">
              <div className="detail-header">
                <div>
                  <h3>{selectedKarangan.tajuk || "Latihan Karangan"}</h3>
                  <span className="info-tag">{selectedKarangan.level}</span>
                </div>
                <div className="score-badge">
                  <span className="score-num">{selectedKarangan.markah ?? selectedKarangan.pemarkahan?.jumlah}</span>
                  <span className="score-max">/{selectedKarangan.pemarkahan?.max || getMaxMark(selectedKarangan.level)}</span>
                </div>
              </div>
              
              <div className="essay-box">
                <h4>Isi Karangan Asal:</h4>
                <p className="essay-text">{selectedKarangan.karanganAsal || selectedKarangan.karangan}</p>
              </div>

              {selectedKarangan.ulasanKeseluruhan || selectedKarangan.ulasan && (
                <div className="ulasan-box">
                  <h4>Ulasan AI:</h4>
                  <p>{selectedKarangan.ulasanKeseluruhan || selectedKarangan.ulasan?.keseluruhan || selectedKarangan.ulasan}</p>
                </div>
              )}
            </div>
          )}

          <div className="s-card chart-card">
            <h3>Trend Kemajuan (Peratus)</h3>
            <div className="chart-wrapper">
              <Line 
                data={chartData} 
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  scales: { y: { beginAtZero: true, max: 100 } }
                }} 
              />
            </div>
          </div>
        </div>

        <div className="s-side-col">
          <div className="s-card">
            <h3>Rekod Karangan</h3>
            <div className="history-list">
              {studentData.slice().reverse().map(item => (
                <div 
                  key={item.id} 
                  className={`history-item ${selectedKarangan?.id === item.id ? 'active' : ''}`}
                  onClick={() => setSelectedKarangan(item)}
                >
                  <div className="h-left">
                    <span className="h-set">{item.tajuk ? item.tajuk.substring(0, 15) : "Latihan"}</span>
                    <p className="h-date">{item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleDateString('ms-MY') : 'Baru sahaja'}</p>
                  </div>
                  <div className="h-score">
                    {item.markah ?? item.pemarkahan?.jumlah}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="s-card stat-card">
            <h3>Statistik Purata</h3>
            <div className="kriteria-stat">
              <p>Purata Isi: <b>{(studentData.reduce((acc, curr) => acc + (Number(curr.pemarkahan?.isi || curr.markahIsi) || 0), 0) / studentData.length).toFixed(1)}</b></p>
              <p>Purata Bahasa: <b>{(studentData.reduce((acc, curr) => acc + (Number(curr.pemarkahan?.bahasa || curr.markahBahasa) || 0), 0) / studentData.length).toFixed(1)}</b></p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .student-profile { padding: 2rem; background: #F8F9FA; min-height: 100vh; font-family: 'Inter', sans-serif; }
        .s-header { max-width: 1200px; margin: 0 auto 2rem; display: flex; align-items: center; gap: 20px; }
        .btn-back { background: white; border: 1px solid #EEE; padding: 10px 20px; border-radius: 12px; cursor: pointer; font-weight: 600; }
        .s-info h1 { margin: 0; color: #003D40; }
        .info-tag { background: #E8F4F4; color: #003D40; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; }
        
        .s-grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
        .s-card { background: white; padding: 20px; border-radius: 20px; border: 1px solid #EEE; margin-bottom: 20px; }
        
        .detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .score-badge { background: #003D40; color: white; padding: 10px 15px; border-radius: 12px; text-align: center; }
        .score-num { font-size: 1.5rem; font-weight: 800; }
        .score-max { font-size: 0.9rem; opacity: 0.8; }
        
        .essay-box { background: #F9F9F9; padding: 15px; border-radius: 12px; margin-bottom: 15px; }
        .essay-text { white-space: pre-wrap; line-height: 1.6; color: #333; font-size: 0.95rem; }
        .ulasan-box { background: #E8F4F4; padding: 15px; border-radius: 12px; color: #003D40; }
        
        .history-list { display: flex; flex-direction: column; gap: 10px; margin-top: 15px; }
        .history-item { 
          display: flex; justify-content: space-between; align-items: center; 
          padding: 12px; background: #F9F9F9; border-radius: 12px; cursor: pointer;
          border: 2px solid transparent; transition: 0.2s;
        }
        .history-item.active { border-color: #48A6A7; background: white; }
        .h-set { font-weight: 700; color: #003D40; font-size: 0.85rem; }
        .h-date { font-size: 0.7rem; color: #999; }
        .h-score { font-weight: 800; color: #48A6A7; }
        
        .chart-wrapper { height: 300px; }
        .loading-screen { height: 100vh; display: flex; justify-content: center; align-items: center; }
        .spinner { width: 40px; height: 40px; border: 4px solid #EEE; border-top-color: #48A6A7; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}