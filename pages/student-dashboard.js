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
        // Convert Firestore Timestamp to Date object for the sort function
        const ts = data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000) : new Date();
        return { id: d.id, ...data, sortDate: ts };
      });

      // Sort using the converted date
      subData.sort((a, b) => b.sortDate - a.sortDate);
      setSubmissions(subData);
    } catch (error) { 
      console.error("Data Fetch Error:", error); 
    }
  };

  // UPDATED: Matches your submit-karangan.js levels exactly
  const getLevelConfig = (level) => {
    const config = {
      P3: { max: 15, label: 'P3', color: '#FF7675', gradient: 'linear-gradient(135deg, #ff7675, #ef5753)' },
      P4: { max: 15, label: 'P4', color: '#74B9FF', gradient: 'linear-gradient(135deg, #74b9ff, #0984e3)' },
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
      // Calculate based on saved max or dynamic config
      const currentMax = sub.pemarkahan?.max || getLevelConfig(sub.level).max;
      totalPct += ((sub.markah || sub.pemarkahan?.jumlah || 0) / currentMax) * 100;
      if (sub.status === 'murni_completed') completedCount++;
    });
    return { avg: (totalPct / submissions.length).toFixed(0), completed: completedCount };
  }, [submissions]);

  const historySubmissions = useMemo(() => {
    return submissions.filter(sub => !assignments.some(task => task.id === sub.taskId));
  }, [submissions, assignments]);

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
            const isInProgress = sub?.status === 'murni_in_progress';
            
            const levelCfg = getLevelConfig(task.level || sub?.level || 'P6');
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
                  onClick={() => router.push(sub ? `/analisis/${sub.id}` : `/semakan?taskId=${task.id}`)}
                >
                  {!sub 
                    ? 'Mula Menulis ✨' 
                    : isDone 
                      ? 'Lihat Analisis' 
                      : 'Baiki Karangan ✍️'}
                </button>
              </div> // <-- This was missing
            ); // <-- This was missing
          })}
        </div>
        
        {/* History section for submissions without active tasks */}
        {historySubmissions.length > 0 && (
          <div style={{ marginTop: '40px' }}>
            <h3 className="section-title">📜 Sejarah Penulisan Lain</h3>
            <div className="mission-grid">
              {historySubmissions.map(sub => {
                const levelCfg = getLevelConfig(sub.level);
                const displayMax = sub.pemarkahan?.max || levelCfg.max;
                return (
                  <div key={sub.id} className="card">
                    <div className="card-header">
                      <span className="level-badge" style={{ backgroundColor: levelCfg.color }}>{levelCfg.label}</span>
                    </div>
                    <h4 className="task-title">{sub.tajuk || "Latihan Kendiri"}</h4>
                    <div className="sub-info">
                      <div className="score-row">
                        <div className="score-main">
                          <span className="big-num">{sub.markah ?? sub.pemarkahan?.jumlah ?? 0}</span>
                          <span className="total">/{displayMax}</span>
                        </div>
                      </div>
                    </div>
                    <button className="action-btn secondary" onClick={() => router.push(`/analisis/${sub.id}`)}>
                      Lihat Semula
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
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
        .done-check { color: #10b981; font-weight: 800; font-size: 0.8rem; }
        .task-title { font-size: 1.1rem; margin-bottom: 15px; color: #2d3436; flex-grow: 1; }
        .sub-info { background: #f8f9fa; border-radius: 15px; padding: 15px; margin-bottom: 15px; }
        .score-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .big-num { font-size: 1.8rem; font-weight: 900; color: #1a1a2e; }
        .score-labels { font-size: 0.7rem; color: #636e72; text-align: right; }
        .prog-track { height: 8px; background: #e9ecef; border-radius: 10px; overflow: hidden; }
        .prog-fill { height: 100%; transition: width 0.6s ease-in-out; }
        .action-btn { width: 100%; padding: 12px; border-radius: 15px; border: none; font-weight: 800; cursor: pointer; transition: 0.2s; }
        .primary { background: #6c5ce7; color: white; }
        .secondary { background: #f0f2f5; color: #6c5ce7; }
        .loader-container { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #1a1a2e; color: white; }
        .rocket { font-size: 3rem; margin-bottom: 20px; animation: bounce 2s infinite; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
      `}</style>
    </div>
  );
}