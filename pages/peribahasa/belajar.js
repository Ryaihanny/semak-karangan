import { useState, useEffect } from 'react';
import { getPeribahasaByLevel } from '../../lib/peribahasaData';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function BelajarPage() {
  const router = useRouter();
  const [level, setLevel] = useState(null); // Mula dengan pilihan tahap
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [items, setItems] = useState([]);

  // Fungsi untuk mula belajar mengikut tahap
  const startLearning = (selectedLevel) => {
    const data = getPeribahasaByLevel(selectedLevel);
    setItems(data);
    setLevel(selectedLevel);
    setIndex(0);
  };

  // Fungsi Suara (Text-to-Speech)
  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ms-MY'; // Bahasa Melayu
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!level) {
    return (
      <div className="selection-screen">
        <Head><title>Pilih Tahap Belajar | Si-Pintar</title></Head>
        <div className="menu-card">
          <div className="big-icon">📚</div>
          <h1>Pilih Tahap Belajar</h1>
          <p>Sila pilih silibus peribahasa anda:</p>
          <div className="level-grid">
            {['P3', 'P4', 'P5', 'P6'].map(l => (
              <button key={l} onClick={() => startLearning(l)} className={`lvl-btn ${l}`}>
                Tahap {l}
              </button>
            ))}
          </div>
          <button onClick={() => router.back()} className="back-link">Kembali</button>
        </div>
        <style jsx>{`
          .selection-screen { min-height: 100vh; background: #fdf2f8; display: flex; align-items: center; justify-content: center; padding: 20px; font-family: 'Plus Jakarta Sans', sans-serif; }
          .menu-card { background: white; padding: 40px; border-radius: 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); width: 100%; max-width: 500px; text-align: center; }
          .big-icon { font-size: 4rem; margin-bottom: 10px; }
          .level-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 25px 0; }
          .lvl-btn { padding: 20px; border-radius: 15px; border: none; color: white; font-weight: 800; cursor: pointer; transition: 0.2s; font-size: 1.1rem; }
          .P3 { background: #ff7675; } .P4 { background: #74b9ff; } .P5 { background: #55e6c1; } .P6 { background: #6c5ce7; }
          .lvl-btn:hover { transform: translateY(-5px); box-shadow: 0 10px 15px rgba(0,0,0,0.1); }
          .back-link { background: none; border: none; color: #64748b; cursor: pointer; text-decoration: underline; }
        `}</style>
      </div>
    );
  }

  const currentItem = items[index];
  const progress = ((index + 1) / items.length) * 100;

  return (
    <div className="learn-container">
      <Head><title>Belajar Peribahasa {level} | Si-Pintar</title></Head>
      
      <div className="top-nav">
        <button className="exit-btn" onClick={() => setLevel(null)}>✕ Tutup</button>
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          <span className="progress-text">Kad {index + 1} daripada {items.length}</span>
        </div>
      </div>

      <div className="card-section">
        <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)}>
          <div className="card-face front">
            <span className="tag">Peribahasa</span>
            <h2>{currentItem?.p}</h2>
            <button className="voice-btn" onClick={(e) => { e.stopPropagation(); speak(currentItem?.p); }}>
              🔊 Dengar
            </button>
            <p className="hint">Klik untuk lihat maksud</p>
          </div>
          <div className="card-face back">
            <span className="tag">Maksud</span>
            <p className="maksud-text">{currentItem?.m}</p>
            <button className="voice-btn" onClick={(e) => { e.stopPropagation(); speak(currentItem?.m); }}>
              🔊 Dengar
            </button>
            <p className="hint">Klik untuk pusing balik</p>
          </div>
        </div>
      </div>

      <div className="nav-controls">
        <button 
          className="nav-btn prev" 
          onClick={() => { setIndex(index > 0 ? index - 1 : items.length - 1); setFlipped(false); }}
        >
          ⬅️ Sebelum
        </button>
        <button 
          className="nav-btn next" 
          onClick={() => { setIndex((index + 1) % items.length); setFlipped(false); }}
        >
          Seterusnya ➡️
        </button>
      </div>

      <style jsx>{`
        .learn-container { min-height: 100vh; background: #f0f9ff; padding: 20px; display: flex; flex-direction: column; align-items: center; font-family: 'Plus Jakarta Sans', sans-serif; }
        
        .top-nav { width: 100%; max-width: 600px; display: flex; align-items: center; gap: 15px; margin-bottom: 40px; }
        .exit-btn { background: #ff7675; color: white; border: none; padding: 8px 15px; border-radius: 10px; font-weight: bold; cursor: pointer; }
        
        .progress-container { flex: 1; height: 12px; background: #e2e8f0; border-radius: 10px; position: relative; }
        .progress-bar { height: 100%; background: #22c55e; border-radius: 10px; transition: width 0.3s ease; }
        .progress-text { position: absolute; top: 15px; left: 0; font-size: 0.7rem; color: #64748b; font-weight: bold; }

        .card-section { width: 100%; max-width: 500px; perspective: 1000px; }
        .flashcard { 
          height: 350px; position: relative; transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer;
        }
        .flashcard.flipped { transform: rotateY(180deg); }
        
        .card-face { 
          position: absolute; width: 100%; height: 100%; backface-visibility: hidden; 
          display: flex; flex-direction: column; align-items: center; justify-content: center; 
          padding: 30px; border-radius: 30px; box-shadow: 0 15px 35px rgba(0,0,0,0.1); border: 5px solid white;
        }
        .front { background: #ffffff; color: #1e293b; }
        .back { background: #f8fafc; color: #334155; transform: rotateY(180deg); border-color: #55E6C1; }

        .tag { position: absolute; top: 20px; left: 20px; background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; }
        .front h2 { font-size: 1.8rem; text-align: center; line-height: 1.3; }
        .maksud-text { font-size: 1.2rem; text-align: center; line-height: 1.5; font-weight: 500; }
        
        .voice-btn { margin-top: 20px; background: #e2e8f0; border: none; padding: 8px 15px; border-radius: 20px; cursor: pointer; font-size: 0.8rem; transition: 0.2s; }
        .voice-btn:hover { background: #cbd5e1; }
        .hint { position: absolute; bottom: 20px; font-size: 0.7rem; color: #94a3b8; }

        .nav-controls { display: flex; gap: 20px; margin-top: 50px; }
        .nav-btn { padding: 15px 25px; border-radius: 15px; border: none; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 1rem; }
        .prev { background: white; color: #64748b; }
        .next { background: #003d40; color: white; box-shadow: 0 4px 14px rgba(0,61,64,0.3); }
        .nav-btn:hover { transform: scale(1.05); }
      `}</style>
    </div>
  );
}