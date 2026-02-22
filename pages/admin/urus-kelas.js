import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '@/lib/firebase';
import { 
  doc, getDoc, updateDoc, collection, 
  query, where, getDocs, addDoc, deleteDoc 
} from 'firebase/firestore'; 
import Head from 'next/head';

// Import the Shared Layout
import AdminLayout from '@/components/AdminLayout';

export default function UrusKelasPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [newClassLevel, setNewClassLevel] = useState(''); 
  const [isCreatingClass, setIsCreatingClass] = useState(false);

  // --- DATA FETCHING ---
  const refreshData = async (uid) => {
    try {
      // Fetch User Profile for Layout
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        setUser({ uid, ...userDoc.data() });
      }

      const classQ = query(collection(db, 'classes'), where('teacherId', '==', uid));
      const classSnap = await getDocs(classQ);
      setClasses(classSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const assignQ = query(collection(db, 'assignments'), where('teacherId', '==', uid));
      const assignSnap = await getDocs(assignQ);
      setAssignments(assignSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) { console.error("Error refreshing data:", err); }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((userObj) => {
      if (userObj) {
        refreshData(userObj.uid);
      } else {
        router.replace('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // --- CLASS ACTIONS ---
  const handleCreateClass = async () => {
    if (!newClassName.trim() || !newClassLevel) { alert("Sila masukkan Nama Kelas dan pilih Tahap."); return; }
    setIsCreatingClass(true);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await addDoc(collection(db, 'classes'), {
      className: newClassName, 
      level: newClassLevel, 
      teacherId: auth.currentUser.uid, 
      classCode: code, 
      createdAt: new Date()
    });
    setNewClassName(''); setNewClassLevel('');
    refreshData(auth.currentUser.uid); 
    setIsCreatingClass(false);
  };

  const handleDeleteClass = async (classId) => {
    if (confirm("Adakah anda pasti mahu memadam kelas ini? Semua tugasan di bawah kelas ini juga akan hilang.")) {
      await deleteDoc(doc(db, 'classes', classId));
      refreshData(auth.currentUser.uid);
    }
  };

  // --- ASSIGNMENT ACTIONS ---
  const handleCreateAssignment = async (classId, title, instructions, imageUrl) => {
    if (!classId || !title) { alert("Maklumat tidak lengkap!"); return; }
    try {
      await addDoc(collection(db, 'assignments'), {
        classId, 
        teacherId: auth.currentUser.uid, 
        title, 
        instructions: instructions || "",
        imageUrl: imageUrl || "", 
        createdAt: new Date().toISOString(), 
        status: 'active'
      });
      alert("Tugasan berjaya dihantar!");
      refreshData(auth.currentUser.uid);
    } catch (err) { alert("Gagal: " + err.message); }
  };

  const handleEditAssignment = async (e, task) => {
    e.stopPropagation();
    const newTitle = prompt("Kemaskini Tajuk:", task.title);
    if (!newTitle) return;
    try {
      await updateDoc(doc(db, 'assignments', task.id), { title: newTitle });
      refreshData(auth.currentUser.uid);
    } catch (err) { alert("Gagal mengemaskini."); }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (confirm("Adakah anda pasti mahu memadam tugasan ini?")) {
      try { 
        await deleteDoc(doc(db, 'assignments', assignmentId)); 
        refreshData(auth.currentUser.uid); 
      } catch (err) { console.error(err); }
    }
  };

  return (
    <AdminLayout activePage="urus-kelas" user={user}>
      <Head><title>Urus Kelas | Dashboard Admin</title></Head>

      <header className="page-header">
        <div>
          <h1>Pengurusan Kelas & Tugasan</h1>
          <p>Bina kelas, jana kod akses, dan agihkan tugasan kepada pelajar.</p>
        </div>
      </header>

      <div className="urus-container fade-in">
        {/* CREATE CLASS SECTION */}
        <section className="card dark-card">
          <h3>Bina Kelas Baru</h3>
          <div className="input-group-flex">
            <input 
              type="text" 
              placeholder="Contoh: 5 Amanah" 
              value={newClassName} 
              onChange={(e) => setNewClassName(e.target.value)} 
            />
            <select value={newClassLevel} onChange={(e) => setNewClassLevel(e.target.value)}>
              <option value="">Pilih Tahap</option>
              <option value="P3">Tahun 3 (P3)</option>
              <option value="P4">Tahun 4 (P4)</option>
              <option value="P5">Tahun 5 (P5)</option>
              <option value="P6">Tahun 6 (P6)</option>
            </select>
            <button className="btn-create" onClick={handleCreateClass} disabled={isCreatingClass}>
              {isCreatingClass ? 'Memproses...' : 'Bina Kelas'}
            </button>
          </div>
        </section>

        {/* CLASS GRID */}
        <div className="class-grid">
          {classes.map(c => (
            <div key={c.id} className="card class-card">
              <div className="class-info" onClick={() => router.push(`/Class/${c.id}`)}>
                <span className="badge">{c.level}</span>
                <h4>{c.className}</h4>
                <div className="code-box">
                  <small>KOD AKSES</small>
                  <code>{c.classCode}</code>
                </div>
              </div>

              <div className="assignment-section">
                <h6>Tugasan Aktif:</h6>
                <div className="task-list">
                  {assignments.filter(a => a.classId === c.id).map(task => (
                    <div key={task.id} className="task-item">
                      <span>{task.title}</span>
                      <div className="task-actions">
                        <button onClick={(e) => handleEditAssignment(e, task)}>✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteAssignment(task.id); }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button className="btn-add-task" onClick={async (e) => {
                    e.stopPropagation();
                    const title = prompt("Tajuk Tugasan:");
                    if (title) await handleCreateAssignment(c.id, title, prompt("Arahan:"), prompt("URL Gambar:"));
                }}>+ Tugasan Baru</button>
              </div>
              
              <button className="btn-delete-class" onClick={() => handleDeleteClass(c.id)}>Padam Kelas</button>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .page-header { margin-bottom: 2rem; }
        .page-header h1 { color: #003D40; margin: 0; }
        .page-header p { color: #64748b; margin-top: 5px; }

        .card { background: white; border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.02); border: 1px solid #e2e8f0; margin-bottom: 2rem; }
        .dark-card { background: #003D40; color: white; border: none; }
        .dark-card h3 { margin-top: 0; margin-bottom: 1rem; }

        .input-group-flex { display: flex; gap: 10px; }
        .input-group-flex input, .input-group-flex select { flex: 1; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; outline: none; }
        .btn-create { background: #48A6A7; color: white; border: none; padding: 0 25px; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .btn-create:hover { background: #3d8f90; }

        .class-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .class-card { display: flex; flex-direction: column; transition: 0.3s; }
        .class-card:hover { transform: translateY(-5px); box-shadow: 0 10px 15px rgba(0,0,0,0.05); }
        
        .class-info { cursor: pointer; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px; margin-bottom: 15px; }
        .badge { background: #e6f4f4; color: #48A6A7; font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 6px; }
        .class-info h4 { margin: 10px 0; font-size: 1.2rem; color: #003D40; }
        
        .code-box { background: #f8fafc; padding: 10px; border-radius: 8px; text-align: center; }
        .code-box small { display: block; color: #94a3b8; font-size: 9px; font-weight: 700; }
        .code-box code { font-size: 1.4rem; font-weight: 800; color: #48A6A7; }

        .assignment-section h6 { margin: 0 0 10px 0; color: #94a3b8; text-transform: uppercase; font-size: 10px; }
        .task-list { margin-bottom: 15px; }
        .task-item { display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid #f1f5f9; padding: 8px 12px; border-radius: 8px; margin-bottom: 6px; font-size: 13px; }
        .task-actions button { background: none; border: none; cursor: pointer; padding: 2px 5px; opacity: 0.6; }
        .task-actions button:hover { opacity: 1; }

        .btn-add-task { width: 100%; padding: 10px; background: none; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; font-size: 12px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .btn-add-task:hover { border-color: #48A6A7; color: #48A6A7; background: #f0fbfc; }
        
        .btn-delete-class { margin-top: auto; padding-top: 15px; background: none; border: none; color: #f87171; font-size: 11px; font-weight: 600; cursor: pointer; text-align: left; }
        .btn-delete-class:hover { text-decoration: underline; }

        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </AdminLayout>
  );
}