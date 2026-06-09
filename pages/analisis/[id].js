import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import confetti from 'canvas-confetti';

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
  
  // Tracking localized student attempt per mission
  const [studentAttempt, setStudentAttempt] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser && !localStorage.getItem("studentUser")) {
        router.replace('/');
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
          
          const activeStep = fetchedData.solvedMissions?.length || 0;
          setCurrentStep(activeStep);
          
          const targetMission = fetchedData.kesalahanBahasa?.[activeStep];
          if (targetMission) {
            setStudentAttempt(targetMission.ayatSalah || "");
          }
        }
        setLoading(false);
      });
    }
  }, [id]);

  const currentMission = data?.kesalahanBahasa?.[currentStep];

  // Sync localized input when step moves forward
  useEffect(() => {
    if (currentMission) {
      setStudentAttempt(currentMission.ayatSalah || "");
      setErrorMsg("");
    }
  }, [currentStep, currentMission]);

  const checkCorrection = () => {
    if (!currentMission) return true;
    
    const targetFix = currentMission.pembetulan.toLowerCase().trim();
    const cleanAttempt = studentAttempt.toLowerCase().trim();

    if (cleanAttempt === currentMission.ayatSalah.toLowerCase().trim()) {
      setErrorMsg("✏️ Anda belum membuat sebarang pembetulan pada ayat ini.");
      return false;
    }

    if (!cleanAttempt.includes(targetFix)) {
      setErrorMsg(`💡 Hampir tepat! Pastikan perkataan "${currentMission.pembetulan}" dimasukkan dalam ayat baru anda.`);
      return false;
    }

    setErrorMsg("");
    return true;
  };

  const applyCorrectionToMasterText = () => {
    if (!currentMission) return rewrite;
    
    const originalText = rewrite;
    const findPhrase = currentMission.ayatSalah;
    
    if (originalText.includes(findPhrase)) {
      return originalText.replace(findPhrase, studentAttempt);
    }
    
    return originalText;
  };

  const saveProgress = async (isFinal = false) => {
    if (!isFinal && !checkCorrection()) return false;
    
    setIsSaving(true);
    const updatedMasterText = applyCorrectionToMasterText();
    setRewrite(updatedMasterText);

    try {
      const solvedUntilNow = Array.from(
        { length: isFinal ? data?.kesalahanBahasa?.length : currentStep + 1 }, 
        (_, i) => i
      );
      
      await updateDoc(doc(db, 'karanganResults', id), {
        lastRewrite: updatedMasterText,
        solvedMissions: solvedUntilNow,
        status: isFinal ? 'murni_completed' : 'murni_in_progress',
        lastUpdated: new Date().toISOString()
      });

      if (isFinal) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#6366F1', '#10B981', '#FFD93D'] });
        setTimeout(() => { handleExitOnly(); }, 2000);
      }
      return true;
    } catch (err) {
      console.error("Firestore Error:", err);
      alert("Gagal menyimpan.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleNextMission = async () => {
    const success = await saveProgress(false);
    if (success && currentStep < (data?.kesalahanBahasa?.length - 1)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleRewrite = () => {
    if (window.confirm("Adakah anda pasti? Semua progress pembetulan semasa akan hilang.")) {
      router.push({
        pathname: '/semakan',
        query: { 
          taskId: data?.taskId, 
          classId: classId || data?.classId,
          studentId: data?.studentId,
          overwrite: 'true' 
        }
      });
    }
  };

  const handleExitOnly = () => {
    const targetClass = classId || data?.classId;
    const targetAssignment = data?.taskId; 
    const isTeacherMode = mode === 'teacher' || auth.currentUser !== null;

    if (isTeacherMode && targetAssignment && targetClass) {
      router.push(`/Class/track/${targetAssignment}?classId=${targetClass}`);
    } else if (isTeacherMode && targetClass) {
      router.push(`/Class/${targetClass}`);
    } else {
      router.push('/student-dashboard');
    }
  };

  /**
   * Generates a dynamic layout string featuring a highlighted active background 
   * for the current mission sentence inside the Left Preview Panel.
   */
  const getHighlightedEssayHtml = () => {
    let baseHtml = data?.karanganUnderlined || "";
    if (!currentMission || !currentMission.ayatSalah) return baseHtml;

    const targetedPhrase = currentMission.ayatSalah;
    
    // Inject custom styling around the active target phrase
    if (baseHtml.includes(targetedPhrase)) {
      const activeHighlightStyle = `background-color: #FEF08A; color: #1E293B; font-weight: 600; padding: 2px 4px; border-radius: 4px; border-bottom: 2px dashed #EAB308;`;
      return baseHtml.replace(
        targetedPhrase,
        `<span style="${activeHighlightStyle}">${targetedPhrase}</span>`
      );
    }
    return baseHtml;
  };

  if (loading) return <div style={styles.loader}>Menyediakan Meja Tulis... ✍️</div>;

  const missions = data?.kesalahanBahasa || [];
  const isLastStep = currentStep >= missions.length - 1;

  // GRADING SYSTEM CONFIGURATIONS
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
          <button onClick={handleRewrite} style={styles.rewriteActionBtn}>
            🔄 Tulis Semula
          </button>
        </div>
        <div style={styles.progressContainer}>
          <div style={styles.progressText}>Misi Pembetulan: {currentStep + 1} / {missions.length}</div>
          <div style={styles.progressBar}>
            <div style={{...styles.progressFill, width: `${((currentStep + 1)/missions.length)*100}%`}} />
          </div>
        </div>
      </nav>

      <div style={styles.layout}>
        {/* LEFT PANEL: CONTEXTUAL REFERENCE WITH LIVE HIGHLIGHT ENGINE */}
        <section style={styles.panel}>
          <div style={styles.panelHeader}>📜 RUJUKAN & ULASAN</div>
          <div style={styles.scrollArea}>
            
            <div style={styles.gradeBadge}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>
                Jumlah Markah: <b>{data?.markah || 0} / {totalMax}</b>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #C7D2FE', paddingTop: '8px' }}>
                <div style={{ display: 'flex', gap: '15px', fontSize: '14px' }}>
                  <span>📝 Isi: <b>{data?.pemarkahan?.isi || 0}</b></span>
                  <span>✍️ Bahasa: <b>{data?.pemarkahan?.bahasa || 0}</b></span>
                </div>
                <div style={{ fontSize: '11px', color: '#4338CA', opacity: 0.8, fontWeight: '600' }}>
                  📋 Skema Pembahagian ({breakdownLabel})
                </div>
              </div>
            </div>

            <button onClick={handleRewrite} style={styles.rewriteBtn}>
              🔄 Tulis Semula (Mula Baru)
            </button>

            <div style={styles.teacherComment}>
               <div style={{ marginBottom: '8px', color: '#92400E', fontWeight: '800', fontSize: '13px' }}>💬 ULASAN CIKGU AI:</div>
               <p style={{ margin: 0 }}>{data?.ulasan || "Tahniah! Teruskan usaha murni anda."}</p>
               
               <div style={{ marginTop: '12px', fontSize: '12px', fontStyle: 'italic', opacity: 0.8, color: '#92400E' }}>
                 *Isi = Idea & Fakta | Bahasa = Tatabahasa & Ejaan
               </div>
            </div>

            <hr style={{ border: '0.5px solid #E2E8F0', margin: '20px 0' }} />
            <div style={styles.essayViewContainer}>
              <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#64748B', marginBottom: '10px' }}>📄 PRATONTON KARANGAN:</div>
              <div style={styles.essayOriginal} dangerouslySetInnerHTML={{ __html: getHighlightedEssayHtml() }} />
            </div>
          </div>
        </section>

        {/* RIGHT PANEL: INTERACTIVE WORKSPACE LOADED WITH AI ERROR ANALYSIS METADATA */}
        <section style={styles.panel}>
          <div style={styles.panelHeader}>✍️ ARAHAN & PEMBETULAN</div>
          
          {currentMission ? (
            <div style={styles.interactiveCorrectionWorkspace}>
              <div style={styles.missionCard}>
                <div style={styles.metaRow}>
                  <span style={styles.badgeDanger}>⚠️ Jumpa Kesalahan</span>
                  <span style={styles.badgeSuccess}>🎯 Target Pembetulan</span>
                  {/* Dynamic Error Category Token imported via the AI output framework */}
                  {currentMission.kategori && (
                    <span style={styles.badgeCategory}>🏷️ {currentMission.kategori}</span>
                  )}
                </div>
                
                <div style={styles.comparisonGrid}>
                  <div style={styles.comparisonBoxRed}>
                    <div style={styles.boxLabel}>Ayat Asal:</div>
                    <div style={styles.boxContent}>"{currentMission.ayatSalah}"</div>
                  </div>
                  <div style={styles.comparisonBoxGreen}>
                    <div style={styles.boxLabel}>Gantikan Dengan Perkataan:</div>
                    <div style={styles.boxContent}><b>{currentMission.pembetulan}</b></div>
                  </div>
                </div>

                {/* AI Linguistic Analysis Rule block integrated from prompt conditions */}
                {currentMission.penjelasan && (
                  <div style={styles.analysisBox}>
                    <div style={styles.analysisLabel}>💡 ANALISIS KESALAHAN GURU:</div>
                    <div style={styles.analysisText}>{currentMission.penjelasan}</div>
                  </div>
                )}
              </div>

              <div style={styles.interactiveArea}>
                <label style={styles.inputLabel}>✍️ Baiki ayat di dalam kotak ini:</label>
                <textarea
                  ref={textareaRef}
                  style={styles.focusedTextarea}
                  value={studentAttempt}
                  onChange={(e) => { setStudentAttempt(e.target.value); if(errorMsg) setErrorMsg(""); }}
                  placeholder="Sunting ayat salah di sini supaya menjadi betul..."
                />
                {errorMsg && <div style={styles.errorBanner}>{errorMsg}</div>}
              </div>

              <div style={styles.actionBlock}>
                {!isLastStep ? (
                  <button onClick={handleNextMission} style={styles.nextBtn}>Misi Seterusnya ➡️</button>
                ) : (
                  <button onClick={() => saveProgress(true)} style={styles.finishBtn}>Siap Semua! ✅</button>
                )}
              </div>
            </div>
          ) : (
            <div style={styles.completedState}>
              <h3>🎉 Hebat! Semua pembetulan selesai!</h3>
              <p>Klik butang di bawah untuk menyimpan dan kembali.</p>
              <button onClick={() => saveProgress(true)} style={styles.finishBtn}>Simpan & Selesai</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const styles = {
  container: { backgroundColor: '#F0F4F8', minHeight: '100vh', padding: '0 20px 20px 20px', fontFamily: '"Plus Jakarta Sans", sans-serif' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', maxWidth: '1400px', margin: '0 auto' },
  backBtn: { padding: '12px 24px', borderRadius: '12px', border: 'none', backgroundColor: '#4338CA', color: '#FFF', fontWeight: 'bold', cursor: 'pointer' },
  exitBtn: { padding: '12px 24px', borderRadius: '12px', border: '1px solid #CBD5E1', backgroundColor: '#FFF', color: '#64748B', fontWeight: 'bold', cursor: 'pointer' },
  rewriteActionBtn: { padding: '12px 24px', borderRadius: '12px', border: '1px solid #FECACA', backgroundColor: '#FEF2F2', color: '#EF4444', fontWeight: 'bold', cursor: 'pointer' },
  progressContainer: { width: '350px' },
  progressText: { fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', textAlign: 'right', color: '#475569' },
  progressBar: { width: '100%', height: '10px', backgroundColor: '#E2E8F0', borderRadius: '10px', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10B981', transition: 'width 0.4s ease-out' },
  layout: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', maxWidth: '1400px', margin: '0 auto', height: 'calc(100vh - 100px)' },
  panel: { backgroundColor: '#FFF', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #E2E8F0' },
  panelHeader: { padding: '15px 25px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: '12px', fontWeight: '800', color: '#94A3B8', letterSpacing: '1px' },
  scrollArea: { padding: '30px', flex: 1, overflowY: 'auto', backgroundColor: '#FAFAFA' },
  essayViewContainer: { border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', backgroundColor: '#FFF' },
  essayOriginal: { fontSize: '18px', lineHeight: '2.2', color: '#334155' },
  
  interactiveCorrectionWorkspace: { display: 'flex', flexDirection: 'column', flex: 1, padding: '24px', gap: '20px', backgroundColor: '#FAFAFA' },
  missionCard: { backgroundColor: '#FFF', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '12px' },
  metaRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  badgeDanger: { padding: '4px 8px', backgroundColor: '#FFE4E6', color: '#E11D48', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' },
  badgeSuccess: { padding: '4px 8px', backgroundColor: '#D1FAE5', color: '#059669', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' },
  badgeCategory: { padding: '4px 8px', backgroundColor: '#EFF6FF', color: '#1D4ED8', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #BFDBFE' },
  comparisonGrid: { display: 'flex', flexDirection: 'column', gap: '10px' },
  comparisonBoxRed: { padding: '12px', backgroundColor: '#FFF1F2', borderRadius: '8px', borderLeft: '4px solid #F43F5E' },
  comparisonBoxGreen: { padding: '12px', backgroundColor: '#F0FDF4', borderRadius: '8px', borderLeft: '4px solid #10B981' },
  boxLabel: { fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '2px' },
  boxContent: { fontSize: '14px', color: '#1E293B' },

  analysisBox: { padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1', marginTop: '4px' },
  analysisLabel: { fontSize: '11px', fontWeight: '800', color: '#475569', marginBottom: '4px', letterSpacing: '0.02em' },
  analysisText: { fontSize: '13px', color: '#475569', lineHeight: '1.5' },
  
  interactiveArea: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' },
  inputLabel: { fontSize: '13px', fontWeight: '700', color: '#334155' },
  focusedTextarea: { flex: 1, width: '100%', minHeight: '120px', padding: '20px', fontSize: '18px', lineHeight: '1.8', borderRadius: '12px', border: '2px solid #6366F1', outline: 'none', resize: 'none', fontFamily: 'inherit', color: '#1E293B', backgroundColor: '#FFF' },
  errorBanner: { padding: '8px', backgroundColor: '#FFF1F2', color: '#E11D48', borderRadius: '8px', fontSize: '13px', border: '1px solid #FECDD3', fontWeight: 'bold' },
  actionBlock: { marginTop: 'auto' },
  
  nextBtn: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#6366F1', color: '#FFF', fontWeight: 'bold', cursor: 'pointer' },
  finishBtn: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#10B981', color: '#FFF', fontWeight: 'bold', cursor: 'pointer' },
  gradeBadge: { display: 'inline-block', padding: '10px 15px', backgroundColor: '#EEF2FF', color: '#4338CA', borderRadius: '12px', fontWeight: 'bold', marginBottom: '15px' },
  teacherComment: { fontSize: '15px', color: '#475569', lineHeight: '1.6', backgroundColor: '#FFFBEB', padding: '15px', borderRadius: '12px', borderLeft: '4px solid #F6E05E' },
  completedState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px', textAlign: 'center', color: '#334155' },
  loader: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '18px', color: '#4338CA', fontWeight: 'bold' }, 
  rewriteBtn: { display: 'block', width: '100%', padding: '10px', marginTop: '10px', borderRadius: '10px', border: '2px solid #6366F1', backgroundColor: 'transparent', color: '#4338CA', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px' } 
};