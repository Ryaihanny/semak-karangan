import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend
} from 'recharts';

export default function StudentAnalysis() {
  const router = useRouter();
  const { id } = router.query;
  const [student, setStudent] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      setSubmissions([]); 
      fetchAnalysis();
    }
  }, [id]);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const sSnap = await getDoc(doc(db, 'students', id));
      if (sSnap.exists()) {
        setStudent(sSnap.data());
      }

      const q = query(
        collection(db, 'karanganResults'), 
        where('studentId', '==', id), 
        orderBy('timestamp', 'asc')
      );
      
      const qSnap = await getDocs(q);
      const data = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSubmissions([...data].reverse());
    } catch (err) {
      console.error("Fetch Analysis Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    return [...submissions].reverse().map(sub => {
      const max = sub.pemarkahan?.max || 15;
      const maxIsi = max === 15 ? 7 : 20;
      const maxBahasa = max === 15 ? 8 : 20;

      return {
        date: sub.timestamp?.seconds 
          ? new Date(sub.timestamp.seconds * 1000).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' })
          : 'Baru',
        "Jumlah (%)": Math.round(((sub.markah ?? sub.pemarkahan?.jumlah ?? 0) / max) * 100),
        "Isi (%)": Math.round(((sub.pemarkahan?.isi ?? 0) / maxIsi) * 100),
        "Bahasa (%)": Math.round(((sub.pemarkahan?.bahasa ?? 0) / maxBahasa) * 100),
      };
    });
  }, [submissions]);

  // Logic to identify common errors from history
  const commonErrors = useMemo(() => {
    const categories = {};
    submissions.forEach(sub => {
      sub.kesalahanBahasa?.forEach(err => {
        categories[err.kategori] = (categories[err.kategori] || 0) + 1;
      });
    });
    return Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [submissions]);

  const stats = useMemo(() => {
    if (submissions.length === 0) return null;
    const scores = chartData.map(d => d["Jumlah (%)"]);
    return {
      average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      highest: Math.max(...scores),
      total: submissions.length
    };
  }, [chartData, submissions]);

  if (loading && !student) return <div className="loading-screen">Memproses Analisis...</div>;

  return (
    <div className="analysis-page">
      <header className="hero">
        <button onClick={() => router.back()} className="back-btn">← Balik ke Kelas</button>
        <div className="hero-content">
            <div>
                <h1>Prestasi {student?.name || "Pelajar"}</h1>
                <p>Analisis perkembangan kualiti penulisan murid secara holistik.</p>
            </div>
            {stats && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <span className="stat-label">Purata Skor</span>
                        <span className="stat-value">{stats.average}%</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Jumlah Latihan</span>
                        <span className="stat-value">{stats.total}</span>
                    </div>
                </div>
            )}
        </div>
      </header>

      <main className="content-container">
        <section className="chart-section">
          <div className="section-header">
            <h3>Trend Prestasi Per Komponen</h3>
            <p>Perbandingan prestasi Isi, Bahasa, dan Jumlah Markah (%).</p>
          </div>
          <div className="graph-wrapper">
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorJumlah" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#48A6A7" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#48A6A7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Area type="monotone" dataKey="Isi (%)" stroke="#f59e0b" strokeWidth={2} fill="transparent" />
                <Area type="monotone" dataKey="Bahasa (%)" stroke="#3b82f6" strokeWidth={2} fill="transparent" />
                <Area type="monotone" dataKey="Jumlah (%)" stroke="#48A6A7" strokeWidth={4} fill="url(#colorJumlah)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {commonErrors.length > 0 && (
          <section className="error-analysis">
            <h3>Kelemahan Utama (Berdasarkan Sejarah)</h3>
            <div className="error-grid">
              {commonErrors.map(([cat, count]) => (
                <div key={cat} className="error-pill">
                  <span className="error-cat">{cat.replace('_', ' ')}</span>
                  <span className="error-count">{count} kali dikesan</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="timeline">
          <h3>Sejarah Penulisan</h3>
          {submissions.length === 0 && !loading ? (
            <div className="empty-state">Tiada latihan dihantar lagi.</div>
          ) : (
            submissions.map((sub, index) => {
              const currentMark = sub.markah ?? sub.pemarkahan?.jumlah ?? 0;
              const maxMark = sub.pemarkahan?.max || 15;
              const percentage = Math.round((currentMark / maxMark) * 100);
              
              return (
                <div key={sub.id} className="timeline-item">
                  <div className="date-marker">
                    {sub.timestamp?.seconds 
                      ? new Date(sub.timestamp.seconds * 1000).toLocaleDateString('ms-MY') 
                      : "Baru sahaja"}
                  </div>
                  <div className="report-card" onClick={() => router.push(`/analisis/${sub.id}?mode=teacher`)}>
                    <div className="score-circle" style={{ borderColor: percentage > 70 ? '#22c55e' : '#f59e0b' }}>
                      {percentage}%
                    </div>
                    <div className="details">
                      <h4>{sub.tajuk || "Latihan Karangan"}</h4>
                      <div className="sub-scores">
                        <span>Isi: <b>{sub.pemarkahan?.isi ?? 0}</b></span>
                        <span style={{ marginLeft: '10px' }}>Bahasa: <b>{sub.pemarkahan?.bahasa ?? 0}</b></span>
                      </div>
                      
                      {index < submissions.length - 1 && (
                        <div className="improvement-note" style={{ 
                          color: percentage >= Math.round(((submissions[index+1].markah ?? submissions[index+1].pemarkahan?.jumlah ?? 0) / (submissions[index+1].pemarkahan?.max || 15)) * 100) ? '#059669' : '#dc2626',
                          background: percentage >= Math.round(((submissions[index+1].markah ?? submissions[index+1].pemarkahan?.jumlah ?? 0) / (submissions[index+1].pemarkahan?.max || 15)) * 100) ? '#ecfdf5' : '#fef2f2'
                        }}>
                          {percentage >= Math.round(((submissions[index+1].markah ?? submissions[index+1].pemarkahan?.jumlah ?? 0) / (submissions[index+1].pemarkahan?.max || 15)) * 100) ? 
                            "📈 Meningkat/Stabil" : "📉 Menurun sedikit"}
                        </div>
                      )}
                    </div>
                    <button className="btn-view">Lihat Hasil</button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>

      <style jsx>{`
        .analysis-page { background: #f8fafc; min-height: 100vh; font-family: 'Inter', sans-serif; }
        .hero { background: #003D40; color: white; padding: 40px 50px 100px; }
        .hero-content { display: flex; justify-content: space-between; align-items: flex-end; max-width: 1000px; margin: 0 auto; }
        .stats-grid { display: flex; gap: 20px; }
        .stat-card { background: rgba(255,255,255,0.1); padding: 15px 25px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.1); text-align: center; }
        .stat-label { display: block; font-size: 0.75rem; text-transform: uppercase; opacity: 0.7; letter-spacing: 1px; }
        .stat-value { font-size: 1.5rem; font-weight: 800; }
        .content-container { max-width: 1000px; margin: -50px auto 0; padding: 0 20px 50px; }
        .chart-section { background: white; padding: 30px; border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; margin-bottom: 30px; }
        .section-header { margin-bottom: 25px; }
        .section-header h3 { margin: 0; color: #003D40; }
        .section-header p { color: #64748b; font-size: 0.9rem; margin: 5px 0 0; }
        .error-analysis { margin-bottom: 40px; }
        .error-analysis h3 { color: #003D40; font-size: 1rem; margin-bottom: 15px; }
        .error-grid { display: flex; gap: 12px; flex-wrap: wrap; }
        .error-pill { background: #fee2e2; border: 1px solid #fecaca; padding: 10px 18px; border-radius: 12px; display: flex; flex-direction: column; }
        .error-cat { font-weight: 800; color: #991b1b; text-transform: capitalize; font-size: 0.9rem; }
        .error-count { font-size: 0.75rem; color: #b91c1c; opacity: 0.8; }
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; padding: 8px 15px; border-radius: 10px; cursor: pointer; margin-bottom: 20px; transition: 0.2s; }
        .timeline h3 { color: #003D40; margin-bottom: 20px; }
        .timeline-item { display: flex; gap: 20px; margin-bottom: 20px; }
        .date-marker { min-width: 100px; font-size: 0.8rem; color: #64748b; padding-top: 20px; font-weight: 700; }
        .report-card { flex: 1; background: white; padding: 20px; border-radius: 20px; display: flex; align-items: center; gap: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); cursor: pointer; border: 1px solid #e2e8f0; transition: 0.2s; }
        .report-card:hover { transform: translateY(-3px); border-color: #48A6A7; }
        .score-circle { width: 60px; height: 60px; border: 4px solid #eee; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; }
        .sub-scores { font-size: 0.85rem; color: #64748b; margin: 5px 0; }
        .improvement-note { font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 6px; display: inline-block; }
        .btn-view { margin-left: auto; padding: 8px 15px; background: #f1f5f9; border: none; border-radius: 8px; font-weight: 700; color: #003D40; font-size: 0.8rem; }
        .loading-screen { height: 100vh; display: flex; align-items: center; justify-content: center; color: #003D40; font-weight: 700; }
        .empty-state { text-align: center; padding: 50px; color: #64748b; background: white; border-radius: 20px; }
      `}</style>
    </div>
  );
}