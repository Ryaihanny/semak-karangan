import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function TugasanMenulis() {
  const router = useRouter();
  const { id } = router.query; // Ini adalah Assignment ID
  const [assignment, setAssignment] = useState(null);
  const [karangan, setKarangan] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [aiFeedback, setAiFeedback] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && id) {
        fetchAssignment();
      } else if (!user) {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [id]);

  const fetchAssignment = async () => {
    const docRef = doc(db, 'assignments', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      setAssignment(snap.data());
    }
    setLoading(false);
  };

  // FUNGSI 1: Semak AI (Sebelum Hantar)
  const handleAISemak = async () => {
    if (karangan.length < 50) return alert("Karangan terlalu pendek untuk disemak.");
    alert("AI sedang menyemak tatabahasa anda... (Sila integrasikan API AI anda di sini)");
    // Contoh maklum balas dummy
    setAiFeedback("Saranan AI: Perbaiki ejaan 'merekod' dan tambahkan penanda wacana.");
  };

  // FUNGSI 2: Hantar Tugasan ke Guru
  const handleSubmitTugasan = async () => {
    if (!karangan.trim()) return alert("Sila tulis karangan sebelum hantar.");
    
    setSubmitting(true);
    try {
      // Simpan dalam koleksi 'submissions'
      // ID Dokumen: gabungan AssignmentID + UserID (supaya unik bagi setiap pelajar per tugasan)
      const submissionId = `${id}_${auth.currentUser.uid}`;
      await setDoc(doc(db, 'submissions', submissionId), {
        assignmentId: id,
        classId: assignment.classId,
        studentId: auth.currentUser.uid,
        studentName: auth.currentUser.displayName || "Pelajar",
        content: karangan,
        status: "submitted", // Status: submitted, graded, needs_correction
        submittedAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });

      alert("Tahniah! Karangan anda telah dihantar kepada guru.");
      router.push('/semakan'); // Balik ke dashboard pelajar
    } catch (error) {
      console.error(error);
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
        {/* Bahagian Arahan Guru */}
        <div className="instruction-card">
          <h4>Arahan Guru:</h4>
          <p>{assignment?.instructions || "Tuliskan sebuah karangan berdasarkan tajuk yang diberikan."}</p>
        </div>

        {/* Kotak Menulis */}
        <textarea
          className="text-editor"
          placeholder="Mulakan penulisan anda di sini..."
          value={karangan}
          onChange={(e) => setKarangan(e.target.value)}
        />

        {/* Feedback AI Visual */}
        {aiFeedback && (
          <div className="ai-feedback">
            <p>🤖 <strong>Maklum Balas AI:</strong> {aiFeedback}</p>
          </div>
        )}

        {/* Panel Butang */}
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

        .ai-feedback { background: #e0f2f1; padding: 15px; border-radius: 10px; margin: 15px 0; border-left: 5px solid #006A71; }

        .action-panel { display: flex; gap: 15px; margin-top: 20px; }
        .btn-ai { background: #006A71; color: white; border: none; padding: 12px 25px; border-radius: 12px; cursor: pointer; flex: 1; font-weight: bold; }
        .btn-submit { background: #48A6A7; color: white; border: none; padding: 12px 25px; border-radius: 12px; cursor: pointer; flex: 1; font-weight: bold; }
        
        .loading { text-align: center; margin-top: 50px; color: #006A71; }
      `}</style>
    </div>
  );
}