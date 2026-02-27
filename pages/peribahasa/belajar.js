import { useState, useEffect } from 'react';
import { getPeribahasaByLevel } from '../../lib/peribahasaData';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function BelajarPage() {
  const router = useRouter();
  const [level, setLevel] = useState(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [items, setItems] = useState([]);
  
  // State untuk simpan ID peribahasa yang sudah dihafal
  const [masteredIds, setMasteredIds] = useState([]);

  const startLearning = (selectedLevel) => {
    const data = getPeribahasaByLevel(selectedLevel);
    setItems(data);
    setLevel(selectedLevel);
    setIndex(0);
    setFlipped(false);
  };

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Berhenti sebutan sebelumnya
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ms-MY';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Fungsi untuk tanda sebagai hafal
  const toggleMastery = (e, pText) => {
    e.stopPropagation(); // Elak kad berpusing bila klik checkbox
    if (masteredIds.includes(pText)) {
      setMasteredIds(masteredIds.filter(id => id !== pText));
    } else {
      setMasteredIds([...masteredIds, pText]);
    }
  };

  if (!level) {
    return (
      <div className="selection-screen">
        <div className="menu-card">
          <div className="big-icon">📚</div>
          <h1>Pusat Latihan Memori</h1>
          <p>Pilih tahap untuk mula menghafal:</p>
          <div className="level-grid">
            {['P3', 'P4', 'P5', 'P6'].map(l => (
              <button key={l} onClick={() => startLearning(l)} className={`lvl-btn ${l}`}>Tahap {l}</button>
            ))}
          </div>
          <button onClick={() => router.back()} className="back-link">Kembali ke Dashboard</button>
        </div>
        <style jsx>{`
          .selection-screen { min-height: 100vh; background: #fdf2f8; display: flex; align-items: center; justify-content: center; padding: 20px; font-family: 'Plus Jakarta Sans', sans-serif; }
          .menu-card { background: white; padding: 40px; border-radius: 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); width: 100%; max-width: 500px; text-align: center; }
          .level-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 25px 0; }
          .lvl-btn { padding: 20px; border-radius: 15px; border: none; color: white; font-weight: 800; cursor: pointer; transition: 0.2s; }
          .P3 { background: #ff7675; } .P4 { background: #74b9ff; } .P5 { background: #55e6c1; } .P6 { background: #6c5ce7; }
          .back-link { background: none; border: none; color: #64748b; cursor: pointer; text-decoration: underline; }
        `}</style>
      </div>
    );
  }

  const currentItem = items[index];
  const isMastered = masteredIds.includes(currentItem?.p);
  const masteryProgress = (masteredIds.length / items.length) * 100;

  return (
    <div className="learn-container">
      <Head><title>Hafalan Peribahasa {level}</title></Head>
      
      <div className="top-nav">
        <button className="exit-btn" onClick={() => setLevel(null)}>✕</button>
        <div className="mastery-box">
          <div className="progress-info">
            <span>🧠 Memori: {masteredIds.length}/{items.length}</span>
            <span>{Math.round(masteryProgress)}%</span>
          </div>
          <div className="mastery-bar-bg">
            <div className="mastery-bar-fill" style={{ width: `${masteryProgress}%` }}></div>
          </div>
        </div>
      </div>

      <div className="card-section">
        <div className={`flashcard ${flipped ? 'flipped' : ''} ${isMastered ? 'mastered-border' : ''}`} onClick={() => setFlipped(!flipped)}>
          
          {/* Muka Depan */}
          <div className="card-face front">
            <div className="card-header">
              <span className="tag">Peribahasa</span>
              <button 
                className={`mastery-tick ${isMastered ? 'active' : ''}`} 
                onClick={(e) => toggleMastery(e, currentItem.p)}
              >
                {isMastered ? '✅ Sudah Hafal' : '💡 Tandakan Hafal'}
              </button>
            </div>
            <h2>{currentItem?.p}</h2>
            <div className="action-row">
              <button className="icon-btn" onClick={(e) => { e.stopPropagation(); speak(currentItem?.p); }}>🔊</button>
            </div>
            <p className="hint">Klik untuk semak maksud</p>
          </div>

          {/* Muka Belakang */}
          <div className="card-face back">
            <span className="tag">Maksud</span>
            <p className="maksud-text">{currentItem?.m}</p>
            <div className="action-row">
              <button className="icon-btn" onClick={(e) => { e.stopPropagation(); speak(currentItem?.m); }}>🔊</button>
            </div>
            <p className="hint">Klik untuk pusing semula</p>
          </div>
        </div>
      </div>

      <div className="nav-controls">
        <button className="nav-btn prev" onClick={() => { setIndex(index > 0 ? index - 1 : items.length - 1); setFlipped(false); }}>⬅️</button>
        <div className="index-indicator">Kad {index + 1} / {items.length}</div>
        <button className="nav-btn next" onClick={() => { setIndex((index + 1) % items.length); setFlipped(false); }}>➡️</button>
      </div>

      <style jsx>{`
        .learn-container { min-height: 100vh; background: #f0f9ff; padding: 20px; display: flex; flex-direction: column; align-items: center; font-family: 'Plus Jakarta Sans', sans-serif; }
        
        .top-nav { width: 100%; max-width: 500px; display: flex; gap: 15px; align-items: center; margin-bottom: 30px; }
        .exit-btn { background: white; border: none; width: 45px; height: 45px; border-radius: 15px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        
        .mastery-box { flex: 1; }
        .progress-info { display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 800; color: #1e293b; margin-bottom: 5px; }
        .mastery-bar-bg { height: 12px; background: #e2e8f0; border-radius: 10px; overflow: hidden; }
        .mastery-bar-fill { height: 100%; background: #22c55e; transition: width 0.5s ease; box-shadow: 0 0 10px rgba(34, 197, 94, 0.4); }

        .card-section { width: 100%; max-width: 450px; perspective: 1000px; }
        .flashcard { height: 380px; position: relative; transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
        .flashcard.flipped { transform: rotateY(180deg); }
        .mastered-border { border: 4px solid #22c55e !important; border-radius: 35px; }
        
        .card-face { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px; border-radius: 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); background: white; border: 2px solid #e2e8f0; }
        .back { transform: rotateY(180deg); background: #f8fafc; border-color: #55E6C1; }

        .card-header { position: absolute; top: 20px; left: 20px; right: 20px; display: flex; justify-content: space-between; align-items: center; }
        .tag { background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; color: #64748b; }
        
        .mastery-tick { border: none; padding: 6px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; cursor: pointer; background: #f1f5f9; color: #64748b; transition: 0.3s; }
        .mastery-tick.active { background: #dcfce7; color: #166534; }

        h2 { font-size: 1.8rem; text-align: center; color: #1e293b; margin: 20px 0; line-height: 1.4; }
        .maksud-text { font-size: 1.3rem; text-align: center; color: #334155; line-height: 1.6; }

        .action-row { margin-top: 20px; }
        .icon-btn { background: #f1f5f9; border: none; width: 50px; height: 50px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: 0.2s; }
        .icon-btn:hover { background: #e2e8f0; transform: scale(1.1); }

        .nav-controls { display: flex; align-items: center; gap: 20px; margin-top: 40px; }
        .nav-btn { background: #1e293b; color: white; border: none; width: 60px; height: 60px; border-radius: 20px; font-size: 1.5rem; cursor: pointer; transition: 0.2s; }
        .nav-btn:hover { transform: scale(1.1); background: #0f172a; }
        .index-indicator { font-weight: 800; color: #64748b; font-size: 0.9rem; }
        .hint { position: absolute; bottom: 20px; font-size: 0.7rem; color: #94a3b8; }
      `}</style>
    </div>
  );
}