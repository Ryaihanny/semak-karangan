import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function TugasanMenulis() {
  const router = useRouter();
  const { id } = router.query; // Assignment ID
  const [assignment, setAssignment] = useState(null);
  const [karangan, setKarangan] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [aiFeedback, setAiFeedback] = useState('');
  const [teacherFeedback, setTeacherFeedback] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && id) {
        fetchAssignmentAndDraft();
      } else if (!user) {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [id]);

  // Combined assignment and historical draft recovery on mount
  const fetchAssignmentAndDraft = async () => {
    try {
      // 1. Fetch assignment specifications
      const assignmentRef = doc(db, 'assignments', id);
      const assignmentSnap = await getDoc(assignmentRef);
      if (assignmentSnap.exists()) {
        setAssignment(assignmentSnap.data());
      }

      // 2. Safely recover previous writing draft if it exists
      const draftId = `${id}_${auth.currentUser.uid}`;
      const draftSnap = await getDoc(doc(db, 'drafts', draftId));
      if (draftSnap.exists()) {
        const draftData = draftSnap.data();
        if (draftData.karangan) {
          setKarangan(draftData.karangan);
        }
      }
    } catch (error) {
      console.error("Error loading initialization data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-save mechanism (Debounced to 2.5 seconds)
  useEffect(() => {
    if (!karangan.trim() || !id || !auth.currentUser || !assignment) return;

    const draftId = `${id}_${auth.currentUser.uid}`;

    const delayDebounceFn = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'drafts', draftId), {
          assignmentId: id,
          classId: assignment.classId,
          studentId: auth.currentUser.uid,
          studentName: auth.currentUser.displayName || "Pelajar",
          karangan: karangan, 
          status: "draft",
          lastUpdated: serverTimestamp()
        }, { merge: true }); // Merge ensures active teacher feedback fields are kept intact
        console.log("Draf auto-save berjaya.");
      } catch (error) {
        console.error("Gagal auto-save draf:", error);
      }
    }, 2500);

    return () => clearTimeout(delayDebounceFn);
  }, [karangan, id, assignment]);

  // Protected Real-Time listener for teacher updates
  useEffect(() => {
    if (!id || !auth.currentUser) return;

    const draftId = `${id}_${auth.currentUser.uid}`;
    
    const unsubscribe = onSnapshot(doc(db, 'drafts', draftId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        // Safe check preventing undefined property read errors
        setTeacherFeedback({
          kesalahanBahasa: data?.kesalahanBahasa || [],
          ulasanBahasa: data?.ulasanBahasa || "",
          ulasanIsi: data?.ulasanIsi || "",
        });
      }
    });

    return () => unsubscribe();
  }, [id]);

  const handleAISemak = async () => {
    if (karangan.length < 50) return alert("Karangan terlalu pendek untuk disemak.");
    alert("AI sedang menyemak tatabahasa anda... (Sila integrasikan API AI anda di sini)");
    setAiFeedback("Saranan AI: Perbaiki ejaan 'merekod' dan tambahkan penanda wacana.");
  };

  const handleSubmitTugasan = async () => {
    if (!karangan.trim()) return alert("Sila tulis karangan sebelum hantar.");
    
    setSubmitting(true);
    try {
      const submissionId = `${id}_${auth.currentUser.uid}`;
      
      // 1. Post to permanent submissions collection
      await setDoc(doc(db, 'submissions', submissionId), {
        assignmentId: id,
        classId: assignment.classId,
        studentId: auth.currentUser.uid,
        studentName: auth.currentUser.displayName || "Pelajar",
        content: karangan, 
        status: "submitted", 
        submittedAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });

      // 2. Clean up structural artifacts inside live drafts collection
      await deleteDoc(doc(db, 'drafts', submissionId));

      alert("Tahniah! Karangan anda telah dihantar kepada guru.");
      router.push('/semakan'); 
    } catch (error) {
      console.error("Submission Error:", error);
      alert("Gagal menghantar tugasan.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading">Menyediakan ruang menulis...</div>;

  return (
    <div className="writing-page">
      <header className="top-bar">
        <button onClick={() => router.back()} className="btn-back">← Kembali</button>
        <h2>{assignment?.title || "Tugasan Menulis"}</h2>
        <div className="user-info">Pelajar: {auth.currentUser?.displayName || "Siswa"}</div>
      </header>

      <main className="editor-container">
        <div className="instruction-card">
          <h4>Arahan Guru:</h4>
          <p>{assignment?.instructions || "Tuliskan sebuah karangan berdasarkan tajuk yang diberikan."}</p>
        </div>

        <textarea
          className="text-editor"
          placeholder="Mulakan penulisan anda di sini..."
          value={karangan}
          onChange={(e) => setKarangan(e.target.value)}
        />

        {/* Live Tracking Feedback UI Segment */}
        {teacherFeedback && (
          (teacherFeedback.ulasanBahasa || teacherFeedback.ulasanIsi || teacherFeedback.kesalahanBahasa.length > 0)
        ) && (
          <div className="teacher-live-feedback">
            <h5>💬 Nota Real-Time Guru:</h5>
            {teacherFeedback.ulasanBahasa && <p><strong>Ulasan Bahasa:</strong> {teacherFeedback.ulasanBahasa}</p>}
            {teacherFeedback.ulasanIsi && <p><strong>Ulasan Isi:</strong> {teacherFeedback.ulasanIsi}</p>}
            {teacherFeedback.kesalahanBahasa.length > 0 && (
              <div>
                <strong>Kesalahan Ditemui:</strong>
                <ul>
                  {teacherFeedback.kesalahanBahasa.map((err, idx) => (
                    <li key={idx}>❌ {err.ayatSalah} {err.pembetulan && `→ ${err.pembetulan}`}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {aiFeedback && (
          <div className="ai-feedback">
            <p>🤖 <strong>Maklum Balas AI:</strong> {aiFeedback}</p>
          </div>
        )}

        <div className="action-panel">
          <button onClick={handleAISemak} className="btn-ai">✨ Semak Tatabahasa (AI)</button>
          <button 
            onClick={handleSubmitTugasan} 
            className="btn-submit" 
            disabled={submitting}
          >
            {submitting ? "Menghantar..." : "Hantar Tugasan"}
          </button>
        </div>
      </main>

      <style jsx>{`
        .writing-page { background: #F2EFE7; min-height: 100vh; padding: 20px; font-family: 'Poppins', sans-serif; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .btn-back { background: none; border: 1px solid #006A71; color: #006A71; padding: 5px 15px; border-radius: 8px; cursor: pointer; }
        
        .editor-container { max-width: 900px; margin: 0 auto; }
        .instruction-card { background: #48A6A7; color: white; padding: 15px; border-radius: 12px; margin-bottom: 20px; }
        
        .text-editor { 
          width: 100%; 
          height: 400px; 
          padding: 20px; 
          border-radius: 15px; 
          border: 2px solid #ddd; 
          font-size: 1.1rem; 
          line-height: 1.6;
          resize: vertical;
          outline: none;
        }
        .text-editor:focus { border-color: #006A71; }

        .teacher-live-feedback { background: #fff; padding: 15px; border-radius: 10px; margin: 15px 0; border-left: 5px solid #48A6A7; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .teacher-live-feedback h5 { margin: 0 0 10px 0; color: #006A71; font-size: 1rem; }
        .teacher-live-feedback ul { margin: 5px 0 0 20px; padding: 0; }

        .ai-feedback { background: #e0f2f1; padding: 15px; border-radius: 10px; margin: 15px 0; border-left: 5px solid #006A71; }

        .action-panel { display: flex; gap: 15px; margin-top: 20px; }
        .btn-ai { background: #006A71; color: white; border: none; padding: 12px 25px; border-radius: 12px; cursor: pointer; flex: 1; font-weight: bold; }
        .btn-submit { background: #48A6A7; color: white; border: none; padding: 12px 25px; border-radius: 12px; cursor: pointer; flex: 1; font-weight: bold; }
        
        .loading { text-align: center; margin-top: 50px; color: #006A71; }
      `}</style>
    </div>
  );
}