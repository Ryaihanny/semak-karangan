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
  const [watakName, setWatakName] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  const [builderResult, setBuilderResult] = useState(null);

  const [shuffledBlocks, setShuffledBlocks] = useState([]);
  const [placedBlocks, setPlacedBlocks] = useState([]);
  const [isGameWon, setIsGameWon] = useState(false);

  const [savedSentences, setSavedSentences] = useState(["", "", "", "", ""]);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);

  const totalPictures = ['P3', 'P4'].includes(studentLevel) ? 4 : ['P5', 'P6'].includes(studentLevel) ? 6 : 0;
  const isDifferentiatedStudent = ['P3', 'P4', 'P5', 'P6'].includes(studentLevel);

  const [feedback, setFeedback] = useState("");
  const isTeacherMode = router.query.mode === 'teacher';

  const speakSuggestion = (text) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text); // Fixed syntax error here
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
      if (!res.ok) throw new Error("Ralat Server");
      const data = await res.json();
      setCoachSuggestion(data.suggestion);
    } catch (err) {
      alert("Maaf, Cikgu AI sedang berehat.");
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
    perasaan: { label: "🧠 Perasaan", items: ["gembira - senyuman lebar hingga ke telinga", "gementar - jantung berdegup kencang", "panik - keadaan menjadi kelam-bakut", "sedih - air mata mula berlinangan"] }
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
          }
        } catch (err) {}
        if (taskId) {
          const draftRef = doc(db, 'drafts', `${identifier}_${taskId}`);
          const snap = await getDoc(draftRef);
          if (snap.exists()) setEssay(snap.data().essay);
        }
      }
    };
    onAuthStateChanged(auth, identifyAndLoad);
  }, [taskId, studentId]);

  useEffect(() => {
    const finalId = activeId || auth.currentUser?.uid || studentId;
    if (!finalId || !essay.trim()) return;
    setIsSaving(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const draftRef = doc(db, 'drafts', `${finalId}_${taskId || 'umum'}`);
        await setDoc(draftRef, { userId: finalId, taskId: taskId || 'umum', essay, nama: studentName, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) {
      } finally { setIsSaving(false); }
    }, 1500);
    return () => clearTimeout(delayDebounceFn);
  }, [essay, activeId, taskId]);

  const handleBuildSentence = async () => {
    if (!watakName.trim()) return alert("Sila masukkan nama watak terlebih dahulu!");
    setIsBuilding(true);
    setBuilderResult(null);
    setPlacedBlocks([]);
    setIsGameWon(false);
    try {
      const res = await fetch('/api/bina-ayat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          idea: watakName, 
          studentLevel: studentLevel,
          taskTitle: taskData?.title,
          taskStimulus: taskData?.instructions + ` [Fokus Gambar ${selectedPictureIndex}]`
        }),
      });
      
      if (!res.ok) throw new Error("Gagal.");
      const data = await res.json();
      setBuilderResult(data);
      setShuffledBlocks(data.kataKunci);
    } catch (err) { // Fixed stray structural HTML bracket layout here
      alert("Gagal menghubungi pembantu binaan ayat.");
    } finally {
      setIsBuilding(false);
    }
  };

  const handleDragStart = (e, blockId, sourceZone, instanceIndex = null) => {
    e.dataTransfer.setData("blockId", blockId);
    e.dataTransfer.setData("sourceZone", sourceZone);
    if (instanceIndex !== null) {
      e.dataTransfer.setData("instanceIndex", String(instanceIndex));
    }
  };

  const handleDropOnTrack = (e) => {
    e.preventDefault();
    const blockId = e.dataTransfer.getData("blockId");
    const sourceZone = e.dataTransfer.getData("sourceZone");

    if (sourceZone === "pool") {
      const originalBlock = shuffledBlocks.find(b => b.id === blockId);
      if (!originalBlock) return;

      const newInstance = {
        ...originalBlock,
        uniqueInstanceId: `${blockId}_${Date.now()}_${Math.random()}`
      };
      setPlacedBlocks([...placedBlocks, newInstance]);
    }
  };

  const handleRemoveFromTrack = (indexToRemove) => {
    setPlacedBlocks(placedBlocks.filter((_, idx) => idx !== indexToRemove));
    setIsGameWon(false);
  };

  const verifySentenceStructure = () => {
    if (!builderResult || placedBlocks.length === 0) return;
    
    const userSequence = placedBlocks.map(b => b.id);
    const isCorrect = userSequence.length === builderResult.susunanBetul.length &&
                     userSequence.every((id, idx) => id === builderResult.susunanBetul[idx]);

    if (isCorrect) {
      setIsGameWon(true);
    } else {
      alert("Susunan belum tepat lagi. Cuba urutkan mengikut struktur ayat yang betul! 💪");
    }
  };

  const saveCurrentSentenceSlot = () => {
    const completeStr = placedBlocks.map(b => b.teks).join(" ");
    const updatedSentences = [...savedSentences];
    updatedSentences[activeSentenceIndex] = completeStr;
    setSavedSentences(updatedSentences);
    
    alert(`Ayat ${activeSentenceIndex + 1} disimpan!`);
    setIsGameWon(false);
  };

  const insertAllSentencesToEssay = () => {
    const totalText = savedSentences.filter(s => s.trim() !== "").join("\n");
    setEssay(prev => prev ? prev + "\n" + totalText : totalText);
    setIsBuilderOpen(false);
    setSavedSentences(["", "", "", "", ""]);
    setBuilderResult(null);
    setWatakName("");
  };

  const handleSemak = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://semak-karangan-production.up.railway.app/api/submit-karangan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essay, studentId: activeId, taskId, classId: classId || "umum", nama: studentName, studentLevel }),
      });
      const data = await response.json();
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
            <h3>📋 Arahan Cikgu:</h3>
            {taskData?.imageUrl && <img src={taskData.imageUrl} alt="Stimulus" style={styles.stimulusImg} />}
            <p style={styles.taskText}>{taskData?.instructions}</p>
          </div>
        </div>

        <div style={styles.editorArea}>
          {isDifferentiatedStudent && (
            <button onClick={() => setIsBuilderOpen(true)} style={styles.openBuilderBtn}>
              🧩 Main Game Susun Ayat Pintar (Bina 5 Ayat) ✨
            </button>
          )}

          <textarea value={essay} onChange={(e) => setEssay(e.target.value)} placeholder="Tulis karangan anda di sini..." style={styles.textarea} />
          <button onClick={handleSemak} style={styles.submitBtn}>Hantar Misi! ✨</button>
        </div>
      </div>

      {isBuilderOpen && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '1200px', width: '95%' }}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px' }}>🧩 Bina & Susun 5 Ayat Menarik</h2>
                <span style={{ fontSize: '12px' }}>Selesaikan 5 ayat menggunakan kad bantuan di bawah</span>
              </div>
              <button onClick={() => setIsBuilderOpen(false)} style={styles.modalCloseX}>✖</button>
            </div>

            <div style={styles.modalBodyLayout}>
              <div style={styles.modalImagePanel}>
                <h4 style={{ margin: '0 0 10px 0' }}>🖼️ Rujukan Gambar Karangan:</h4>
                {taskData?.imageUrl ? (
                  <img src={taskData.imageUrl} alt="Reference" style={styles.modalInlineImg} />
                ) : (
                  <div style={styles.noImagePlaceholder}>Tiada gambar rujukan.</div>
                )}
                
                <h4 style={{ margin: '20px 0 10px 0' }}>📈 Kemajuan 5 Ayat Anda:</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  {savedSentences.map((sentence, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setActiveSentenceIndex(idx)}
                      style={{ 
                        ...styles.sentenceSlotRow, 
                        borderColor: activeSentenceIndex === idx ? '#6C5CE7' : '#E2E8F0',
                        backgroundColor: activeSentenceIndex === idx ? '#F4F1FE' : '#FFF'
                      }}
                    >
                      <strong style={{ color: activeSentenceIndex === idx ? '#6C5CE7' : '#475569' }}>Ayat {idx + 1}:</strong>
                      <span style={styles.sentenceSlotPreview}>{sentence || "(Belum ditulis)"}</span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={insertAllSentencesToEssay}
                  disabled={savedSentences.every(s => s.trim() === "")}
                  style={styles.transferAllBtn}
                >
                  🚀 Masukkan Semua Ayat Ke Karangan Utama
                </button>
              </div>

              <div style={styles.modalGamePanel}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div>
                    <label style={styles.sectionLabel}>📸 Pilih Gambar:</label>
                    <select value={selectedPictureIndex} onChange={(e) => setSelectedPictureIndex(Number(e.target.value))} style={styles.customSelect}>
                      {Array.from({ length: totalPictures }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>Gambar {n}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={styles.sectionLabel}>👤 Masukkan Nama Watak:</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input value={watakName} onChange={(e) => setWatakName(e.target.value)} placeholder="Taip nama watak di sini..." style={styles.scaffoldInput} />
                      <button onClick={handleBuildSentence} disabled={isBuilding || !watakName.trim()} style={styles.scaffoldActionBtn}>
                        {isBuilding ? "Menjana..." : "Jana Kad Perkataan 🪄"}
                      </button>
                    </div>
                  </div>
                </div>

                {builderResult && (
                  <div style={{ marginTop: '10px' }}>
                    <span style={styles.sectionLabel}>🌟 Bank Kata Kunci (Tarik kad dari sini - kad tidak akan hilang):</span>
                    
                    <div 
                      onDragOver={(e) => e.preventDefault()} 
                      onDragEnter={(e) => e.preventDefault()}
                      style={styles.cardPoolContainer}
                    >
                      {shuffledBlocks.map((block) => (
                        <div
                          key={block.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, block.id, "pool")}
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
                    </div>

                    <span style={styles.sectionLabel}>📥 Kotak Binaan Ayat {activeSentenceIndex + 1} (Klik kad untuk padam):</span>
                    
                    <div 
                      onDragOver={(e) => e.preventDefault()} 
                      onDragEnter={(e) => e.preventDefault()}
                      onDrop={handleDropOnTrack} 
                      style={{ ...styles.dropTargetTrack, backgroundColor: isGameWon ? '#ECFDF5' : '#FFF', borderColor: isGameWon ? '#10B981' : '#6C5CE7' }}
                    >
                      {placedBlocks.length === 0 && (
                        <div style={{ margin: 'auto', color: '#94A3B8', fontSize: '13px' }}>
                          Seret kad dari bank di atas ke sini untuk membina ayat anda
                        </div>
                      )}
                      
                      {placedBlocks.map((block, index) => (
                        <div
                          key={block.uniqueInstanceId}
                          onClick={() => handleRemoveFromTrack(index)}
                          style={{
                            ...styles.draggableWordCard,
                            cursor: 'pointer',
                            backgroundColor: block.jenis === 'kata-kerja' ? '#FEE2E2' : block.jenis === 'kata-nama' ? '#DBEAFE' : '#FEF3C7',
                            borderColor: block.jenis === 'kata-kerja' ? '#FCA5A5' : block.jenis === 'kata-nama' ? '#93C5FD' : '#FDE68A',
                            color: block.jenis === 'kata-kerja' ? '#991B1B' : block.jenis === 'kata-nama' ? '#1E40AF' : '#92400E'
                          }}
                        >
                          <span style={styles.cardMetaLabel}>{block.label}</span>
                          <strong>{block.teks}</strong>
                          <span style={{ fontSize: '9px', color: '#EF4444', marginTop: '2px' }}>❌ Buang</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px', justifyContent: 'flex-end' }}>
                      <button onClick={() => setPlacedBlocks([])} style={{ ...styles.scaffoldActionBtn, backgroundColor: '#64748B' }}>
                        🗑️ Kosongkan
                      </button>
                      <button onClick={verifySentenceStructure} style={{ ...styles.scaffoldActionBtn, backgroundColor: '#6C5CE7' }}>
                        🔍 Semak Struktur Ayat
                      </button>
                    </div>

                    {isGameWon && (
                      <div style={styles.victoryContainer}>
                        <div style={{ fontWeight: 'bold', color: '#065F46', marginBottom: '10px' }}>
                          🎉 Hebat! Susunan ayat yang dibina adalah tepat & gramatis!
                        </div>
                        <button onClick={saveCurrentSentenceSlot} style={styles.insertSentenceToEssayBtn}>
                          💾 Simpan Sebagai Ayat {activeSentenceIndex + 1}
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
    </div>
  );
}

const styles = {
  container: { backgroundColor: '#F0F3F7', minHeight: '100vh', padding: '20px' },
  topNav: { display: 'flex', alignItems: 'center', marginBottom: '20px' },
  backBtn: { padding: '8px 15px', borderRadius: '10px', border: 'none', cursor: 'pointer', marginRight: '20px', fontWeight: 'bold', background: '#fff' },
  title: { fontSize: '24px', margin: 0, color: '#2D3436' },
  mainLayout: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', maxWidth: '1200px', margin: '0 auto' },
  sidebar: { display: 'flex', flexDirection: 'column' },
  briefCard: { backgroundColor: '#fff', padding: '20px', borderRadius: '15px' },
  stimulusImg: { width: '100%', borderRadius: '10px', marginBottom: '10px' },
  taskText: { fontSize: '15px', lineHeight: '1.5' },
  editorArea: { backgroundColor: '#fff', padding: '20px', borderRadius: '15px' },
  textarea: { width: '100%', height: '400px', borderRadius: '10px', padding: '15px', fontSize: '17px', border: '2px solid #EEE', resize: 'none', outline: 'none' },
  submitBtn: { width: '100%', padding: '15px', borderRadius: '10px', border: 'none', backgroundColor: '#6C5CE7', color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
  openBuilderBtn: { width: '100%', padding: '14px', marginBottom: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#10B981', color: 'white', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 5000, backdropFilter: 'blur(4px)' },
  modalContent: { backgroundColor: '#FFF', borderRadius: '20px', overflow: 'hidden' },
  modalHeader: { padding: '16px 20px', background: '#6C5CE7', color: '#FFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalCloseX: { background: 'transparent', border: 'none', color: '#FFF', fontSize: '18px', cursor: 'pointer' },
  modalBodyLayout: { display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '20px', padding: '20px', maxHeight: '85vh', overflowY: 'auto' },
  modalImagePanel: { borderRight: '1px solid #E2E8F0', paddingRight: '20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  modalInlineImg: { width: '100%', borderRadius: '8px', maxHeight: '240px', objectFit: 'contain', border: '1px solid #CBD5E1' },
  noImagePlaceholder: { padding: '20px', background: '#F8FAFC', color: '#94A3B8', borderRadius: '8px', textAlign: 'center' },
  modalGamePanel: { display: 'flex', flexDirection: 'column', gap: '15px' },
  sentenceSlotRow: { padding: '10px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px' },
  sentenceSlotPreview: { fontSize: '13px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  transferAllBtn: { width: '100%', padding: '12px', marginTop: '15px', background: '#10B981', color: '#FFF', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' },
  customSelect: { padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFF', width: '130px' },
  sectionLabel: { fontSize: '13px', fontWeight: 'bold', color: '#334155', display: 'block' },
  scaffoldInput: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1' },
  scaffoldActionBtn: { padding: '10px 16px', background: '#6C5CE7', color: '#FFF', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  cardPoolContainer: { background: '#F1F5F9', padding: '14px', borderRadius: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap', minHeight: '75px', border: '2px dashed #CBD5E1' },
  dropTargetTrack: { padding: '18px', borderRadius: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', minHeight: '90px', alignItems: 'center', borderWidth: '2px', borderStyle: 'solid' },
  draggableWordCard: { padding: '8px 12px', borderRadius: '10px', borderWidth: '2px', borderStyle: 'solid', cursor: 'grab', userSelect: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#FFF' },
  cardMetaLabel: { fontSize: '10px', opacity: 0.8, marginBottom: '2px' },
  victoryContainer: { marginTop: '15px', textAlign: 'center', padding: '15px', background: '#D1FAE5', borderRadius: '12px', border: '1px solid #A7F3D0' },
  insertSentenceToEssayBtn: { padding: '10px 20px', background: '#059669', color: '#FFF', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }
};