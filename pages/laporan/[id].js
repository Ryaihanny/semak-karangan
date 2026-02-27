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

  if (loading) return <div className="loader">🚀 Menyusun Laporan Hebat Anda...</div>;
  if (!data) return <div className="loader">Data tidak ditemui.</div>;

  const isJunior = data.level === 'P3' || data.level === 'P4';
  const maxIsi = isJunior ? 7 : 20;
  const maxBhs = isJunior ? 8 : 20;
  const totalMax = isJunior ? 15 : 40;
  
  const totalScore = data.markah || data.pemarkahan?.jumlah || 0;
  const percentage = Math.round((totalScore / totalMax) * 100);

  return (
    <div className="report-container">
      <Head><title>Tahniah! Laporan Anda | Si-Pintar</title></Head>
      
      <header className="report-header">
        <div className="inner-nav">
          <button onClick={() => router.push('/student-dashboard')} className="back-btn">← Kembali ke Dashboard</button>
          <div className="logo">🔮 Si-Pintar</div>
        </div>
        <div className="hero-section">
          <div className="badge-level">{data.level}</div>
          <h1>Tahniah, {data.studentName || 'Wira'}! 🎉</h1>
          <p className="tajuk-misi">Misi: {data.tajuk || "Latihan Penulisan"}</p>
        </div>
      </header>

      <main className="report-content">
        {/* PROGRESS SCORE SECTION */}
        <div className="score-main-card">
          <div className="circular-progress">
            <div className="score-display">
              <span className="big-score">{totalScore}</span>
              <span className="divider">/</span>
              <span className="max-score">{totalMax}</span>
            </div>
            <p className="score-label">Skor Keseluruhan</p>
          </div>
          
          <div className="detailed-bars">
            <div className="bar-item">
              <div className="bar-labels"><span>Isi & Huraian</span> <span>{data.pemarkahan?.isi || 0}/{maxIsi}</span></div>
              <div className="bar-track"><div className="bar-fill blue" style={{width: `${((data.pemarkahan?.isi || 0)/maxIsi)*100}%`}}></div></div>
            </div>
            <div className="bar-item">
              <div className="bar-labels"><span>Bahasa & Tatabahasa</span> <span>{data.pemarkahan?.bahasa || 0}/{maxBhs}</span></div>
              <div className="bar-track"><div className="bar-fill purple" style={{width: `${((data.pemarkahan?.bahasa || 0)/maxBhs)*100}%`}}></div></div>
            </div>
          </div>
        </div>

        {/* ESSAY VIEW */}
{/* ESSAY VIEW - With Dynamic Underlining */}
<div className="white-card">
  <h3 className="card-title">✍️ Hasil Penulisan Anda</h3>
  <div className="essay-text">
    {data.text?.split('\n').map((paragraph, pIdx) => {
      let highlightedParagraph = paragraph;
      
      // Ambil senarai kesalahan (cuba pelbagai variasi kunci data)
      const errors = data.kesalahanBahasa || data.kesalahan_bahasa || data.error_analysis || [];
      
      errors.forEach((err) => {
        const wrongPhrase = err.ayatSalah || err.original || err.sentence;
        if (wrongPhrase && highlightedParagraph.includes(wrongPhrase)) {
          // Gantikan teks salah dengan tag <u> yang berwarna merah
          highlightedParagraph = highlightedParagraph.split(wrongPhrase).join(
            `<u style="text-decoration-color: #d63031; text-decoration-thickness: 2px; cursor: help;" title="${err.penjelasan || 'Sila semak analisis di bawah'}">${wrongPhrase}</u>`
          );
        }
      });

      return (
        <p key={pIdx} dangerouslySetInnerHTML={{ __html: highlightedParagraph }} />
      );
    })}
  </div>
</div>

        {/* 4-COLUMN TABLE - Matches Teacher PDF */}
        <div className="white-card">
          <h3 className="card-title">🔍 Analisis Kesalahan Bahasa</h3>
          <p className="subtitle">Belajar dari kesilapan adalah kunci kejayaan!</p>
          <div className="table-wrapper">
            <table className="analysis-table">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Ayat Asal</th>
                  <th>Pembetulan</th>
                  <th>Penjelasan</th>
                </tr>
              </thead>
<tbody>
  {(data.kesalahanBahasa || data.kesalahan_bahasa || data.error_analysis || [])?.map((k, idx) => (
    <tr key={idx}>
      {/* Kolum 1: Kategori */}
      <td>
        <span className="cat-tag">
          {k.kategori || k.category || 'Umum'}
        </span>
      </td>
      
      {/* Kolum 2: Ayat Asal (Teks Merah & Potong) */}
      <td className="text-err">
        {k.ayatSalah || k.original || k.sentence || k.kesalahan || "—"}
      </td>
      
      {/* Kolum 3: Pembetulan (Teks Hijau) */}
      <td className="text-fix">
        {k.pembetulan || k.correction || k.pembetulanPenjelasan || "—"}
      </td>
      
      {/* Kolum 4: Penjelasan */}
      <td className="text-desc">
        {k.penjelasan || k.explanation || "—"}
      </td>
    </tr>
  ))}
</tbody>
            </table>
          </div>
        </div>

        {/* MOTIVATIONAL FEEDBACK */}
        <div className="white-card feedback-area">
          <h3 className="card-title">🌟 Pesanan Guru Si-Pintar</h3>
          <div className="feedback-content">
             <div className="teacher-icon">👨‍🏫</div>
             <p>{data.ulasan?.keseluruhan || data.ulasan || "Hebat! Teruskan usaha anda untuk menjadi penulis yang lebih baik."}</p>
          </div>
        </div>
      </main>

      <style jsx>{`
        .report-container { background: #f4f7f6; min-height: 100vh; font-family: 'Plus Jakarta Sans', sans-serif; padding-bottom: 60px; }
        .report-header { background: #003d40; color: white; padding: 30px 0 80px; border-radius: 0 0 50px 50px; text-align: center; }
        .inner-nav { max-width: 1000px; margin: 0 auto; padding: 0 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .back-btn { background: rgba(255,255,255,0.15); border: none; color: white; padding: 10px 20px; border-radius: 12px; cursor: pointer; font-weight: 700; transition: 0.3s; }
        .back-btn:hover { background: rgba(255,255,255,0.25); }
        .logo { font-size: 1.4rem; font-weight: 900; color: #55E6C1; }
        
        .badge-level { display: inline-block; background: #ffd93d; color: #003d40; padding: 5px 15px; border-radius: 20px; font-weight: 900; font-size: 0.8rem; margin-bottom: 10px; }
        .hero-section h1 { margin: 0; font-size: 2.2rem; }
        .tajuk-misi { opacity: 0.8; font-size: 1.1rem; margin-top: 5px; }

        .report-content { max-width: 1000px; margin: -50px auto 0; padding: 0 20px; }
        
        .score-main-card { background: white; border-radius: 30px; padding: 30px; display: flex; align-items: center; gap: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); margin-bottom: 30px; flex-wrap: wrap; }
        .score-display { display: flex; align-items: baseline; justify-content: center; }
        .big-score { font-size: 4rem; font-weight: 900; color: #003d40; }
        .divider { font-size: 2rem; color: #ccc; margin: 0 5px; }
        .max-score { font-size: 1.5rem; color: #666; font-weight: 700; }
        .score-label { text-align: center; font-weight: 800; color: #666; text-transform: uppercase; letter-spacing: 1px; font-size: 0.7rem; }
        
        .detailed-bars { flex-grow: 1; min-width: 250px; }
        .bar-item { margin-bottom: 15px; }
        .bar-labels { display: flex; justify-content: space-between; font-weight: 700; font-size: 0.85rem; margin-bottom: 8px; color: #444; }
        .bar-track { height: 12px; background: #eee; border-radius: 10px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 10px; transition: width 1s ease-out; }
        .bar-fill.blue { background: linear-gradient(90deg, #74b9ff, #0984e3); }
        .bar-fill.purple { background: linear-gradient(90deg, #a29bfe, #6c5ce7); }

        .white-card { background: white; padding: 35px; border-radius: 30px; box-shadow: 0 5px 20px rgba(0,0,0,0.03); margin-bottom: 30px; }
        .card-title { margin: 0 0 15px; font-size: 1.2rem; color: #003d40; font-weight: 900; }
        .subtitle { color: #888; font-size: 0.9rem; margin-top: -10px; margin-bottom: 20px; }
        
        .essay-text { line-height: 2; color: #2d3436; font-size: 1.1rem; white-space: pre-wrap; }
        
        .table-wrapper { overflow-x: auto; background: #fafafa; border-radius: 20px; padding: 10px; }
        .analysis-table { width: 100%; border-collapse: collapse; min-width: 700px; }
        .analysis-table th { text-align: left; padding: 15px; border-bottom: 2px solid #eee; font-size: 0.8rem; color: #999; text-transform: uppercase; }
        .analysis-table td { padding: 18px 15px; border-bottom: 1px solid #f0f0f0; font-size: 0.95rem; vertical-align: top; }
        
        .cat-tag { background: #E3F2FD; color: #1976D2; padding: 5px 10px; border-radius: 8px; font-weight: 800; font-size: 0.7rem; }
        .text-err { color: #d63031; font-weight: 600; text-decoration: line-through; }
        .text-fix { color: #00b894; font-weight: 800; }
        .text-desc { color: #636e72; font-size: 0.85rem; line-height: 1.5; }

        .feedback-content { display: flex; gap: 20px; align-items: flex-start; }
        .teacher-icon { font-size: 2.5rem; background: #f0f0f0; padding: 10px; border-radius: 20px; }
        .feedback-area { border-bottom: 8px solid #ffd93d; }

        .loader { height: 100vh; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.2rem; color: #003d40; background: #f4f7f6; }

        @media (max-width: 768px) {
          .score-main-card { flex-direction: column; text-align: center; }
          .hero-section h1 { font-size: 1.6rem; }
        }
      `}</style>
    </div>
  );
}