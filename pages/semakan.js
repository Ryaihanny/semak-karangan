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

  // --- NEW STATES FOR ID DETECTION ---
  const [activeId, setActiveId] = useState(null);
  const [studentName, setStudentName] = useState(nama || "Pelajar");
  const [credits, setCredits] = useState(null);

  const tools = {
    mula: { label: "🌅 Mula", items: ["Pada suatu hari yang cerah...", "Suasana di _____ sungguh riuh-rendah.", "Kelihatan orang ramai sedang..."] },
    hubung: { label: "🔗 Hubung", items: ["Seterusnya,", "Dalam pada itu,", "Oleh hal yang demikian,", "Tiba-tiba..."] },
    perasaan: { label: "🧠 Perasaan", items: ["gembira (happy) - gembira bukan kepalang", "gembira (happy) - senyuman lebar hingga ke telinga", "gementar (nervous) - jantung berdegup kencang seperti mahu luruh", "gementar (nervous) - peluh dingin mula membasahi dahi", "panik (panic) - keadaan menjadi kelam-kabut", "panik (panic) - terpinga-pinga seperti rusa masuk kampung", "sedih (sad) - air mata mula berlinangan", "sedih (sad) - hati hancur luluh bagai kaca terhempas ke batu"] }
  };

// --- 1. LOAD DATA & IDENTIFY STUDENT (UPDATED) ---
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
          // IMPORTANT: Create document with 5 starter credits to prevent permission errors
          console.log("Creating new user document for credits...");
          await setDoc(studentRef, { 
            credits: 5, 
            name: studentName,
            role: 'student',
            createdAt: serverTimestamp()
          }, { merge: true });
          setCredits(5);
        }
      } catch (err) {
        console.error("Error fetching credits:", err);
        setCredits(0);
      }
        
      if (taskId) {
        try {
          const draftRef = doc(db, 'drafts', `${identifier}_${taskId}`);
          const snap = await getDoc(draftRef);
          if (snap.exists()) {
            setEssay(snap.data().essay);
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
}, [taskId, studentId, studentName]); // Added studentName to ensure setDoc has latest name

  useEffect(() => {
    if (taskId) {
      fetch(`/api/get-task?taskId=${taskId}`)
        .then(res => res.json())
        .then(data => setTaskData(data))
        .catch(err => console.error("Gagal muat turun tugasan:", err));
    }
  }, [taskId]);

  // --- 2. SAVE PROGRESS ---
  const handleSaveProgress = async () => {
    const finalId = activeId || auth.currentUser?.uid || studentId;
    if (!finalId) return alert("ID tidak dikesan.");
    if (!essay.trim()) return alert("Sila tulis karangan sebelum simpan.");

    setIsSaving(true);
    try {
      const draftRef = doc(db, 'drafts', `${finalId}_${taskId || 'umum'}`);
      await setDoc(draftRef, {
        userId: finalId,
        taskId: taskId || 'umum',
        essay: essay,
        nama: studentName,
        updatedAt: serverTimestamp()
      });
      alert("Progress berjaya disimpan! ✨");
    } catch (err) {
      alert("Gagal menyimpan.");
    } finally {
      setIsSaving(false);
    }
  };

// --- 3. HANDLE SEMAK ---
const handleSemak = async (e) => {
  if (e) e.preventDefault();

  if (credits !== null && credits <= 0) {
    return alert("Ops! Kredit anda telah habis. Sila hubungi cikgu! 💎");
  }

  const wordCount = essay.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 10) return alert("Ops! Karangan anda terlalu pendek. ✍️");
  
  setLoading(true);

  const savedUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("studentUser") || "{}") : {};
  const currentClassId = classId || router.query.classId || savedUser.enrolledClasses?.[0] || "umum";
  const finalStudentId = activeId || studentId || savedUser.id;

  if (!finalStudentId || finalStudentId === "undefined") {
    setLoading(false);
    return alert("ID Pelajar tidak sah. Sila login semula.");
  }

  try {
    const response = await fetch('/api/submit-karangan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        essay, 
        studentId: finalStudentId, 
        taskId: taskId || router.query.taskId,
        classId: currentClassId,
        nama: studentName,
        submissionId: submissionId || router.query.submissionId,
        status: "submitted"
      }),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const textError = await response.text();
      console.error("Server returned non-JSON:", textError);
      throw new Error("Server error. Sila semak Railway Logs.");
    }

    const data = await response.json();
    
    if (!response.ok) {
       throw new Error(data.message || "Gagal memproses.");
    }

    if (data.remainingCredits !== undefined) {
        setCredits(data.remainingCredits);
    }

    router.push(`/analisis/${data.id}?classId=${currentClassId}`);
  } catch (err) {
    console.error("Submission Error:", err);
    alert(err.message || "Masalah teknikal.");
  } finally {
    setLoading(false);
  }
}; // <--- THIS WAS MISSING: Closes handleSemak

// --- 4. RENDER UI ---
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
              <button 
                key={key} 
                onClick={() => setActiveTool(key)}
                style={{...styles.tabBtn, backgroundColor: activeTool === key ? '#6C5CE7' : '#FFF', color: activeTool === key ? '#FFF' : '#6C5CE7'}}
              >
                {tools[key].label}
              </button>
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
        <textarea value={essay} onChange={(e) => setEssay(e.target.value)} placeholder="Tulis di sini..." style={styles.textarea} />

        <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px', background: '#f0f0f0', padding: '8px', borderRadius: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            Status: {activeId ? `✅ Terhubung` : `🔗 Mencari ID...`} | Pelajar: {studentName}
          </span>
          <span style={{ fontWeight: 'bold', color: '#6C5CE7', background: '#E0E7FF', padding: '2px 8px', borderRadius: '4px' }}>
            💎 Kredit: {credits !== null ? credits : '...'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button 
            onClick={handleSaveProgress} 
            disabled={isSaving}
            style={{ ...styles.submitBtn, backgroundColor: '#FFF', color: '#6C5CE7', border: '2px solid #6C5CE7', flex: 1 }}
          >
            {isSaving ? "⏳..." : "💾 Simpan Progress"}
          </button>
          <button 
            onClick={handleSemak} 
            disabled={loading}
            style={{ ...styles.submitBtn, flex: 2 }}
          >
            {loading ? "⚡ Memproses..." : "Hantar Misi! ✨"}
          </button>
        </div>
      </div>
    </div>
  </div>
);
} // <--- Closes SemakanPage function

// Leave 'const styles = { ... }' outside at the bottom.
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
  submitBtn: { width: '100%', padding: '15px', borderRadius: '10px', border: 'none', backgroundColor: '#6C5CE7', color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }
};
