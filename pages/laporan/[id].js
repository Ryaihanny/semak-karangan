import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Head from 'next/head';

export default function LaporanAnalisis() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchResult = async () => {
      try {
        const docRef = doc(db, 'karanganResults', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setData(docSnap.data());
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [id]);

  if (loading) return <div className="loader">🚀 Memuatkan Laporan...</div>;
  if (!data) return <div className="loader">Data tidak ditemui.</div>;

  const isP5P6 = data.level === 'P5' || data.level === 'P6';
  const totalMax = isP5P6 ? 40 : 15;

  return (
    <div className="report-container">
      <Head><title>Laporan Analisis | Si-Pintar</title></Head>
      
      <header className="report-header">
        <div className="inner-nav">
          <button onClick={() => router.push('/student-dashboard')} className="back-btn">← Ke Dashboard</button>
          <div className="logo">🔮 Si-Pintar</div>
        </div>
        <div className="hero-section">
          <h1>Analisis Karangan</h1>
          <p>{data.tajuk || "Latihan Penulisan"}</p>
        </div>
      </header>

      <main className="report-content">
        {/* SCORE CARDS */}
        <div className="grid-stats">
          <div className="stat-card">
            <span className="label">ISI & HURAIAN</span>
            <span className="value">{data.pemarkahan?.isi || 0}</span>
          </div>
          <div className="stat-card">
            <span className="label">BAHASA</span>
            <span className="value">{data.pemarkahan?.bahasa || 0}</span>
          </div>
          <div className="stat-card highlight">
            <span className="label">JUMLAH SKOR</span>
            <span className="value">{data.markah || data.pemarkahan?.jumlah || 0} / {totalMax}</span>
          </div>
        </div>

        {/* ESSAY VIEW */}
        <div className="white-card">
          <h3 className="card-title">✍️ Teks Karangan Anda</h3>
          <div className="essay-text">
            {data.karangan?.split('\n').map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>

        {/* 4-COLUMN TABLE */}
        <div className="white-card">
          <h3 className="card-title">🔍 Analisis Kesalahan Bahasa</h3>
          <div className="table-wrapper">
            <table className="analysis-table">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Ayat Salah</th>
                  <th>Pembetulan</th>
                  <th>Penjelasan</th>
                </tr>
              </thead>
              <tbody>
                {data.kesalahanBahasa?.map((k, idx) => (
                  <tr key={idx}>
                    <td><span className="cat-tag">{k.kategori || 'Umum'}</span></td>
                    <td className="text-err">{k.ayatSalah}</td>
                    <td className="text-fix">{k.pembetulan}</td>
                    <td className="text-desc">{k.penjelasan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* OVERALL FEEDBACK */}
        <div className="white-card feedback-area">
          <h3 className="card-title">💡 Ulasan Keseluruhan</h3>
          <p>{data.ulasan?.keseluruhan || data.ulasan || "Tiada ulasan disediakan."}</p>
        </div>
      </main>

      <style jsx>{`
        .report-container { background: #f0f2f5; min-height: 100vh; font-family: 'Plus Jakarta Sans', sans-serif; padding-bottom: 60px; }
        .report-header { background: #1a1a2e; color: white; padding: 20px 0 60px; border-radius: 0 0 30px 30px; }
        .inner-nav { max-width: 1000px; margin: 0 auto; padding: 0 20px; display: flex; justify-content: space-between; align-items: center; }
        .back-btn { background: rgba(255,255,255,0.1); border: none; color: white; padding: 8px 16px; border-radius: 10px; cursor: pointer; font-weight: 600; }
        .logo { font-size: 1.2rem; font-weight: 800; color: #a29bfe; }
        .hero-section { max-width: 1000px; margin: 20px auto 0; padding: 0 20px; }
        .hero-section h1 { margin: 0; font-size: 1.8rem; color: #ffd93d; }
        
        .report-content { max-width: 1000px; margin: -30px auto 0; padding: 0 20px; }
        .grid-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 25px; }
        .stat-card { background: white; padding: 20px; border-radius: 20px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        .stat-card.highlight { background: #6c5ce7; color: white; }
        .stat-card .label { display: block; font-size: 0.65rem; font-weight: 800; opacity: 0.7; margin-bottom: 5px; }
        .stat-card .value { font-size: 1.4rem; font-weight: 900; }

        .white-card { background: white; padding: 30px; border-radius: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 25px; }
        .card-title { margin: 0 0 20px; font-size: 1.1rem; color: #1a1a2e; font-weight: 800; }
        .essay-text { line-height: 1.8; color: #2d3436; font-size: 1.05rem; }
        
        .table-wrapper { overflow-x: auto; }
        .analysis-table { width: 100%; border-collapse: collapse; min-width: 600px; }
        .analysis-table th { text-align: left; padding: 12px; border-bottom: 2px solid #f0f2f5; font-size: 0.8rem; color: #636e72; }
        .analysis-table td { padding: 15px 12px; border-bottom: 1px solid #f0f2f5; font-size: 0.9rem; vertical-align: top; }
        
        .cat-tag { background: #f0f2f5; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 0.7rem; }
        .text-err { color: #e63946; font-weight: 600; }
        .text-fix { color: #10b981; font-weight: 700; }
        .text-desc { color: #636e72; font-size: 0.85rem; }

        .feedback-area { border-left: 6px solid #ffd93d; }
        .loader { height: 100vh; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #1a1a2e; }
      `}</style>
    </div>
  );
}