import { useState, useEffect } from 'react';
import { getPeribahasaByLevel } from '../../lib/peribahasaData';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function QuizGamePage() {
  const router = useRouter();
  const [gameState, setGameState] = useState('START'); // START, PLAYING, END
  const [level, setLevel] = useState('P3');
  const [question, setQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [score, setScore] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [feedback, setFeedback] = useState(null);

  const totalQuestions = 10;

  // Kira peratus pendakian
  const progressPercent = (questionCount / totalQuestions) * 100;

  const startNewGame = (selectedLevel) => {
    setLevel(selectedLevel);
    setScore(0);
    setQuestionCount(0);
    setGameState('PLAYING');
    generateQuestion(selectedLevel);
  };

  const generateQuestion = (currentLevel) => {
    const allData = getPeribahasaByLevel(currentLevel);
    const correctAns = allData[Math.floor(Math.random() * allData.length)];
    const distractors = allData
      .filter(item => item.p !== correctAns.p)
      .sort(() => 0.5 - Math.random())
      .slice(0, 2);

    const allOptions = [
      { text: correctAns.m, isCorrect: true },
      { text: distractors[0].m, isCorrect: false },
      { text: distractors[1].m, isCorrect: false }
    ].sort(() => 0.5 - Math.random());

    setQuestion(correctAns);
    setOptions(allOptions);
    setFeedback(null);
  };

  const handleAnswer = (isCorrect) => {
    if (feedback) return;

    if (isCorrect) {
      setScore(score + 1);
      setFeedback('BETUL ✅');
    } else {
      setFeedback(`SALAH ❌ Jawapan: ${question.m}`);
    }

    setTimeout(() => {
      if (questionCount + 1 < totalQuestions) {
        setQuestionCount(prev => prev + 1);
        generateQuestion(level);
      } else {
        setGameState('END');
      }
    }, 2000);
  };

  return (
    <div className="game-container">
      <Head><title>Misi Mendaki Peribahasa | Si-Pintar</title></Head>

      {/* Butang Keluar (Sentiasa Ada) */}
      <button className="exit-btn" onClick={() => router.back()} title="Keluar Game">
        ✕
      </button>

      {gameState === 'START' && (
        <div className="menu-card">
          <div className="icon-header">🏔️</div>
          <h1>Misi Mendaki Peribahasa</h1>
          <p>Selesaikan 10 soalan untuk sampai ke puncak!</p>
          <div className="level-grid">
            {['P3', 'P4', 'P5', 'P6'].map(l => (
              <button key={l} onClick={() => startNewGame(l)} className={`lvl-btn ${l}`}>
                Tahap {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {gameState === 'PLAYING' && (
        <div className="quiz-card">
          {/* TRACKER MENDAKI GUNUNG */}
          <div className="mountain-track">
            <div className="finish-flag">🚩</div>
            <div className="climber-path">
              <div 
                className="climber-icon" 
                style={{ left: `${progressPercent}%` }}
              >
                🧗
              </div>
            </div>
            <div className="base-label">Mula</div>
            <div className="puncak-label">Puncak</div>
          </div>

          <div className="quiz-header">
            <span>Soalan {questionCount + 1}/{totalQuestions}</span>
            <span className="score-pill">Skor: {score}</span>
          </div>

          <h2 className="peribahasa-text">"{question?.p}"</h2>
          
          <div className="options-list">
            {options.map((opt, i) => (
              <button 
                key={i} 
                onClick={() => handleAnswer(opt.isCorrect)}
                className={`opt-btn ${feedback && opt.isCorrect ? 'correct' : ''}`}
                disabled={!!feedback}
              >
                {opt.text}
              </button>
            ))}
          </div>

          {feedback && (
            <div className={`feedback-msg ${feedback.includes('BETUL') ? 'win' : 'lose'}`}>
              {feedback}
            </div>
          )}
        </div>
      )}

      {gameState === 'END' && (
        <div className="menu-card">
          <div className="icon-header">{score >= 7 ? '🏆' : '💪'}</div>
          <h1>{score >= 7 ? 'Hebat, Pendaki!' : 'Teruskan Usaha!'}</h1>
          <p className="final-score">Anda berjaya menjawab {score} / {totalQuestions}</p>
          <button onClick={() => setGameState('START')} className="primary-btn">Main Lagi</button>
          <button onClick={() => router.back()} className="back-link">Kembali ke Dashboard</button>
        </div>
      )}

      <style jsx>{`
        .game-container { min-height: 100vh; background: #e0f2fe; display: flex; align-items: center; justify-content: center; padding: 20px; font-family: 'Plus Jakarta Sans', sans-serif; position: relative; }
        
        .exit-btn { position: absolute; top: 20px; right: 20px; width: 40px; height: 40px; border-radius: 50%; border: none; background: white; color: #ef4444; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.1); font-size: 1.2rem; display: flex; align-items: center; justify-content: center; z-index: 10; }
        .exit-btn:hover { background: #fee2e2; }

        .menu-card, .quiz-card { background: white; padding: 30px; border-radius: 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.08); width: 100%; max-width: 500px; text-align: center; }
        .icon-header { font-size: 4rem; margin-bottom: 10px; }

        /* MOUNTAIN PROGRESS CSS */
        .mountain-track { position: relative; height: 60px; margin-bottom: 30px; background: #f8fafc; border-radius: 15px; padding: 10px; border-bottom: 4px solid #cbd5e1; }
        .climber-path { position: relative; width: 90%; margin: 0 auto; height: 100%; }
        .climber-icon { position: absolute; bottom: 5px; font-size: 1.8rem; transition: left 0.5s ease-in-out; transform: translateX(-50%); }
        .finish-flag { position: absolute; right: 0; top: 0; font-size: 1.5rem; }
        .base-label { position: absolute; left: 5px; bottom: -20px; font-size: 0.6rem; color: #94a3b8; font-weight: bold; }
        .puncak-label { position: absolute; right: 5px; bottom: -20px; font-size: 0.6rem; color: #94a3b8; font-weight: bold; }

        .level-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 25px 0; }
        .lvl-btn { padding: 15px; border-radius: 15px; border: none; color: white; font-weight: 800; cursor: pointer; transition: 0.2s; }
        .P3 { background: #ff7675; } .P4 { background: #74b9ff; } .P5 { background: #55e6c1; } .P6 { background: #6c5ce7; }

        .peribahasa-text { font-size: 1.5rem; color: #1e293b; margin: 20px 0; font-style: italic; min-height: 80px; display: flex; align-items: center; justify-content: center; }
        .options-list { display: flex; flex-direction: column; gap: 10px; }
        .opt-btn { padding: 14px; border-radius: 12px; border: 2px solid #f1f5f9; background: #f8fafc; cursor: pointer; text-align: left; transition: 0.2s; font-size: 0.9rem; line-height: 1.4; }
        .opt-btn:hover:not(:disabled) { background: #f1f5f9; border-color: #3b82f6; }
        .opt-btn.correct { background: #dcfce7; border-color: #22c55e; color: #166534; font-weight: bold; }

        .feedback-msg { margin-top: 15px; font-size: 0.9rem; font-weight: bold; min-height: 25px; }
        .win { color: #22c55e; } .lose { color: #ef4444; }

        .score-pill { background: #334155; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; }
        .primary-btn { background: #6c5ce7; color: white; border: none; padding: 15px 30px; border-radius: 15px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 20px; }
        .back-link { display: block; margin-top: 15px; color: #64748b; background: none; border: none; cursor: pointer; width: 100%; font-size: 0.9rem; }
      `}</style>
    </div>
  );
}