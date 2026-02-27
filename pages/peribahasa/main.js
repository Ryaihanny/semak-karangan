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
  const [feedback, setFeedback] = useState(null); // 'BETUL' atau 'SALAH'

  const totalQuestions = 10;

  const startNewGame = (selectedLevel) => {
    setLevel(selectedLevel);
    setScore(0);
    setQuestionCount(0);
    setGameState('PLAYING');
    generateQuestion(selectedLevel);
  };

  const generateQuestion = (currentLevel) => {
    const allData = getPeribahasaByLevel(currentLevel);
    
    // Pilih 1 peribahasa sebagai soalan
    const correctAns = allData[Math.floor(Math.random() * allData.length)];
    
    // Ambil 2 maksud salah secara rawak
    const distractors = allData
      .filter(item => item.p !== correctAns.p)
      .sort(() => 0.5 - Math.random())
      .slice(0, 2);

    // Gabung dan acak pilihan jawapan
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
    if (feedback) return; // Elakkan double click

    if (isCorrect) {
      setScore(score + 1);
      setFeedback('BETUL ✅');
    } else {
      setFeedback(`SALAH ❌ Jawapan: ${question.m}`);
    }

    setTimeout(() => {
      if (questionCount + 1 < totalQuestions) {
        setQuestionCount(questionCount + 1);
        generateQuestion(level);
      } else {
        setGameState('END');
      }
    }, 2000);
  };

  return (
    <div className="game-container">
      <Head><title>Kuiz Peribahasa Si-Pintar</title></Head>

      {gameState === 'START' && (
        <div className="menu-card">
          <h1>🎯 Cabaran Peribahasa</h1>
          <p>Pilih tahap anda untuk bermula:</p>
          <div className="level-grid">
            {['P3', 'P4', 'P5', 'P6'].map(l => (
              <button key={l} onClick={() => startNewGame(l)} className={`lvl-btn ${l}`}>
                Tahap {l}
              </button>
            ))}
          </div>
          <button onClick={() => router.back()} className="back-link">Kembali ke Dashboard</button>
        </div>
      )}

      {gameState === 'PLAYING' && (
        <div className="quiz-card">
          <div className="quiz-header">
            <span>Soalan {questionCount + 1}/{totalQuestions}</span>
            <span className="score-pill">Skor: {score}</span>
          </div>

          <h2 className="peribahasa-text">"{question?.p}"</h2>
          <p className="instruction">Apakah maksud peribahasa di atas?</p>

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

          {feedback && <div className={`feedback-msg ${feedback.includes('BETUL') ? 'win' : 'lose'}`}>{feedback}</div>}
        </div>
      )}

      {gameState === 'END' && (
        <div className="menu-card">
          <h1>Selesai! 🎉</h1>
          <p className="final-score">Skor Akhir: {score} / {totalQuestions}</p>
          <button onClick={() => setGameState('START')} className="primary-btn">Main Semula</button>
          <button onClick={() => router.back()} className="back-link">Keluar</button>
        </div>
      )}

      <style jsx>{`
        .game-container { min-height: 100vh; background: #f0f2f5; display: flex; align-items: center; justify-content: center; padding: 20px; font-family: 'Plus Jakarta Sans', sans-serif; }
        .menu-card, .quiz-card { background: white; padding: 40px; border-radius: 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); width: 100%; max-width: 500px; text-align: center; }
        
        .level-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 25px 0; }
        .lvl-btn { padding: 20px; border-radius: 15px; border: none; color: white; font-weight: 800; cursor: pointer; transition: 0.2s; }
        .P3 { background: #ff7675; } .P4 { background: #74b9ff; } .P5 { background: #55e6c1; } .P6 { background: #6c5ce7; }
        .lvl-btn:hover { transform: scale(1.05); filter: brightness(1.1); }

        .peribahasa-text { font-size: 1.8rem; color: #1a1a2e; margin: 20px 0; font-style: italic; }
        .options-list { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; }
        .opt-btn { padding: 15px; border-radius: 12px; border: 2px solid #eef2f6; background: white; cursor: pointer; text-align: left; transition: 0.2s; font-size: 0.95rem; }
        .opt-btn:hover:not(:disabled) { background: #f0f7ff; border-color: #74b9ff; }
        .opt-btn.correct { background: #d1fae5; border-color: #10b981; color: #065f46; font-weight: bold; }

        .feedback-msg { margin-top: 20px; padding: 10px; border-radius: 10px; font-weight: bold; }
        .win { color: #10b981; } .lose { color: #ef4444; }

        .score-pill { background: #1a1a2e; color: white; padding: 5px 15px; border-radius: 20px; font-size: 0.8rem; }
        .primary-btn { background: #6c5ce7; color: white; border: none; padding: 15px 30px; border-radius: 15px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 10px;}
        .back-link { display: block; margin-top: 20px; color: #64748b; background: none; border: none; cursor: pointer; width: 100%; }
      `}</style>
    </div>
  );
}