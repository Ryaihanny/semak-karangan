import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function SemakanPage() {
  const router = useRouter();
  const { taskId, classId, studentId, nama, submissionId } = router.query;

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
  
  // --- NEW: VOICE STATE ---
  const [isSpeaking, setIsSpeaking] = useState(false);

  // --- NEW: SOUND FUNCTION ---
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
          // ADDED: context for AI
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

  const tools = {
    mula: { label: "🌅 Mula", items: ["Pada suatu hari yang cerah...", "Suasana di _____ sungguh riuh-rendah.", "Kelihatan orang ramai sedang..."] },
    hubung: { label: "🔗 Hubung", items: ["Seterusnya,", "Dalam pada itu,", "Oleh hal yang demikian,", "Tiba-tiba..."] },
    perasaan: { label: "🧠 Perasaan", items: ["gembira (happy) - gembira bukan kepalang", "gembira (happy) - senyuman lebar hingga ke telinga", "gementar (nervous) - jantung berdegup kencang seperti mahu luruh", "gementar (nervous) - peluh dingin mula membasahi dahi", "panik (panic) - keadaan menjadi kelam-bakut", "panik (panic) - terpinga-pinga seperti rusa masuk kampung", "sedih (sad) - air mata mula berlinangan", "sedih (sad) - hati hancur luluh bagai kaca terhempas ke batu"] }
  };

  // --- ALL FIREBASE LOGIC UNTOUCHED ---
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
        } catch (err) { console.error(err); setCredits(0); }
        if (taskId) {
          try {
            const draftRef = doc(db, 'drafts', `${identifier}_${taskId}`);
            const snap = await getDoc(draftRef);
            if (snap.exists()) setEssay(snap.data().essay);
          } catch (err) { console.error(err); }
        }
      }
    };
    const unsubscribe = onAuthStateChanged(auth, () => { setAuthReady(true); identifyAndLoad(); });
    identifyAndLoad();
    return () => unsubscribe();
  }, [taskId, studentId, studentName]);

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
    const savedUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("studentUser") || "{}") : {};
    const finalStudentId = activeId || studentId || savedUser.id;
    try {
      const response = await fetch('https://semak-karangan-production.up.railway.app/api/submit-karangan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essay, studentId: finalStudentId, taskId: taskId, classId: classId || "umum", nama: studentName, submissionId, status: "submitted" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      if (data.remainingCredits !== undefined) setCredits(data.remainingCredits);
      router.push(`/analisis/${data.id}?classId=${classId || "umum"}`);
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  return (
    <div style={styles.container}>
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

          <button onClick={getAICoachHelp} disabled={isCoaching} style={styles.coachBtn}>
            {isCoaching ? "🪄 Cikgu AI sedang meneliti..." : "👩‍🏫 Minta Bimbingan Cikgu AI"}
          </button>

          <textarea value={essay} onChange={(e) => setEssay(e.target.value)} placeholder="Tulis di sini..." style={styles.textarea} />

          {/* UPDATED COACH OVERLAY WITH SOUND */}
          {coachSuggestion && (
            <div style={styles.coachOverlay}>
              <div style={styles.coachContent}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                   <h3 style={{margin: 0, color: '#6C5CE7'}}>💡 Bimbingan Cikgu AI</h3>
                   <button 
                    onClick={() => speakSuggestion(coachSuggestion)} 
                    style={{ background: '#E0E7FF', border: 'none', padding: '5px 10px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px' }}
                   >
                     {isSpeaking ? "🔊 Membaca..." : "🔈 Dengar Suara"}
                   </button>
                </div>
                <div style={{ whiteSpace: 'pre-line', marginBottom: '20px', fontSize: '15px', lineHeight: '1.6', color: '#333' }}>{coachSuggestion}</div>
                <button onClick={() => { window.speechSynthesis.cancel(); setCoachSuggestion(""); }} style={styles.closeCoachBtn}>Faham, Terima Kasih! ✨</button>
              </div>
            </div>
          )}

          <div style={{ fontSize: '12px', color: '#666', margin: '10px 0', background: '#f0f0f0', padding: '8px', borderRadius: '5px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Status: {activeId ? `✅ Terhubung` : `🔗 Mencari ID...`} | Pelajar: {studentName}</span>
            <span style={{ fontWeight: 'bold', color: '#6C5CE7' }}>💎 Kredit: {credits ?? '...'}</span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSaveProgress} disabled={isSaving} style={{ ...styles.submitBtn, backgroundColor: '#FFF', color: '#6C5CE7', border: '2px solid #6C5CE7', flex: 1 }}>{isSaving ? "⏳..." : "💾 Simpan Progress"}</button>
            <button onClick={handleSemak} disabled={loading} style={{ ...styles.submitBtn, flex: 2 }}>{loading ? "⚡ Memproses..." : "Hantar Misi! ✨"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// STYLES ARE IDENTICAL TO YOURS WITH MINOR COACH UPDATES
const styles = {
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
  textarea: { width: '100%', height: '420px', borderRadius: '10px', border: '2px solid #EEE', padding: '15px', fontSize: '17px', outline: 'none', resize: 'none' },
  submitBtn: { width: '100%', padding: '15px', borderRadius: '10px', border: 'none', backgroundColor: '#6C5CE7', color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' },
  coachBtn: { width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '12px', border: 'none', backgroundColor: '#6C5CE7', color: 'white', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(108, 92, 231, 0.2)' },
  coachOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  coachContent: { backgroundColor: 'white', padding: '25px', borderRadius: '20px', maxWidth: '500px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', border: '4px solid #E0E7FF' },
  closeCoachBtn: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#6C5CE7', color: 'white', fontWeight: 'bold', cursor: 'pointer' }
};