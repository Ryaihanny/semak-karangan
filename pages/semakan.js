import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function SemakanPage() {
  const router = useRouter();
  const { taskId, classId, studentId, nama, submissionId, overwrite } = router.query;
  const [essay, setEssay] = useState("");
  const [loading, setLoading] = useState(false);
  const [taskData, setTaskData] = useState(null);
  const [activeTool, setActiveTool] = useState('mula');
  const [isSaving, setIsSaving] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [studentName, setStudentName] = useState(nama || "Pelajar");
  const [credits, setCredits] = useState(null);

  const [coachSuggestion, setCoachSuggestion] = useState("");
  const [isCoaching, setIsCoaching] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [isKamusVisible, setIsKamusVisible] = useState(false);
  const [kamusQuery, setKamusQuery] = useState("");
  const [kamusHasil, setKamusHasil] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Tambahan untuk Feedback & Broadcast
  const [feedback, setFeedback] = useState("");
  const isTeacherMode = router.query.mode === 'teacher';

  const speakSuggestion = (text) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ms-MY'; 
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleKamusSearch = async () => {
    if (!kamusQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch('/api/kamus-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perkataan: kamusQuery }),
      });
      const data = await res.json();
      setKamusHasil(data.maksud);
    } catch (err) {
      setKamusHasil("Maaf, kamus tidak dapat diakses.");
    } finally {
      setIsSearching(false);
    }
  };

  const getAICoachHelp = async () => {
    if (essay.trim().split(/\s+/).filter(Boolean).length < 5) {
      return alert("Tulis sekurang-kurangnya 5 patah perkataan untuk dibantu! ✍️");
    }
    
    setIsCoaching(true);
    try {
      const res = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentDraft: essay, 
          level: taskData?.level || "Primary",
          instructions: taskData?.instructions,
          taskTitle: taskData?.title 
        }),
      });
      const data = await res.json();
      setCoachSuggestion(data.suggestion);
    } catch (err) {
      alert("Maaf, Cikgu AI sedang berehat.");
    } finally {
      setIsCoaching(false);
    }
  };

  // Fungsi Cikgu Hantar Feedback
  const handleSendFeedback = async () => {
    const draftRef = doc(db, 'drafts', `${activeId}_${taskId}`);
    await updateDoc(draftRef, { feedbackGuru: feedback });
    alert("Feedback telah dihantar kepada murid! 📢");
  };

  const tools = {
    mula: { label: "🌅 Mula", items: ["Pada suatu hari yang cerah...", "Suasana di _____ sungguh riuh-rendah.", "Kelihatan orang ramai sedang..."] },
    hubung: { label: "🔗 Hubung", items: ["Seterusnya,", "Dalam pada itu,", "Oleh hal yang demikian,", "Tiba-tiba..."] },
    perasaan: { label: "🧠 Perasaan", items: ["gembira (happy) - gembira bukan kepalang", "gembira (happy) - senyuman lebar hingga ke telinga", "gementar (nervous) - jantung berdegup kencang seperti mahu luruh", "gementar (nervous) - peluh dingin mula membasahi dahi", "panik (panic) - keadaan menjadi kelam-bakut", "panik (panic) - terpinga-pinga seperti rusa masuk kampung", "sedih (sad) - air mata mula berlinangan", "sedih (sad) - hati hancur luluh bagai kaca terhempas ke batu"] }
  };

useEffect(() => {
    const identifyAndLoad = async () => {
      const savedUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("studentUser") || "{}") : {};
      const identifier = studentId || auth.currentUser?.uid || savedUser.id || savedUser.uid;

      if (identifier) {
        setActiveId(identifier);
        if (savedUser.name) setStudentName(savedUser.name);

        try {
          const studentRef = doc(db, 'users', identifier);
          const studentSnap = await getDoc(studentRef);
          if (studentSnap.exists()) {
            setCredits(studentSnap.data().credits ?? 0);
          } else {
            await setDoc(studentRef, { credits: 5, name: studentName, role: 'student', createdAt: serverTimestamp() }, { merge: true });
            setCredits(5);
          }
        } catch (err) {
          console.error(err);
          setCredits(0);
        }

        if (taskId) {
          try {
            const isOverwrite = (router.query.overwrite === 'true') || (overwrite === 'true');
            if (isOverwrite) {
              setEssay(""); 
              console.log("Overwrite mode: Starting fresh.");
              const { overwrite: _, ...cleanQuery } = router.query;
              router.replace({ query: cleanQuery }, undefined, { shallow: true });
            } else {
              const draftRef = doc(db, 'drafts', `${identifier}_${taskId}`);
              const snap = await getDoc(draftRef);
              if (snap.exists()) {
                setEssay(snap.data().essay);
              }
            }
          } catch (err) {
            console.error("Error loading draft:", err);
          }
        }
      }
    };

    const unsubscribe = onAuthStateChanged(auth, () => {
      setAuthReady(true);
      identifyAndLoad();
    });

    identifyAndLoad();
    return () => unsubscribe();
  }, [taskId, studentId, studentName, overwrite, router.query.overwrite]); // Added router.query.overwrite for safety


  // 1 & 2: Listen untuk Feedback & Data Real-time
  useEffect(() => {
    if (!activeId || !taskId) return;
    const draftRef = doc(db, 'drafts', `${activeId}_${taskId}`);
    const unsub = onSnapshot(draftRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.feedbackGuru) setFeedback(data.feedbackGuru);
      }
    });
    return () => unsub();
  }, [activeId, taskId]);

  useEffect(() => {
    if (taskId) {
      fetch(`https://semak-karangan-production.up.railway.app/api/get-task?taskId=${taskId}`)
        .then(res => res.json())
        .then(data => setTaskData(data))
        .catch(err => console.error("Gagal muat turun tugasan:", err));
    }
  }, [taskId]);

  const handleSaveProgress = async () => {
    const finalId = activeId || auth.currentUser?.uid || studentId;
    if (!finalId) return alert("ID tidak dikesan.");
    if (!essay.trim()) return alert("Sila tulis karangan sebelum simpan.");
    setIsSaving(true);
    try {
      const draftRef = doc(db, 'drafts', `${finalId}_${taskId || 'umum'}`);
      await setDoc(draftRef, { userId: finalId, taskId: taskId || 'umum', essay: essay, nama: studentName, updatedAt: serverTimestamp() });
      alert("Progress berjaya disimpan! ✨");
    } catch (err) { alert("Gagal menyimpan."); } finally { setIsSaving(false); }
  };

  const handleSemak = async (e) => {
    if (e) e.preventDefault();
    if (credits !== null && credits <= 0) return alert("Ops! Kredit anda telah habis. Sila hubungi cikgu! 💎");
    const wordCount = essay.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 10) return alert("Ops! Karangan anda terlalu pendek. ✍️");
    setLoading(true);
const isOverwrite = router.query.overwrite === 'true';
    const savedUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("studentUser") || "{}") : {};
    const finalStudentId = activeId || studentId || savedUser.id;
    try {
      const response = await fetch('https://semak-karangan-production.up.railway.app/api/submit-karangan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ 
  essay, 
  studentId: finalStudentId, 
  taskId: taskId, 
  classId: classId || "umum", 
  nama: studentName, 
  studentLevel: taskData?.level || "P4", // ADD THIS LINE: Get level from taskData
  submissionId, 
  status: "submitted",
  isOverwrite: isOverwrite 
}),
    });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      if (data.remainingCredits !== undefined) setCredits(data.remainingCredits);
      router.push(`/analisis/${data.id}?classId=${classId || "umum"}`);
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  return (
    <div style={styles.container}>
      {/* ... [Sistem nav/layout sedia ada] ... */}
      <div style={styles.topNav}>
        <button onClick={() => router.back()} style={styles.backBtn}>⬅️ Kembali</button>
        <h1 style={styles.title}>🚀 Misi Karangan</h1>
      </div>

      <div style={styles.mainLayout}>
        <div style={styles.sidebar}>
          <div style={styles.briefCard}>
            <h3 style={{marginTop: 0}}>📋 Arahan Cikgu:</h3>
            {taskData?.imageUrl && <img src={taskData.imageUrl} alt="Stimulus" style={styles.stimulusImg} />}
            <p style={styles.taskText}>{taskData?.instructions || "Sila tulis karangan berdasarkan tajuk yang diberikan."}</p>
          </div>

          <div style={styles.toolboxCard}>
            <h4 style={styles.toolTitle}>🛠️ Kotak Alatan Ajaib</h4>
            <div style={styles.tabRow}>
              {Object.keys(tools).map(key => (
                <button key={key} onClick={() => setActiveTool(key)} style={{...styles.tabBtn, backgroundColor: activeTool === key ? '#6C5CE7' : '#FFF', color: activeTool === key ? '#FFF' : '#6C5CE7'}}>{tools[key].label}</button>
              ))}
            </div>
            <div style={styles.toolContent}>
              {tools[activeTool].items.map((item, i) => (
                <div key={i} style={styles.toolItem} onClick={() => { navigator.clipboard.writeText(item); alert("Disalin! ✨"); }}>
                  <span>{item}</span>
                  <span style={{fontSize: '10px', color: '#6C5CE7'}}>📋 Salin</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={styles.editorArea}>
          <div style={styles.inputHeader}>
            <span>✍️ Tulis di sini:</span>
            <span style={styles.wordCount}>{essay.trim().split(/\s+/).filter(Boolean).length} Patah Perkataan</span>
          </div>

          {/* Feedback Section */}
          {feedback && (
            <div style={styles.feedbackBanner}>
              <strong>💡 Maklum Balas Cikgu:</strong>
              <p>{feedback}</p>
            </div>
          )}

          {/* Teacher Controls */}
          {isTeacherMode && (
            <div style={styles.teacherControlPanel}>
              <textarea 
                value={feedback} 
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tulis maklum balas untuk murid..."
                style={styles.textarea}
              />
              <button onClick={handleSendFeedback} style={styles.submitBtn}>Hantar Maklum Balas</button>
            </div>
          )}

          <button onClick={getAICoachHelp} disabled={isCoaching} style={styles.coachBtn}>
            {isCoaching ? "🪄 Cikgu AI sedang meneliti..." : "👩‍🏫 Minta Bimbingan Cikgu AI"}
          </button>

          <div style={styles.writingContainer}>
            <textarea 
              value={essay} 
              onChange={(e) => setEssay(e.target.value)} 
              placeholder="Tulis di sini..." 
              style={styles.textarea} 
            />

            {coachSuggestion && (
              <div style={styles.sideCoachPanel}>
                <div style={styles.sideCoachHeader}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <span>💡</span>
                     <span>Bimbingan AI</span>
                   </div>
                   <button onClick={() => speakSuggestion(coachSuggestion)} style={styles.miniVoiceBtn}>
                     {isSpeaking ? "🔊" : "🔈"}
                   </button>
                </div>
                <div style={styles.sideCoachBody}>{coachSuggestion}</div>
                <button onClick={() => { window.speechSynthesis.cancel(); setCoachSuggestion(""); }} style={styles.sideCloseBtn}>
                  Tutup Panel
                </button>
              </div>
            )}
          </div>

          <div style={styles.statusFooter}>
            <span>Status: {activeId ? `✅ Terhubung` : `🔗 Mencari ID...`} | Pelajar: {studentName}</span>
            <span style={styles.creditBadge}>💎 Kredit: {credits ?? '...'}</span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSaveProgress} disabled={isSaving} style={{ ...styles.submitBtn, backgroundColor: '#FFF', color: '#6C5CE7', border: '2px solid #6C5CE7', flex: 1 }}>{isSaving ? "⏳..." : "💾 Simpan Progress"}</button>
            <button onClick={handleSemak} disabled={loading} style={{ ...styles.submitBtn, flex: 2 }}>{loading ? "⚡ Memproses..." : "Hantar Misi! ✨"}</button>
          </div>
        </div>
      </div>

      <button onClick={() => setIsKamusVisible(!isKamusVisible)} style={styles.floatingToggle}>
        {isKamusVisible ? "✖" : "📖 Kamus"}
      </button>

      {/* ... [Sistem kamus sedia ada] ... */}
      {isKamusVisible && (
        <div style={styles.floatingKamus}>
          <div style={styles.kamusHeader}>📖 Kamus Pintar</div>
          <div style={{ padding: '12px' }}>
            <input 
              value={kamusQuery} 
              onChange={(e) => setKamusQuery(e.target.value)}
              placeholder="Cari English/Malay..."
              style={styles.kamusInput}
              onKeyDown={(e) => e.key === 'Enter' && handleKamusSearch()}
            />
            <button onClick={handleKamusSearch} style={styles.searchBtn}>
              {isSearching ? "Mencari..." : "Cari Maklumat"}
            </button>
          </div>
          <div style={styles.kamusBody}>
            {kamusHasil ? (
              <div style={{ fontSize: '13px', whiteSpace: 'pre-line' }}>{kamusHasil}</div>
            ) : (
              <p style={{fontSize: '11px', color: '#94A3B8', textAlign: 'center'}}>Taip perkataan dan tekan Cari.</p>
            )}
          </div>
        </div>
      )}
{/* LOADING OVERLAY */}
{loading && (
  <div style={styles.overlay}>
    <div style={styles.loaderBox}>
      <div style={styles.spinner}></div>
      <h2 style={{ color: '#4338CA', marginBottom: '10px' }}>Cikgu AI sedang menyemak... ⚡</h2>
      <p style={{ color: '#64748B' }}>Sila tunggu sebentar, kami sedang meneliti setiap perkataan anda.</p>
      <div style={styles.loadingBarContainer}>
        <div style={styles.loadingBarFill}></div>
      </div>
    </div>
  </div>
)}
<style jsx global>{`
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(200%); }
  }
`}</style>
    </div>
  );
}

const styles = {
  // ... [Existing Styles]
  container: { backgroundColor: '#F0F3F7', minHeight: '100vh', padding: '20px' },
  topNav: { display: 'flex', alignItems: 'center', marginBottom: '20px', maxWidth: '1200px', margin: '0 auto 20px auto' },
  backBtn: { padding: '8px 15px', borderRadius: '10px', border: 'none', cursor: 'pointer', marginRight: '20px', fontWeight: 'bold', background: '#fff' },
  title: { fontSize: '24px', margin: 0, color: '#2D3436' },
  mainLayout: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', maxWidth: '1200px', margin: '0 auto' },
  sidebar: { display: 'flex', flexDirection: 'column', gap: '20px' },
  briefCard: { backgroundColor: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
  stimulusImg: { width: '100%', borderRadius: '10px', marginBottom: '10px' },
  taskText: { fontSize: '15px', lineHeight: '1.5', color: '#444' },
  toolboxCard: { backgroundColor: '#E0E7FF', padding: '15px', borderRadius: '20px', border: '3px solid #C7D2FE' },
  toolTitle: { margin: '0 0 12px 0', color: '#4338CA', fontSize: '14px', textAlign: 'center' },
  tabRow: { display: 'flex', gap: '5px', marginBottom: '12px', flexWrap: 'wrap' },
  tabBtn: { padding: '6px 10px', borderRadius: '8px', border: '1px solid #6C5CE7', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' },
  toolContent: { display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '250px', overflowY: 'auto' },
  toolItem: { backgroundColor: '#FFF', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', border: '1px solid #C7D2FE' },
  editorArea: { backgroundColor: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
  inputHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontWeight: 'bold' },
  wordCount: { color: '#6C5CE7' },
  writingContainer: { display: 'flex', gap: '15px', alignItems: 'flex-start', marginBottom: '10px' },
  textarea: { flex: 1, height: '420px', borderRadius: '10px', border: '2px solid #EEE', padding: '15px', fontSize: '17px', outline: 'none', resize: 'none' },
  sideCoachPanel: { width: '280px', backgroundColor: '#F8FAFC', borderRadius: '15px', border: '2px solid #E2E8F0', display: 'flex', flexDirection: 'column', height: '420px' },
  sideCoachHeader: { padding: '12px', background: '#6C5CE7', color: 'white', borderRadius: '12px 12px 0 0', fontWeight: 'bold', fontSize: '14px', display: 'flex', justifyContent: 'space-between' },
  miniVoiceBtn: { background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '5px', color: 'white', cursor: 'pointer', padding: '2px 8px' },
  sideCoachBody: { padding: '15px', fontSize: '14px', lineHeight: '1.7', overflowY: 'auto', color: '#334155', whiteSpace: 'pre-line', flex: 1 },
  sideCloseBtn: { padding: '8px', border: 'none', background: 'transparent', color: '#94A3B8', fontSize: '11px', cursor: 'pointer', borderTop: '1px solid #E2E8F0' },
  submitBtn: { width: '100%', padding: '15px', borderRadius: '10px', border: 'none', backgroundColor: '#6C5CE7', color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' },
  coachBtn: { width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '12px', border: 'none', backgroundColor: '#6C5CE7', color: 'white', fontWeight: 'bold', cursor: 'pointer' },
  statusFooter: { fontSize: '12px', color: '#666', margin: '10px 0', background: '#f0f0f0', padding: '8px', borderRadius: '5px', display: 'flex', justifyContent: 'space-between' },
  creditBadge: { fontWeight: 'bold', color: '#6C5CE7' },
  floatingToggle: { position: 'fixed', bottom: '20px', right: '20px', width: '80px', height: '80px', borderRadius: '40px', backgroundColor: '#6C5CE7', color: 'white', border: 'none', boxShadow: '0 4px 15px rgba(108, 92, 231, 0.4)', cursor: 'pointer', fontWeight: 'bold', zIndex: 3000 },
  floatingKamus: { position: 'fixed', bottom: '110px', right: '20px', width: '300px', backgroundColor: 'white', borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '2px solid #E2E8F0', zIndex: 3000, overflow: 'hidden' },
  kamusHeader: { padding: '12px', background: '#6C5CE7', color: 'white', fontWeight: 'bold', fontSize: '14px', textAlign: 'center' },
  kamusInput: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', marginBottom: '8px', boxSizing: 'border-box' },
  searchBtn: { width: '100%', padding: '8px', background: '#6C5CE7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  kamusBody: { padding: '15px', maxHeight: '250px', overflowY: 'auto', borderTop: '1px solid #F1F5F9', backgroundColor: '#F8FAFC' },
  // New Styles
  feedbackBanner: { padding: '15px', backgroundColor: '#FFF3CD', border: '1px solid #FFEBAA', borderRadius: '10px', marginBottom: '15px', color: '#856404' },
  teacherControlPanel: { marginBottom: '20px', padding: '15px', border: '2px dashed #6C5CE7', borderRadius: '10px' },
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(5px)'
  },
  loaderBox: {
    textAlign: 'center',
    padding: '40px',
    backgroundColor: '#fff',
    borderRadius: '24px',
    boxSizing: 'border-box',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    maxWidth: '400px'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '5px solid #E2E8F0',
    borderTop: '5px solid #6366F1',
    borderRadius: '50%',
    margin: '0 auto 20px auto',
    animation: 'spin 1s linear infinite'
  },
  loadingBarContainer: {
    width: '100%',
    height: '6px',
    backgroundColor: '#E2E8F0',
    borderRadius: '10px',
    marginTop: '20px',
    overflow: 'hidden'
  },
  loadingBarFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    width: '50%'
  }
};