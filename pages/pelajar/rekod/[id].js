import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function RekodKarangan() {
  const router = useRouter();
  const { id } = router.query; // ID Submission
  const [submission, setSubmission] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && id) {
        fetchData();
      } else if (!user) {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [id]);

  const fetchData = async () => {
    try {
      const subRef = doc(db, 'submissions', id);
      const subSnap = await getDoc(subRef);
      
      if (subSnap.exists()) {
        const subData = subSnap.data();
        setSubmission(subData);

        const assignRef = doc(db, 'assignments', subData.assignmentId);
        const assignSnap = await getDoc(assignRef);
        if (assignSnap.exists()) {
          setAssignment(assignSnap.data());
        }
      }
    } catch (err) {
      console.error("Gagal mengambil data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    window.print(); 
  };

  if (loading) return <div className="loading">Memuatkan rekod...</div>;
  if (!submission) return <div className="error">Rekod tidak dijumpai.</div>;

  return (
    <div className="record-page">
      {/* Bahagian Navbar - Diselaraskan dengan Butang Pembetulan */}
      <nav className="no-print nav-bar">
        <button onClick={() => router.back()} className="btn-secondary">← Kembali</button>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Butang Pembetulan: Hanya muncul jika status 'needs_correction' */}
          {submission.status === 'needs_correction' && (
            <button 
              onClick={() => router.push(`/pelajar/tugasan/${submission.assignmentId}`)} 
              className="btn-warning"
            >
              ✍️ Buat Pembetulan
            </button>
          )}
          <button onClick={handleDownloadPDF} className="btn-primary">🖨️ Simpan sebagai PDF</button>
        </div>
      </nav>

      {/* Kertas Karangan */}
      <div className="printable-content" id="karangan-content">
        <div className="header-pdf">
          <h1>LAPORAN HASIL KERJA PELAJAR</h1>
          <p className="system-tag">Dijana oleh Pintar AI</p>
        </div>

        <div className="info-section">
          <div className="info-col">
            <p><strong>Nama Pelajar:</strong> {submission.studentName}</p>
            <p><strong>ID Pelajar:</strong> {submission.studentId.substring(0, 8)}</p>
            <p><strong>Tarikh:</strong> {submission.submittedAt?.toDate().toLocaleDateString('ms-MY')}</p>
          </div>
          <div className="info-col text-right">
            <p><strong>Tajuk:</strong> {assignment?.title || "Karangan Bebas"}</p>
            <p><strong>Markah:</strong> <span className="score-badge">{submission.score || 'Belum Dinilai'} / 100</span></p>
          </div>
        </div>

        <hr />

        <div className="content-body">
          <h3>Isi Karangan:</h3>
          <div className="text-box">
            {submission.content.split('\n').map((para, index) => (
              <p key={index}>{para}</p>
            ))}
          </div>
        </div>

        {submission.feedback && (
          <div className="feedback-section">
            <h3>💬 Komen Guru:</h3>
            <p>{submission.feedback}</p>
          </div>
        )}

        <div className="footer-pdf">
          <p>© {new Date().getFullYear()} Pintar - Sistem Semakan Karangan AI</p>
        </div>
      </div>

      <style jsx>{`
        .record-page { background: #F2EFE7; min-height: 100vh; padding: 40px 20px; font-family: 'Poppins', sans-serif; }
        .nav-bar { max-width: 800px; margin: 0 auto 20px; display: flex; justify-content: space-between; align-items: center; }
        
        .printable-content { 
          background: white; 
          max-width: 800px; 
          margin: 0 auto; 
          padding: 50px; 
          border-radius: 10px; 
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          color: #333;
        }

        .header-pdf { text-align: center; margin-bottom: 30px; }
        .header-pdf h1 { color: #006A71; margin-bottom: 5px; font-size: 24px; }
        .system-tag { font-size: 12px; color: #48A6A7; letter-spacing: 2px; text-transform: uppercase; }

        .info-section { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; }
        .text-right { text-align: right; }
        .score-badge { font-size: 18px; font-weight: bold; color: #006A71; }

        .content-body h3, .feedback-section h3 { font-size: 16px; color: #006A71; border-bottom: 2px solid #F2EFE7; padding-bottom: 5px; }
        .text-box { line-height: 1.8; text-align: justify; white-space: pre-wrap; margin-top: 15px; }
        
        .feedback-section { margin-top: 30px; padding: 15px; background: #f9f9f9; border-left: 4px solid #48A6A7; font-style: italic; }

        .footer-pdf { margin-top: 50px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }

        .btn-primary { background: #006A71; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .btn-primary:hover { background: #004d52; }
        
        .btn-secondary { background: white; border: 1px solid #ccc; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
        
        .btn-warning { background: #FF8C00; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .btn-warning:hover { background: #e67e00; }

        @media print {
          .no-print { display: none !important; }
          .record-page { padding: 0; background: white; }
          .printable-content { box-shadow: none; border: none; width: 100%; max-width: 100%; padding: 0; }
          body { background: white; }
        }

        .loading, .error { text-align: center; margin-top: 100px; color: #006A71; }
      `}</style>
    </div>
  );
}