import { useState, useEffect } from 'react';
import { getPeribahasaByLevel } from '../../lib/peribahasaData';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function MatchingGamePage() {
  const router = useRouter();
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]); // Menyimpan index kad yang dibuka
  const [solved, setSolved] = useState([]);   // Menyimpan id pasangan yang sudah betul
  const [level, setLevel] = useState('P4');   // Contoh Level P4

  useEffect(() => {
    setupGame();
  }, []);

  const setupGame = () => {
    // 1. Ambil data silibus
    const rawData = getPeribahasaByLevel(level);
    
    // 2. Pilih 6 peribahasa secara rawak untuk satu pusingan
    const selected = [...rawData].sort(() => 0.5 - Math.random()).slice(0, 6);
    
    // 3. Pecahkan kepada 12 kad (6 Peribahasa + 6 Maksud)
    const gameCards = [
      ...selected.map(item => ({ id: `p-${item.p}`, content: item.p, pairId: item.p, type: 'P' })),
      ...selected.map(item => ({ id: `m-${item.p}`, content: item.m, pairId: item.p, type: 'M' }))
    ].sort(() => 0.5 - Math.random()); // Acak kedudukan kad
    
    setCards(gameCards);
    setFlipped([]);
    setSolved([]);
  };

  const handleCardClick = (index) => {
    if (flipped.length === 2 || flipped.includes(index) || solved.includes(cards[index].pairId)) return;

    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      const firstCard = cards[newFlipped[0]];
      const secondCard = cards[newFlipped[1]];

      if (firstCard.pairId === secondCard.pairId) {
        setSolved([...solved, firstCard.pairId]);
        setFlipped([]);
      } else {
        setTimeout(() => setFlipped([]), 1000); // Tutup balik kalau salah selepas 1 saat
      }
    }
  };

  return (
    <div className="game-container">
      <Head><title>Uji Minda Peribahasa | Si-Pintar</title></Head>
      
      <header className="game-header">
        <button onClick={() => router.back()} className="back-btn">← Kembali</button>
        <h1>🎮 Padanan Peribahasa ({level})</h1>
        <p>Cari pasangan Peribahasa dan Maksud yang betul!</p>
      </header>

      <div className="game-grid">
        {cards.map((card, index) => {
          const isFlipped = flipped.includes(index);
          const isSolved = solved.includes(card.pairId);
          
          return (
            <div 
              key={card.id} 
              className={`game-card ${isFlipped ? 'flipped' : ''} ${isSolved ? 'solved' : ''}`}
              onClick={() => handleCardClick(index)}
            >
              <div className="card-inner">
                <div className="card-front">?</div>
                <div className="card-back">{card.content}</div>
              </div>
            </div>
          );
        })}
      </div>

      {solved.length === 6 && (
        <div className="win-overlay">
          <div className="win-modal">
            <h2>Syabas! 🎉</h2>
            <p>Anda telah menguasai {level} hari ini.</p>
            <button onClick={setupGame}>Main Lagi</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .game-container { min-height: 100vh; background: #f0f4f8; padding: 40px 20px; font-family: sans-serif; }
        .game-header { text-align: center; margin-bottom: 30px; }
        .back-btn { background: #003d40; color: white; border: none; padding: 8px 15px; border-radius: 8px; cursor: pointer; }
        
        .game-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); 
          gap: 15px; 
          max-width: 900px; 
          margin: 0 auto; 
        }

        .game-card { height: 160px; perspective: 1000px; cursor: pointer; }
        .card-inner { 
          position: relative; width: 100%; height: 100%; 
          transition: transform 0.6s; transform-style: preserve-3d; 
          box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-radius: 15px;
        }
        .game-card.flipped .card-inner { transform: rotateY(180deg); }
        .game-card.solved .card-inner { transform: rotateY(180deg); opacity: 0.6; border: 3px solid #00b894; }

        .card-front, .card-back { 
          position: absolute; width: 100%; height: 100%; 
          backface-visibility: hidden; display: flex; align-items: center; 
          justify-content: center; padding: 15px; text-align: center; 
          border-radius: 15px; font-weight: bold; font-size: 0.9rem;
        }
        .card-front { background: #003d40; color: white; font-size: 2rem; }
        .card-back { background: white; color: #333; transform: rotateY(180deg); }

        .win-overlay { 
          position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
          background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; 
        }
        .win-modal { background: white; padding: 40px; border-radius: 20px; text-align: center; }
        .win-modal button { background: #55E6C1; border: none; padding: 10px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; margin-top: 20px; }
      `}</style>
    </div>
  );
}