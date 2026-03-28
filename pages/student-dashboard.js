import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import Head from 'next/head';

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const savedUser = localStorage.getItem("studentUser");
      if (!savedUser) {
        router.push('/login');
        return;
      }
      const sessionData = JSON.parse(savedUser);
      setUser(sessionData);

      try {
        const studentRef = doc(db, 'students', sessionData.id);
        const studentSnap = await getDoc(studentRef);
        if (studentSnap.exists()) {
          const freshData = studentSnap.data();
          setUser({ id: studentSnap.id, ...freshData });
          localStorage.setItem("studentUser", JSON.stringify({ id: studentSnap.id, ...freshData }));
          await fetchStudentData(studentSnap.id, freshData.enrolledClasses || []);
        }
      } catch (err) {
        console.error("Dashboard Sync Error:", err);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, [router]);

  const fetchStudentData = async (studentId, classIds) => {
    try {
      if (classIds?.length > 0) {
        const qAssign = query(
          collection(db, 'assignments'), 
          where('classId', 'in', classIds), 
          orderBy('createdAt', 'desc')
        );
        const snapAssign = await getDocs(qAssign);
        setAssignments(snapAssign.docs.map(d => ({ id: d.id, ...d.data() })));
      }

      const qSub = query(
        collection(db, 'karanganResults'), 
        where('studentId', '==', studentId)
      );
      const snapSub = await getDocs(qSub);
      const subData = snapSub.docs.map(d => {
        const data = d.data();
        const ts = data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000) : new Date();
        return { id: d.id, ...data, sortDate: ts };
      });

      subData.sort((a, b) => b.sortDate - a.sortDate);
      setSubmissions(subData);
    } catch (error) { 
      console.error("Data Fetch Error:", error); 
    }
  };

  const getLevelConfig = (level) => {
    const config = {
      P3: { max: 15, label: 'P3', color: '#FF7675', gradient: 'linear-gradient(135deg, #ff7675, #ef5753)' },
      P4: { max: 15, label: 'P4', color: '#74B9FF', gradient: 'linear-gradient(135deg, #74ff, #0984e3)' },
      P5: { max: 40, label: 'P5', color: '#55E6C1', gradient: 'linear-gradient(135deg, #55e6c1, #00b894)' },
      P6: { max: 40, label: 'P6', color: '#6C5CE7', gradient: 'linear-gradient(135deg, #6c5ce7, #a29bfe)' }
    };
    return config[level] || { max: 40, label: 'Umum', color: '#636E72', gradient: 'linear-gradient(135deg, #636e72, #2d3436)' };
  };

  const stats = useMemo(() => {
    if (submissions.length === 0) return { avg: 0, completed: 0 };
    let totalPct = 0;
    let completedCount = 0;
    submissions.forEach(sub => {
      const currentMax = sub.pemarkahan?.max || getLevelConfig(sub.level).max;
      totalPct += ((sub.markah || sub.pemarkahan?.jumlah || 0) / currentMax) * 100;
      if (sub.status === 'murni_completed') completedCount++;
    });
    return { avg: (totalPct / submissions.length).toFixed(0), completed: completedCount };
  }, [submissions]);

  // Logic to show ONLY the latest report for each task (handles overwrites)
  const latestReports = useMemo(() => {
    const taskMap = new Map();
    // Since submissions are already sorted by sortDate descending, 
    // the first one we find for a taskId is the latest.
    submissions.forEach(sub => {
      if (!taskMap.has(sub.taskId)) {
        taskMap.set(sub.taskId, sub);
      }
    });
    return Array.from(taskMap.values());
  }, [submissions]);

  const handleLogout = () => {
    if (confirm("Adakah anda mahu log keluar?")) {
      localStorage.removeItem("studentUser");
      router.push('/login');
    }
  };

  if (loading) return <div className="loader-container"><div className="rocket">🚀</div><p>Menyusun Misi...</p></div>;

  return (
    <div className="dashboard">
      <Head><title>Si-Pintar | Dashboard Pelajar</title></Head>
      <header className="header">
        <div className="container top-bar">
          <div className="logo">🔮 Si-Pintar</div>
          <button onClick={handleLogout} className="logout-pill">Log Keluar</button>
        </div>
        <div className="container hero">
          <div className="hero-text">
            <h1>Hai, <span>{user?.name?.split(' ')[0] || "Wira"}</span>! 👋</h1>
            <p>Lihat tugasan anda dan teruskan menulis!</p>
          </div>
          <div className="hero-stats">
            <div className="stat-box"><span className="stat-val">{submissions.length}</span><span className="stat-lab">Karya</span></div>
            <div className="stat-box"><span className="stat-val">{stats.avg}%</span><span className="stat-lab">Purata</span></div>
            <div className="stat-box gold"><span className="stat-val">🏆 {stats.completed}</span><span className="stat-lab">Selesai</span></div>
          </div>
        </div>
      </header>

      <main className="container content">
        <h3 className="section-title">📂 Tugasan Kelas Aktif</h3>
        <div className="mission-grid">
          {assignments.map(task => {
            const sub = submissions.find(s => s.taskId === task.id);
            const totalM = sub?.kesalahanBahasa?.length || 0;
            const solvedM = sub?.solvedMissions?.length || 0;
            const progress = totalM > 0 ? Math.round((solvedM / totalM) * 100) : 0;

            const isDone = sub?.status === 'murni_completed';
            const activeLevel = user?.level || task.level || 'P4';
            const levelCfg = getLevelConfig(activeLevel);
            const displayMax = sub?.pemarkahan?.max || levelCfg.max;
            const currentTotal = sub?.markah ?? sub?.pemarkahan?.jumlah ?? 0;

            return (
              <div key={task.id} className={`card ${isDone ? 'cleared' : ''}`}>
                <div className="card-header">
                  <span className="level-badge" style={{ backgroundColor: levelCfg.color }}>{levelCfg.label}</span>
                  {isDone && <span className="done-check">✅ Lengkap</span>}
                </div>
                <h4 className="task-title">{task.title}</h4>
                {sub ? (
                  <div className="sub-info">
                    <div className="score-row">
                      <div className="score-main"><span className="big-num">{currentTotal}</span><span className="total">/{displayMax}</span></div>
                      <div className="score-labels">
                        <span>Isi: {sub.pemarkahan?.isi || 0}</span><br/>
                        <span>Bahasa: {sub.pemarkahan?.bahasa || 0}</span>
                      </div>
                    </div>
                    <div className="progress-zone">
                       <div className="prog-track"><div className="prog-fill" style={{ width: `${isDone ? 100 : progress}%`, background: levelCfg.gradient }}></div></div>
                       <small style={{ fontSize: '10px', color: '#64748b', display:'block', marginTop:'5px' }}>
                          Misi Murni: {isDone ? 100 : progress}%
                       </small>
                    </div>
                  </div>
                ) : ( <div className="empty-sub"><p>Belum dihantar.</p></div> )}
                
                <button 
                  className={`action-btn ${sub ? 'secondary' : 'primary'}`} 
                  onClick={() => {
                    if (!sub) {
                      router.push(`/semakan?taskId=${task.id}`);
                    } else if (isDone) {
                      router.push(`/analisis/${sub.id}`);
                    } else {
                      const choice = confirm(
                        "Anda sudah menghantar draf.\n\n" +
                        "Klik 'OK' untuk teruskan BAIKI karangan sedia ada.\n" +
                        "Klik 'Cancel' jika anda mahu PADAM & TULIS SEMULA karangan baru."
                      );
                      if (choice) {
                        router.push(`/analisis/${sub.id}`);
                      } else {
                        const doubleCheck = confirm("ADAKAH ANDA PASTI? Karangan lama anda akan digantikan dengan yang baru.");
                        if (doubleCheck) {
                          router.push(`/semakan?taskId=${task.id}&overwrite=true`);
                        }
                      }
                    }
                  }}
                >
                  {!sub ? 'Mula Menulis ✨' : isDone ? 'Lihat Laporan' : 'Baiki / Tulis Semula ✍️'}
                </button>
              </div>
            );
          })}
        </div>
        
        {/* --- NEW SECTION: LATEST REPORTS --- */}
        {latestReports.length > 0 && (
          <div style={{ marginTop: '50px' }}>
            <h3 className="section-title">📊 Laporan Hasil Karangan</h3>
            <div className="report-list">
              {latestReports.map(sub => {
                const levelCfg = getLevelConfig(sub.level);
                const taskRef = assignments.find(t => t.id === sub.taskId);
                return (
                  <div key={sub.id} className="report-item">
                    <div className="report-meta">
                      <span className="report-date">{sub.sortDate.toLocaleDateString('ms-MY')}</span>
                      <h4 className="report-title">{taskRef?.title || sub.tajuk || "Latihan Kendiri"}</h4>
                    </div>
                    <div className="report-score">
                       <span className="score-pill">{sub.markah ?? sub.pemarkahan?.jumlah ?? 0} / {sub.pemarkahan?.max || levelCfg.max}</span>
                       <button className="view-btn" onClick={() => router.push(`/analisis/${sub.id}`)}>Buka Laporan</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="game-hub" style={{ marginTop: '60px' }}>
          <h3 className="section-title">Sudah selesai?</h3>
          <p style={{ color: '#64748b', marginBottom: '20px', marginTop: '-15px' }}>Ayuh ulangkaji peribahasa sementara menunggu rakan-rakan yang lain.</p>
          <div className="game-cards-container">
            <div className="game-link-card" onClick={() => router.push('/peribahasa/belajar')}>
              <div className="game-icon">📖</div>
              <div className="game-info">
                <h4>Kamus Flashcard</h4>
                <p>Ulangkaji peribahasa {user?.level || 'CITA/CEKAP'}</p>
              </div>
            </div>
            <div className="game-link-card highlight" onClick={() => router.push('/peribahasa/main')}>
              <div className="game-icon">🎮</div>
              <div className="game-info">
                <h4>Main Padanan</h4>
                <p>Uji minda dan kumpul markah tinggi!</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        /* ... Existing Styles ... */
        .dashboard { background: #f0f2f5; min-height: 100vh; font-family: 'Plus Jakarta Sans', sans-serif; padding-bottom: 50px; }
        .container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
        .header { background: #1a1a2e; color: white; padding: 20px 0 100px; border-radius: 0 0 40px 40px; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
        .logo { font-size: 1.5rem; font-weight: 800; color: #a29bfe; }
        .logout-pill { background: rgba(255,255,255,0.1); border: none; color: white; padding: 8px 20px; border-radius: 20px; cursor: pointer; }
        .hero { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; }
        .hero-text h1 { font-size: 2.2rem; margin: 0; }
        .hero-text h1 span { color: #ffd93d; }
        .hero-stats { display: flex; gap: 10px; }
        .stat-box { background: rgba(255,255,255,0.05); padding: 10px 20px; border-radius: 15px; text-align: center; min-width: 80px; }
        .stat-val { display: block; font-size: 1.5rem; font-weight: 800; }
        .stat-lab { font-size: 0.6rem; text-transform: uppercase; opacity: 0.7; }
        .content { margin-top: -60px; }
        .section-title { color: #1a1a2e; margin-bottom: 20px; font-weight: 800; }
        .mission-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; border-radius: 25px; padding: 25px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); display: flex; flex-direction: column; transition: transform 0.2s; }
        .card.cleared { border: 2px solid #10b981; }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .level-badge { color: white; padding: 3px 10px; border-radius: 8px; font-size: 0.7rem; font-weight: 800; }
        .task-title { font-size: 1.1rem; margin-bottom: 15px; color: #2d3436; flex-grow: 1; }
        .sub-info { background: #f8f9fa; border-radius: 15px; padding: 15px; margin-bottom: 15px; }
        .score-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .big-num { font-size: 1.8rem; font-weight: 900; color: #1a1a2e; }
        .action-btn { width: 100%; padding: 12px; border-radius: 15px; border: none; font-weight: 800; cursor: pointer; transition: 0.2s; }
        .primary { background: #6c5ce7; color: white; }
        .secondary { background: #f0f2f5; color: #6c5ce7; }
        
        /* NEW REPORT STYLES */
        .report-list { background: white; border-radius: 25px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
        .report-item { display: flex; justify-content: space-between; align-items: center; padding: 20px 25px; border-bottom: 1px solid #f0f2f5; }
        .report-item:last-child { border-bottom: none; }
        .report-date { font-size: 0.7rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; }
        .report-title { margin: 2px 0 0; font-size: 1rem; color: #1a1a2e; }
        .report-score { display: flex; align-items: center; gap: 15px; }
        .score-pill { background: #f0f9f9; color: #00767b; padding: 6px 12px; border-radius: 10px; font-weight: 800; font-size: 0.9rem; border: 1px solid #d1e7e8; }
        .view-btn { background: #1a1a2e; color: white; border: none; padding: 8px 16px; border-radius: 10px; font-weight: 700; font-size: 0.8rem; cursor: pointer; }
        
        /* ... Remaining Game Hub Styles ... */
        .game-hub { margin-bottom: 40px; }
        .game-cards-container { display: flex; gap: 15px; flex-wrap: wrap; }
        .game-link-card { flex: 1; min-width: 250px; background: white; padding: 20px; border-radius: 20px; display: flex; align-items: center; gap: 15px; cursor: pointer; transition: 0.3s; box-shadow: 0 10px 20px rgba(0,0,0,0.05); border: 1px solid transparent; }
        .game-link-card:hover { transform: translateY(-5px); border-color: #a29bfe; }
        .game-link-card.highlight { background: #6c5ce7; color: white; }
        .game-icon { font-size: 2rem; }
        .loader-container { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #1a1a2e; color: white; }
        .rocket { font-size: 3rem; margin-bottom: 20px; animation: bounce 2s infinite; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
      `}</style>
    </div>
  );
}