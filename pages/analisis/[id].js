import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function RetypeCorrection() {
  const router = useRouter();
  const { id, classId, mode } = router.query;
  const [data, setData] = useState(null);
  const [rewrite, setRewrite] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
const [user, setUser] = useState(null);

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
    if (!currentUser) {
      // Only redirect to login if there is no studentUser in localStorage either
      if (!localStorage.getItem("studentUser")) {
        router.replace('/');
      }
    } else {
      setUser(currentUser);
    }
  });
  return () => unsubscribe();
}, [router]);

  useEffect(() => {
    if (id) {
      getDoc(doc(db, 'karanganResults', id)).then(snap => {
        if (snap.exists()) {
          const fetchedData = snap.data();
          setData(fetchedData);
          setRewrite(fetchedData.lastRewrite || fetchedData.karanganAsal || "");
          setCurrentStep(fetchedData.solvedMissions?.length || 0);
        }
        setLoading(false);
      });
    }
  }, [id]);

  const checkCorrection = () => {
    const target = data?.kesalahanBahasa[currentStep]?.pembetulan?.toLowerCase().trim();
    const currentWork = rewrite.toLowerCase();
    if (!target) return true;
    if (!currentWork.includes(target)) {
      setErrorMsg(`Ops! Pastikan anda telah memasukkan pembetulan: "${target}"`);
      return false;
    }
    setErrorMsg("");
    return true;
  };

  const saveProgress = async (isFinal = false) => {
    if (isFinal && !checkCorrection()) return;
    setIsSaving(true);
    try {
      const solvedUntilNow = Array.from({ length: isFinal ? data?.kesalahanBahasa?.length : currentStep + 1 }, (_, i) => i);
      await updateDoc(doc(db, 'karanganResults', id), {
        lastRewrite: rewrite,
        solvedMissions: solvedUntilNow,
        status: isFinal ? 'murni_completed' : 'murni_in_progress',
        lastUpdated: new Date().toISOString()
      });
      if (isFinal) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#6366F1', '#10B981', '#FFD93D'] });
        setTimeout(() => { handleExitOnly(); }, 2000);
      }
    } catch (err) {
      console.error("Firestore Error:", err);
      alert("Gagal menyimpan.");
    } finally {
      setIsSaving(false);
    }
  };

const handleRewrite = () => {
  if (window.confirm("Adakah anda pasti? Semua progress pembetulan semasa akan hilang dan anda akan bermula dengan kertas kosong.")) {
    router.push({
      pathname: '/semakan',
      query: { 
        taskId: data?.taskId, 
        classId: classId || data?.classId,
        studentId: data?.studentId,
        overwrite: 'true' // This tells semakan.js to clear the essay
      }
    });
  }
};

// --- UPDATED EXIT LOGIC ---
const handleExitOnly = () => {
  const targetClass = classId || data?.classId;
  const targetAssignment = data?.taskId; 

  // Check if current user is a teacher via Firebase Auth or the URL mode
  const isTeacherMode = mode === 'teacher' || auth.currentUser !== null;

  if (isTeacherMode && targetAssignment && targetClass) {
    router.push(`/Class/track/${targetAssignment}?classId=${targetClass}`);
  } else if (isTeacherMode && targetClass) {
    router.push(`/Class/${targetClass}`);
  } else {
    router.push('/student-dashboard');
  }
};

  const handleNextMission = () => {
    if (checkCorrection()) {
      saveProgress(false); 
      if (currentStep < (data?.kesalahanBahasa?.length - 1)) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  if (loading) return <div style={styles.loader}>Menyediakan Meja Tulis... ✍️</div>;

  const missions = data?.kesalahanBahasa || [];
  const currentMission = missions[currentStep];
  const isLastStep = currentStep >= missions.length - 1;

  // UPDATED MARKAH LOGIC
  const studentLevel = data?.level?.toString().toUpperCase() || "P4";
const isHighLevel = studentLevel === 'P5' || studentLevel === 'P6' || studentLevel === '5' || studentLevel === '6';

const totalMax = isHighLevel ? 40 : 15;
const breakdownLabel = isHighLevel ? "Isi: 20, Bahasa: 20" : "Isi: 7, Bahasa: 8";

  return (
    <div style={styles.container}>
 <nav style={styles.nav}>
  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
    <button onClick={() => saveProgress(true)} style={styles.backBtn} disabled={isSaving}>
      {isSaving ? "⏳ Menyimpan..." : (mode === 'teacher' ? "🏠 Simpan & Kembali" : "🏠 Simpan & Dashboard")}
    </button>
    
    <button onClick={handleExitOnly} style={styles.exitBtn}>🚪 Keluar</button>
    
    <button onClick={handleRewrite} style={{...styles.exitBtn, backgroundColor: '#FEF2F2', color: '#EF4444', borderColor: '#FECACA'}}>
      🔄 Tulis Semula
    </button>
  </div>
  {/* Ensure there is NO stray button here before the progressContainer starts */}
  <div style={styles.progressContainer}>

          <div style={styles.progressText}>Misi Pembetulan: {currentStep + 1} / {missions.length}</div>
          <div style={styles.progressBar}>
            <div style={{...styles.progressFill, width: `${((currentStep + 1)/missions.length)*100}%`}} />
          </div>
        </div>
      </nav>

      <div style={styles.layout}>
{/* LEFT PANEL */}
        <section style={styles.panel}>
          <div style={styles.panelHeader}>📜 RUJUKAN & ULASAN</div>
          <div style={styles.scrollArea}>
            

            {/* Detailed Grade Badge */}
            <div style={styles.gradeBadge}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>
                Jumlah Markah: <b>{data?.markah || 0} / {totalMax}</b>
              </div>
              <div style={{ display: 'flex', gap: '15px', fontSize: '14px', borderTop: '1px solid #C7D2FE', paddingTop: '8px' }}>
                <span>📝 Isi: <b>{data?.pemarkahan?.isi || 0}</b></span>
                <span>✍️ Bahasa: <b>{data?.pemarkahan?.bahasa || 0}</b></span>
              </div>
            </div>

<button onClick={handleRewrite} style={styles.rewriteBtn}>
  🔄 Tulis Semula (Mula Baru)
</button>

            <div style={styles.teacherComment}>
               <div style={{ marginBottom: '8px', color: '#92400E', fontWeight: '800', fontSize: '13px' }}>💬 ULASAN CIKGU AI:</div>
               <p style={{ margin: 0 }}>{data?.ulasan || "Tahniah! Teruskan usaha murni anda."}</p>
               
               {/* Context for Students */}
               <div style={{ marginTop: '12px', fontSize: '12px', fontStyle: 'italic', opacity: 0.8, color: '#92400E' }}>
                 *Isi = Idea & Fakta | Bahasa = Tatabahasa & Ejaan
               </div>
            </div>

            <hr style={{ border: '0.5px solid #E2E8F0', margin: '20px 0' }} />
            <div style={styles.essayOriginal} dangerouslySetInnerHTML={{ __html: data?.karanganUnderlined }} />
          </div>
        </section>

        {/* RIGHT PANEL */}
        <section style={styles.panel}>
          <div style={styles.panelHeader}>✍️ ARAHAN & PEMBETULAN</div>
          
          <div style={styles.hintBox}>
            <div style={styles.hintTitle}>💡 ARAHAN SEMASA:</div>
            {currentMission ? (
              <>
                <p style={styles.hintText}>
                  Cari: <span style={{color: '#E63946', fontWeight: 'bold'}}>"{currentMission.ayatSalah}"</span>
                  <br />
                  Ganti: <span style={{color: '#2A9D8F', fontWeight: 'bold'}}>"{currentMission.pembetulan}"</span>
                </p>
                {errorMsg && <div style={styles.errorBanner}>{errorMsg}</div>}
                {!isLastStep ? (
                  <button onClick={handleNextMission} style={styles.nextBtn}>Misi Seterusnya ➡️</button>
                ) : (
                  <button onClick={() => saveProgress(true)} style={styles.finishBtn}>Siap Semua! ✅</button>
                )}
              </>
            ) : <p>Tahniah! Klik simpan untuk selesai.</p>}
          </div>

          <textarea
            style={styles.textarea}
            value={rewrite}
            onChange={(e) => { setRewrite(e.target.value); if(errorMsg) setErrorMsg(""); }}
            placeholder="Tulis semula karangan yang betul di sini..."
          />
        </section>
      </div>
    </div>
  );
}

const styles = {
  errorBanner: { padding: '8px', backgroundColor: '#FFF1F2', color: '#E11D48', borderRadius: '8px', fontSize: '13px', marginBottom: '10px', border: '1px solid #FECDD3', fontWeight: 'bold' },
  container: { backgroundColor: '#F0F4F8', minHeight: '100vh', padding: '0 20px 20px 20px', fontFamily: '"Plus Jakarta Sans", sans-serif' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', maxWidth: '1400px', margin: '0 auto' },
  backBtn: { padding: '12px 24px', borderRadius: '12px', border: 'none', backgroundColor: '#4338CA', color: '#FFF', fontWeight: 'bold', cursor: 'pointer' },
  exitBtn: { padding: '12px 24px', borderRadius: '12px', border: '1px solid #CBD5E1', backgroundColor: '#FFF', color: '#64748B', fontWeight: 'bold', cursor: 'pointer' },
  progressContainer: { width: '350px' },
  progressText: { fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', textAlign: 'right', color: '#475569' },
  progressBar: { width: '100%', height: '10px', backgroundColor: '#E2E8F0', borderRadius: '10px', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10B981', transition: 'width 0.4s ease-out' },
  layout: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', maxWidth: '1400px', margin: '0 auto', height: 'calc(100vh - 100px)' },
  panel: { backgroundColor: '#FFF', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #E2E8F0' },
  panelHeader: { padding: '15px 25px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: '12px', fontWeight: '800', color: '#94A3B8', letterSpacing: '1px' },
  scrollArea: { padding: '30px', flex: 1, overflowY: 'auto', backgroundColor: '#FAFAFA' },
  essayOriginal: { fontSize: '18px', lineHeight: '2.2', color: '#334155' },
  textarea: { flex: 1, padding: '30px', fontSize: '19px', lineHeight: '2.2', border: 'none', outline: 'none', resize: 'none', color: '#1E293B' },
  hintBox: { padding: '20px', backgroundColor: '#F5F7FF', borderBottom: '1px solid #E2E8F0' },
  hintTitle: { fontWeight: '800', color: '#4338CA', marginBottom: '8px', fontSize: '13px' },
  hintText: { fontSize: '15px', color: '#1E293B', marginBottom: '10px' },
  nextBtn: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#6366F1', color: '#FFF', fontWeight: 'bold', cursor: 'pointer' },
  finishBtn: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#10B981', color: '#FFF', fontWeight: 'bold', cursor: 'pointer' },
  gradeBadge: { display: 'inline-block', padding: '10px 15px', backgroundColor: '#EEF2FF', color: '#4338CA', borderRadius: '12px', fontWeight: 'bold', marginBottom: '15px' },
  teacherComment: { fontSize: '15px', color: '#475569', lineHeight: '1.6', backgroundColor: '#FFFBEB', padding: '15px', borderRadius: '12px', borderLeft: '4px solid #F6E05E' },
  loader: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '18px', color: '#4338CA', fontWeight: 'bold' }, 
rewriteBtn: {
  display: 'block', 
  width: '100%', 
  padding: '10px', 
  marginTop: '10px', 
  borderRadius: '10px', 
  border: '2px solid #6366F1', 
  backgroundColor: 'transparent', 
  color: '#4338CA', 
  fontWeight: 'bold', 
    cursor: 'pointer',
    marginBottom: '15px'
  } 
};