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
  const [studentLevel, setStudentLevel] = useState(null);

  const [coachSuggestion, setCoachSuggestion] = useState("");
  const [isCoaching, setIsCoaching] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [isKamusVisible, setIsKamusVisible] = useState(false);
  const [kamusQuery, setKamusQuery] = useState("");
  const [kamusHasil, setKamusHasil] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [selectedPictureIndex, setSelectedPictureIndex] = useState(1); 
  const [builderQuery, setBuilderQuery] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  const [builderResult, setBuilderResult] = useState(null);

  const [shuffledBlocks, setShuffledBlocks] = useState([]);
  const [placedBlocks, setPlacedBlocks] = useState([]);
  const [isGameWon, setIsGameWon] = useState(false);

  const totalPictures = ['P3', 'P4'].includes(studentLevel) ? 4 : ['P5', 'P6'].includes(studentLevel) ? 6 : 0;
  // Requirement 1: True only if student matches specific scaffold criteria
  const isDifferentiatedStudent = ['P3', 'P4', 'P5', 'P6'].includes(studentLevel);

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
    setKamusHasil(null);
    try {
      const res = await fetch('/api/kamus-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perkataan: kamusQuery }),
      });
      const data = await res.json();
      setKamusHasil(data);
    } catch (err) {
      setKamusHasil({ status: "error", message: "Maaf, kamus tidak dapat diakses." });
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
          level: studentLevel,
          instructions: taskData?.instructions,
          taskTitle: taskData?.title 
        }),
      });

      if (!res.ok) {
        const errorData = await res.text();
        throw new Error(`Ralat Server (${res.status}): ${errorData}`);
      }

      const data = await res.json();
      if (data && data.suggestion) {
        setCoachSuggestion(data.suggestion);
      } else {
        throw new Error("Format respons dari AI tidak lengkap.");
      }
    } catch (err) {
      console.error("Ralat Cikgu AI:", err);
      alert(`Maaf, Cikgu AI sedang berehat. ${err.message ? `Maklumat: ${err.message}` : ''}`);
    } finally {
      setIsCoaching(false);
    }
  };

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
      const identifier = studentId || savedUser.id || savedUser.uid || auth.currentUser?.uid;

      if (identifier) {
        setActiveId(identifier);
        if (savedUser.name) setStudentName(savedUser.name);
        if (savedUser.level) setStudentLevel(savedUser.level);

        try {
          const studentRef = doc(db, 'students', identifier);
          const studentSnap = await getDoc(studentRef);
          
          if (studentSnap.exists()) {
            const userData = studentSnap.data();
            setCredits(userData.credits ?? 0);
            setStudentLevel(userData.level); 
            localStorage.setItem("studentUser", JSON.stringify({ ...savedUser, ...userData }));
          } else {
            await setDoc(studentRef, { 
              credits: 5, 
              name: studentName, 
              role: 'student', 
              createdAt: serverTimestamp() 
            }, { merge: true });
            setCredits(5);
          }
        } catch (err) {
          console.error("Database fetch error:", err);
        }

        if (taskId) {
          try {
            const isOverwrite = (router.query.overwrite === 'true') || (overwrite === 'true');
            if (isOverwrite) {
              setEssay(""); 
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

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthReady(true);
      if (user) identifyAndLoad();
    });

    identifyAndLoad();
    return () => unsubscribe();
  }, [taskId, studentId, studentName, overwrite, router.query.overwrite]);

  useEffect(() => {
    if (!activeId || !taskId) return;
    const draftRef = doc(db, 'drafts', `${activeId}_${taskId}`);
    const unsub = onSnapshot(draftRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.feedbackGuru) setFeedback(data.feedbackGuru);
        if (isTeacherMode && data.essay !== undefined) {
          setEssay(data.essay);
        }
      }
    });
    return () => unsub();
  }, [activeId, taskId, isTeacherMode]);

  useEffect(() => {
    if (taskId) {
      fetch(`https://semak-karangan-production.up.railway.app/api/get-task?taskId=${taskId}`)
        .then(res => res.json())
        .then(data => setTaskData(data))
        .catch(err => console.error("Gagal muat turun tugasan:", err));
    }
  }, [taskId]);

  useEffect(() => {
    const finalId = activeId || auth.currentUser?.uid || studentId;
    if (!finalId || !essay.trim()) return;

    setIsSaving(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const draftRef = doc(db, 'drafts', `${finalId}_${taskId || 'umum'}`);
        await setDoc(draftRef, { 
          userId: finalId, 
          taskId: taskId || 'umum', 
          essay: essay, 
          nama: studentName, 
          updatedAt: serverTimestamp() 
        }, { merge: true });
      } catch (err) { 
        console.error("Auto-save failed:", err); 
      } finally { 
        setIsSaving(false); 
      }
    }, 1500);

    return () => clearTimeout(delayDebounceFn);
  }, [essay, activeId, taskId, studentName, studentId]);

  const initializeSentenceGame = (apiPayload) => {
    const shuffled = [...apiPayload.kataKunci].sort(() => Math.random() - 0.5);
    setShuffledBlocks(shuffled);
    setPlacedBlocks([]);
    setIsGameWon(false);
  };

  const handleBuildSentence = async () => {
    if (!builderQuery.trim()) return;
    setIsBuilding(true);
    setBuilderResult(null);
    try {
      const res = await fetch('/api/bina-ayat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          idea: builderQuery,
          studentLevel: studentLevel,
          taskTitle: taskData?.title,
          taskStimulus: taskData?.instructions + ` [Fokus Sasaran: Gambar ${selectedPictureIndex}]`
        }),
      });
      
      if (!res.ok) throw new Error("Gagal memproses.");
      const data = await res.json();
      setBuilderResult(data);
      initializeSentenceGame(data);
    } catch (err) {
      console.error(err);
      alert("Gagal menghubungi pembantu binaan ayat.");
    } finally {
      setIsBuilding(false);
    }
  };

  const handleDragStart = (e, blockId) => {
    e.dataTransfer.setData("blockId", blockId);
  };

  const handleDropOnTrack = (e) => {
    const blockId = e.dataTransfer.getData("blockId");
    const movedBlock = shuffledBlocks.find(b => b.id === blockId) || placedBlocks.find(b => b.id === blockId);
    if (!movedBlock) return;

    const updatedPool = shuffledBlocks.filter(b => b.id !== blockId);
    const updatedTrack = [...placedBlocks.filter(b => b.id !== blockId), movedBlock];

    setShuffledBlocks(updatedPool);
    setPlacedBlocks(updatedTrack);

    if (builderResult && updatedTrack.length === builderResult.susunanBetul.length) {
      const isCorrect = updatedTrack.every((b, idx) => b.id === builderResult.susunanBetul[idx]);
      if (isCorrect) setIsGameWon(true);
    }
  };

  const handleDropBackToPool = (e) => {
    const blockId = e.dataTransfer.getData("blockId");
    const movedBlock = placedBlocks.find(b => b.id === blockId);
    if (!movedBlock) return;

    setPlacedBlocks(placedBlocks.filter(b => b.id !== blockId));
    setShuffledBlocks([...shuffledBlocks, movedBlock]);
    setIsGameWon(false);
  };

  const handleSemak = async (e) => {
    if (e) e.preventDefault();
    if (credits !== null && credits <= 0) return alert("Ops! Kredit anda telah habis. Sila hubungi cikgu! 💎");
    const wordCount = essay.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 10) return alert("Ops! Karangan anda terlalu pendek. ✍️");
    
    setLoading(true);
    const isOverwrite = router.query.overwrite === 'true';
    const savedUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("studentUser") || "{}") : {};
    const finalStudentId = activeId || studentId || savedUser.id || savedUser.uid;

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
          studentLevel: studentLevel, 
          submissionId, 
          status: "submitted",
          isOverwrite: isOverwrite 
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      
      if (data.remainingCredits !== undefined) {
        setCredits(data.remainingCredits);
        localStorage.setItem("studentUser", JSON.stringify({ ...savedUser, credits: data.remainingCredits }));
      }

      router.push(`/analisis/${data.id}?classId=${classId || "umum"}`);
    } catch (err) { 
      alert(err.message); 
    } finally { 
      setLoading(false); 
    }
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
            <h3 style={{ marginTop: 0 }}>📋 Arahan Cikgu:</h3>
            {taskData?.imageUrl && (
              <div style={{ marginBottom: '15px', width: '100%' }}>
                {taskData.imageUrl.split('?')[0].toLowerCase().endsWith('.pdf') ? (
                  <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>
                    <object data={taskData.imageUrl} type="application/pdf" width="100%" height="500px">
                      <iframe
                        src={`https://docs.google.com/viewer?url=${encodeURIComponent(taskData.imageUrl)}&embedded=true`}
                        style={{ width: '100%', height: '500px' }}
                        frameBorder="0"
                      ></iframe>
                    </object>
                    <a href={taskData.imageUrl} target="_blank" rel="noopener noreferrer" style={styles.openPdfBtn}>
                      Buka PDF Skrin Penuh ↗️
                    </a>
                  </div>
                ) : (
                  <img src={taskData.imageUrl} alt="Stimulus" style={styles.stimulusImg} />
                )}
              </div>
            )}
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

          {feedback && (
            <div style={styles.feedbackBanner}>
              <strong>💡 Maklum Balas Cikgu:</strong>
              <p>{feedback}</p>
            </div>
          )}

          {isTeacherMode && (
            <div style={styles.teacherControlPanel}>
              <textarea 
                value={feedback} 
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tulis maklum balas untuk murid..."
                style={styles.teacherTextarea}
              />
              <button onClick={handleSendFeedback} style={styles.teacherSubmitBtn}>Hantar Maklum Balas 📢</button>
            </div>
          )}

          {/* Requirement 1: Hidden to students who are not chosen as scaffolded */}
          {isDifferentiatedStudent && (
            <button onClick={() => setIsBuilderOpen(true)} style={styles.openBuilderBtn}>
              🧩 Main Game Susun Ayat Pintar (Gambar 1-{totalPictures}) ✨
            </button>
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
            <span>
              Status: {activeId ? `✅ Terhubung` : `🔗 Mencari ID...`} | Pelajar: {studentName} | 
              <span style={{ color: '#6C5CE7', fontWeight: 'bold', marginLeft: '5px' }}>
                Tahap: {studentLevel || "Memuat..."}
              </span>
            </span>
            <span style={styles.creditBadge}>💎 Kredit: {credits ?? '...'}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ textAlign: 'center', fontSize: '12px', color: isSaving ? '#6C5CE7' : '#10B981', fontWeight: 'bold' }}>
              {isSaving ? "⏳ Menyimpan auto..." : "✅ Semua perubahan disimpan secara automatik"}
            </div>
            <button 
              onClick={handleSemak} 
              disabled={loading || !studentLevel} 
              style={{ ...styles.submitBtn, opacity: !studentLevel ? 0.6 : 1, cursor: !studentLevel ? 'not-allowed' : 'pointer' }}
            >
              {loading ? "⚡ Memproses..." : !studentLevel ? "⏳ Memuatkan Tahap..." : "Hantar Misi! ✨"}
            </button>
          </div>
        </div>
      </div>

      <button onClick={() => setIsKamusVisible(!isKamusVisible)} style={styles.floatingToggle}>
        {isKamusVisible ? "✖" : "📖 Kamus"}
      </button>

      {isKamusVisible && (
        <div style={styles.floatingKamus}>
          <div style={styles.kamusHeader}>📖 Kamus Pintar Ajaib</div>
          <div style={{ padding: '12px' }}>
            <input 
              value={kamusQuery} 
              onChange={(e) => setKamusQuery(e.target.value)}
              placeholder="Taip English / Melayu..."
              style={styles.kamusInput}
              onKeyDown={(e) => e.key === 'Enter' && handleKamusSearch()}
            />
            <button onClick={handleKamusSearch} disabled={isSearching} style={styles.searchBtn}>
              {isSearching ? "Mencari ilmu..." : "Cari Maklumat ✨"}
            </button>
          </div>
          <div style={styles.kamusBody}>
            {isSearching ? (
              <p style={{fontSize: '12px', color: '#6C5CE7', textAlign: 'center', margin: '15px 0'}}>Membuka kitab pangkalan data... ⚡</p>
            ) : kamusHasil ? (
              kamusHasil.status === "error" ? (
                <p style={{ fontSize: '13px', color: '#EF4444', textAlign: 'center', fontWeight: 'bold' }}>{kamusHasil.message}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EEF2F6', padding: '8px', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#4338CA' }}>{kamusHasil.malayWord}</div>
                      <div style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>{kamusHasil.englishWord}</div>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(kamusHasil.malayWord); alert("Perkataan disalin! 📋"); }} style={styles.miniCopyBtn}>
                      📋 Salin
                    </button>
                  </div>

                  <div>
                    <strong style={{ fontSize: '11px', color: '#475569' }}>💡 Meaning (Maksud):</strong>
                    <p style={{ fontSize: '13px', margin: '3px 0 0 0', color: '#1E293B', lineHeight: '1.4' }}>{kamusHasil.maksud}</p>
                  </div>

                  <div style={{ borderLeft: '3px solid #10B981', paddingLeft: '8px', background: '#F0FDF4', padding: '8px', borderRadius: '4px' }}>
                    <strong style={{ fontSize: '11px', color: '#15803D' }}>✍️ Contoh Ayat Karangan:</strong>
                    <p style={{ fontSize: '13px', margin: '4px 0 2px 0', color: '#14532D', fontStyle: 'italic', fontWeight: 'bold' }}>"{kamusHasil.contohAyat}"</p>
                    <p style={{ fontSize: '11px', margin: '0 0 8px 0', color: '#475569' }}>({kamusHasil.contohAyatEnglish})</p>
                    <button onClick={() => { navigator.clipboard.writeText(kamusHasil.contohAyat); alert("Ayat contoh disalin! ✨"); }} style={{ ...styles.miniCopyBtn, backgroundColor: '#10B981', color: '#FFF' }}>
                      🚀 Salin Ayat Ini
                    </button>
                  </div>

                  {kamusHasil.bonusKosakata && kamusHasil.bonusKosakata.length > 0 && (
                    <div style={{ background: '#FFF7ED', padding: '8px', borderRadius: '8px', border: '1px dashed #FED7AA' }}>
                      <strong style={{ fontSize: '11px', color: '#C2410C' }}>🌟 Kata Hebat Bonus:</strong>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {kamusHasil.bonusKosakata.map((kata, idx) => (
                          <span key={idx} onClick={() => { navigator.clipboard.writeText(kata); alert(`"${kata}" disalin!`); }} style={{ background: '#FFF', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', border: '1px solid #FFEDD5', cursor: 'pointer', color: '#EA580C', fontWeight: '500' }}>
                            ➕ {kata}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              <p style={{fontSize: '11px', color: '#94A3B8', textAlign: 'center'}}>Taip perkataan atau "phrase" dalam English/Malay dan tekan Cari.</p>
            )}
          </div>
        </div>
      )}

      {/* THE GAME SCALED STORYBOARD SCATTER BUILDER POPUP MODAL */}
      {isBuilderOpen && (
        <div style={styles.modalOverlay}>
          {/* Requirement 2: Expanded width layout to place the picture panel side by side */}
          <div style={{ ...styles.modalContent, maxWidth: '1100px', width: '95%' }}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ margin: 0, fontSize: '20px' }}>🧩 Permainan Susun Ayat Ajaib</h2>
                <span style={{ fontSize: '12px', opacity: 0.9 }}>Rujuk gambar di sebelah kiri untuk bantu menaip idea anda</span>
              </div>
              <button onClick={() => setIsBuilderOpen(false)} style={styles.modalCloseX}>✖</button>
            </div>

            <div style={styles.modalBodyLayout}>
              {/* Requirement 2: Side Picture reference viewer so students can look and type directly */}
              <div style={styles.modalImagePanel}>
                <h4 style={{ margin: '0 0 10px 0', color: '#1E293B' }}>🖼️ Rujukan Gambar Karangan:</h4>
                {taskData?.imageUrl ? (
                  taskData.imageUrl.split('?')[0].toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={`https://docs.google.com/viewer?url=${encodeURIComponent(taskData.imageUrl)}&embedded=true`}
                      style={{ width: '100%', height: '100%', minHeight: '350px', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                      frameBorder="0"
                    />
                  ) : (
                    <img src={taskData.imageUrl} alt="Reference Panel" style={styles.modalInlineImg} />
                  )
                ) : (
                  <div style={styles.noImagePlaceholder}>Tiada gambar dimuat naik untuk tugasan ini.</div>
                )}
              </div>

              {/* Game interaction panel */}
              <div style={styles.modalGamePanel}>
                <div>
                  <label style={styles.sectionLabel}>🎯 Pilih Gambar Sasaran Anda:</label>
                  <div style={styles.milestoneContainer}>
                    {Array.from({ length: totalPictures }, (_, i) => i + 1).map((idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedPictureIndex(idx);
                          setBuilderResult(null);
                        }}
                        style={{
                          ...styles.milestoneNode,
                          backgroundColor: selectedPictureIndex === idx ? '#6C5CE7' : '#F1F5F9',
                          color: selectedPictureIndex === idx ? '#FFF' : '#475569',
                          borderColor: selectedPictureIndex === idx ? '#5A4AD1' : '#CBD5E1'
                        }}
                      >
                        Gambar {idx}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={styles.scaffoldFormBox}>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#4A5568', fontWeight: 'bold' }}>
                      💡 Masukkan apa sahaja perkataan / frasa (Boleh campur English / Melayu / Typo):
                    </span>
                    <p style={{ margin: '4px 0 10px 0', fontSize: '11px', color: '#718096' }}>
                      Contoh: "boy run because cat chase" atau "dua orang cleaning longkang"
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input value={builderQuery} onChange={(e) => setBuilderQuery(e.target.value)} placeholder="Taip idea anda di sini..." style={styles.scaffoldInput} />
                    <button onClick={handleBuildSentence} disabled={isBuilding || !builderQuery.trim()} style={styles.scaffoldActionBtn}>
                      {isBuilding ? "Menjana Kata..." : "Tukar Ke Game 🪄"}
                    </button>
                  </div>
                </div>

                {builderResult && (
                  <div style={{ animation: 'fadeIn 0.3s ease-out', marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>
                        🚀 Seret (drag) kad perkataan di bawah ke dalam kotak binaan untuk menyusun ayat:
                      </span>
                    </div>

                    <div onDragOver={(e) => e.preventDefault()} onDrop={handleDropBackToPool} style={styles.cardPoolContainer}>
                      {shuffledBlocks.map((block) => (
                        <div
                          key={block.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, block.id)}
                          style={{
                            ...styles.draggableWordCard,
                            backgroundColor: block.jenis === 'kata-kerja' ? '#FEE2E2' : block.jenis === 'kata-nama' ? '#DBEAFE' : '#FEF3C7',
                            borderColor: block.jenis === 'kata-kerja' ? '#FCA5A5' : block.jenis === 'kata-nama' ? '#93C5FD' : '#FDE68A',
                            color: block.jenis === 'kata-kerja' ? '#991B1B' : block.jenis === 'kata-nama' ? '#1E40AF' : '#92400E'
                          }}
                        >
                          <span style={styles.cardMetaLabel}>{block.label}</span>
                          <strong style={{ fontSize: '14px' }}>{block.teks}</strong>
                        </div>
                      ))}
                      {shuffledBlocks.length === 0 && placedBlocks.length === 0 && (
                        <p style={{ margin: 'auto', fontSize: '12px', color: '#94A3B8' }}>Tiada perkataan dimuatkan.</p>
                      )}
                    </div>

                    <div onDragOver={(e) => e.preventDefault()} onDrop={handleDropOnTrack} style={{ ...styles.dropTargetTrack, backgroundColor: isGameWon ? '#ECFDF5' : '#FFF', borderColor: isGameWon ? '#10B981' : '#6C5CE7' }}>
                      {placedBlocks.length === 0 && (
                        <div style={{ margin: 'auto', color: '#94A3B8', fontSize: '13px', textAlign: 'center' }}>
                          📥 Susun kad perkataan anda di sini
                        </div>
                      )}
                      
                      {placedBlocks.map((block) => (
                        <div
                          key={block.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, block.id)}
                          style={{
                            ...styles.draggableWordCard,
                            backgroundColor: block.jenis === 'kata-kerja' ? '#FEE2E2' : block.jenis === 'kata-nama' ? '#DBEAFE' : '#FEF3C7',
                            borderColor: block.jenis === 'kata-kerja' ? '#FCA5A5' : block.jenis === 'kata-nama' ? '#93C5FD' : '#FDE68A',
                            color: block.jenis === 'kata-kerja' ? '#991B1B' : block.jenis === 'kata-nama' ? '#1E40AF' : '#92400E'
                          }}
                        >
                          <span style={styles.cardMetaLabel}>{block.label}</span>
                          <strong>{block.teks}</strong>
                        </div>
                      ))}
                    </div>

                    {isGameWon && (
                      <div style={styles.victoryContainer}>
                        <div style={{ fontSize: '14px', color: '#065F46', fontWeight: 'bold', marginBottom: '8px' }}>
                          🎉 Hebat! Susunan ayat anda betul & gramatis!
                        </div>
                        <button
                          onClick={() => {
                            const completeSentence = placedBlocks.map(b => b.teks).join(" ");
                            setEssay(prev => prev ? prev + " " + completeSentence : completeSentence);
                            setIsBuilderOpen(false);
                            setBuilderResult(null);
                            setBuilderQuery("");
                          }}
                          style={styles.insertSentenceToEssayBtn}
                        >
                          📥 Masukkan Ayat Sempurna Ini ke Karangan Saya
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

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
  writingContainer: { display: 'flex', gap: '15px', width: '100%', alignItems: 'stretch', marginBottom: '10px' },
  textarea: { flex: 1, width: '100%', minWidth: '0', height: '420px', borderRadius: '10px', border: '2px solid #EEE', padding: '15px', fontSize: '17px', outline: 'none', resize: 'none', boxSizing: 'border-box', transition: 'all 0.3s ease' },
  sideCoachPanel: { width: '50%', minWidth: '260px', backgroundColor: '#F8FAFC', borderRadius: '15px', border: '2px solid #E2E8F0', display: 'flex', flexDirection: 'column', height: '420px', boxSizing: 'border-box' },
  sideCoachHeader: { padding: '12px', background: '#6C5CE7', color: 'white', borderRadius: '12px 12px 0 0', fontWeight: 'bold', fontSize: '14px', display: 'flex', justifyContent: 'space-between' },
  miniVoiceBtn: { background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '5px', color: 'white', cursor: 'pointer', padding: '2px 8px' },
  sideCoachBody: { padding: '15px', fontSize: '14px', lineHeight: '1.7', overflowY: 'auto', color: '#334155', whiteSpace: 'pre-line', flex: 1 },
  sideCloseBtn: { padding: '8px', border: 'none', background: 'transparent', color: '#94A3B8', fontSize: '11px', cursor: 'pointer', borderTop: '1px solid #E2E8F0' },
  submitBtn: { width: '100%', padding: '15px', borderRadius: '10px', border: 'none', backgroundColor: '#6C5CE7', color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' },
  coachBtn: { width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '12px', border: 'none', backgroundColor: '#6C5CE7', color: 'white', fontWeight: 'bold', cursor: 'pointer' },
  statusFooter: { fontSize: '12px', color: '#666', margin: '10px 0', background: '#f0f0f0', padding: '8px', borderRadius: '5px', display: 'flex', justifyContent: 'space-between' },
  creditBadge: { fontWeight: 'bold', color: '#6C5CE7' },
  floatingToggle: { position: 'fixed', bottom: '20px', right: '20px', width: '80px', height: '80px', borderRadius: '40px', backgroundColor: '#6C5CE7', color: 'white', border: 'none', boxShadow: '0 4px 15px rgba(108, 92, 231, 0.4)', cursor: 'pointer', fontWeight: 'bold', zIndex: 3000 },
  floatingKamus: { position: 'fixed', bottom: '110px', right: '20px', width: '350px', backgroundColor: 'white', borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '2px solid #E2E8F0', zIndex: 3000, overflow: 'hidden' },
  kamusHeader: { padding: '12px', background: '#6C5CE7', color: 'white', fontWeight: 'bold', fontSize: '14px', textAlign: 'center' },
  kamusInput: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', marginBottom: '8px', boxSizing: 'border-box' },
  searchBtn: { width: '100%', padding: '8px', background: '#6C5CE7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  kamusBody: { padding: '15px', maxHeight: '320px', overflowY: 'auto', borderTop: '1px solid #F1F5F9', backgroundColor: '#F8FAFC' },
  feedbackBanner: { padding: '15px', backgroundColor: '#FFF3CD', border: '1px solid #FFEBAA', borderRadius: '10px', marginBottom: '15px', color: '#856404' },
  teacherControlPanel: { marginBottom: '20px', padding: '12px', border: '2px dashed #10B981', borderRadius: '10px', backgroundColor: '#F0FDF4', display: 'flex', flexDirection: 'column', gap: '8px' },
  teacherTextarea: { width: '100%', height: '80px', borderRadius: '8px', border: '1px solid #10B981', padding: '10px', fontSize: '14px', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  teacherSubmitBtn: { width: '100%', padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#10B981', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 255, 0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(5px)' },
  loaderBox: { textAlign: 'center', padding: '40px', backgroundColor: '#fff', borderRadius: '24px', boxSizing: 'box-sizing', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', maxWidth: '400px' },
  spinner: { width: '50px', height: '50px', border: '5px solid #E2E8F0', borderTop: '5px solid #6366F1', borderRadius: '50%', margin: '0 auto 20px auto', animation: 'spin 1s linear infinite' },
  loadingBarContainer: { width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '10px', marginTop: '20px', overflow: 'hidden' },
  loadingBarFill: { height: '100%', backgroundColor: '#6366F1', width: '50%' },
  openPdfBtn: { display: 'block', textAlign: 'center', fontSize: '12px', padding: '10px', color: '#6C5CE7', fontWeight: 'bold', textDecoration: 'none', background: '#f0eeff' },
  miniCopyBtn: { padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#6C5CE7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' },
  openBuilderBtn: { width: '100%', padding: '14px', marginBottom: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#10B981', color: 'white', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)', transition: 'transform 0.2s' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 5000, backdropFilter: 'blur(4px)' },
  modalContent: { backgroundColor: '#FFF', borderRadius: '20px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', animation: 'slideUp 0.3s ease-out' },
  modalHeader: { padding: '16px 20px', background: '#6C5CE7', color: '#FFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalCloseX: { background: 'transparent', border: 'none', color: '#FFF', fontSize: '18px', cursor: 'pointer', opacity: 0.8 },
  
  // Side-by-side splits for Modal images
  modalBodyLayout: { display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px', padding: '20px', maxHeight: '80vh', overflowY: 'auto' },
  modalImagePanel: { borderRight: '1px solid #E2E8F0', paddingRight: '20px', display: 'flex', flexDirection: 'column' },
  modalInlineImg: { width: '100%', objectFit: 'contain', borderRadius: '8px', maxHeight: '450px', border: '1px solid #CBD5E1' },
  noImagePlaceholder: { padding: '40px', background: '#F8FAFC', color: '#94A3B8', borderRadius: '8px', textAlign: 'center', fontSize: '13px' },
  modalGamePanel: { display: 'flex', flexDirection: 'column', gap: '15px' },

  sectionLabel: { fontSize: '13px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '6px' },
  milestoneContainer: { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' },
  milestoneNode: { padding: '8px 16px', borderRadius: '20px', border: '2px solid', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' },
  scaffoldFormBox: { background: '#F8FAFC', padding: '15px', borderRadius: '12px', border: '1px solid #E2E8F0' },
  scaffoldInput: { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none' },
  scaffoldActionBtn: { padding: '0 18px', background: '#6C5CE7', color: '#FFF', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' },
  cardPoolContainer: { background: '#F1F5F9', padding: '14px', borderRadius: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap', minHeight: '75px', border: '2px dashed #CBD5E1', marginBottom: '15px' },
  dropTargetTrack: { padding: '18px', borderRadius: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', minHeight: '90px', alignItems: 'center', borderWidth: '2px', borderStyle: 'solid', transition: 'all 0.2s' },
  draggableWordCard: { padding: '10px 14px', borderRadius: '10px', borderWidth: '2px', borderStyle: 'solid', cursor: 'grab', userSelect: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', transition: 'transform 0.1s' },
  cardMetaLabel: { fontSize: '10px', opacity: 0.8, marginBottom: '2px', textTransform: 'lowercase', letterSpacing: '0.5px' },
  victoryContainer: { marginTop: '15px', textAlign: 'center', padding: '15px', background: '#D1FAE5', borderRadius: '12px', border: '1px solid #A7F3D0' },
  insertSentenceToEssayBtn: { padding: '12px 20px', background: '#059669', color: '#FFF', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(5, 150, 105, 0.2)' }
};