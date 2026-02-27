import { useState } from 'react';
import { getPeribahasaByLevel } from '../../lib/peribahasaData';
import { useRouter } from 'next/router';

export default function BelajarPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  
  // Contoh level P4, nanti anda boleh ambil dari profil user/database
  const items = getPeribahasaByLevel('P4'); 

  return (
    <div className="learn-container">
      <h1>📖 Ruang Belajar Peribahasa</h1>
      
      <div className={`card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)}>
        <div className="front">
          <h3>Peribahasa:</h3>
          <p>{items[index]?.p}</p>
        </div>
        <div className="back">
          <h3>Maksud:</h3>
          <p>{items[index]?.m}</p>
        </div>
      </div>

      <div className="nav-btns">
        <button onClick={() => router.back()}>Kembali</button>
        <button onClick={() => { setIndex((index + 1) % items.length); setFlipped(false); }}>
          Seterusnya ➡️
        </button>
      </div>

      <style jsx>{`
        .learn-container { padding: 40px; text-align: center; max-width: 600px; margin: 0 auto; }
        .card { 
          height: 300px; 
          perspective: 1000px; 
          position: relative; 
          cursor: pointer; 
          transition: transform 0.6s; 
          transform-style: preserve-3d;
          margin-bottom: 30px;
        }
        .flipped { transform: rotateY(180deg); }
        .front, .back { 
          position: absolute; 
          width: 100%; 
          height: 100%; 
          backface-visibility: hidden; 
          display: flex; 
          flex-direction: column;
          align-items: center; 
          justify-content: center; 
          border-radius: 20px;
          border: 4px solid #55E6C1;
          background: white;
          padding: 20px;
        }
        .back { transform: rotateY(180deg); background: #f9f9f9; }
        button { margin: 10px; padding: 10px 20px; border-radius: 10px; border: none; background: #003d40; color: white; cursor: pointer; }
      `}</style>
    </div>
  );
}