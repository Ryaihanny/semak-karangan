import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase'; 
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  deleteDoc 
} from 'firebase/firestore';

export default function UrusKelasPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [newClassLevel, setNewClassLevel] = useState(''); 
  const [isCreatingClass, setIsCreatingClass] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { 
        router.replace('/login'); 
        return; 
      }
      const userDocSnap = await getDoc(doc(db, 'users', currentUser.uid));
      setUser({ uid: currentUser.uid, ...userDocSnap?.data() });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const refreshData = async () => {
    if (!auth.currentUser) return;
    try {
      const classQ = query(collection(db, 'classes'), where('teacherId', '==', auth.currentUser.uid));
      const classSnap = await getDocs(classQ);
      setClasses(classSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const assignQ = query(collection(db, 'assignments'), where('teacherId', '==', auth.currentUser.uid));
      const assignSnap = await getDocs(assignQ);
      setAssignments(assignSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) { 
      console.error("Gagal memuatkan data:", err); 
    }
  };

  useEffect(() => { 
    if (user?.uid) refreshData(); 
  }, [user]);

  const handleCreateClass = async () => {
    if (!newClassName.trim() || !newClassLevel) { 
      alert("Sila masukkan Nama Kelas dan pilih Tahap."); 
      return; 
    }
    setIsCreatingClass(true);
    
    try {
      await addDoc(collection(db, 'classes'), {
        className: newClassName, 
        level: newClassLevel, 
        teacherId: user.uid, 
        createdAt: new Date()
      });
      setNewClassName(''); 
      setNewClassLevel('');
      refreshData();
    } catch (err) {
      alert("Gagal membina kelas: " + err.message);
    } finally {
      setIsCreatingClass(false);
    }
  };

  const handleDeleteClass = async (classId) => {
    if (confirm("Adakah anda pasti mahu memadam kelas ini? Semua data tugasan juga akan terkesan.")) {
      try {
        await deleteDoc(doc(db, 'classes', classId));
        setClasses(prev => prev.filter(c => c.id !== classId));
        alert("Kelas telah dipadamkan.");
      } catch (error) {
        console.error("Error deleting class:", error);
        alert("Gagal memadam kelas.");
      }
    }
  };

  const handleCreateAssignment = async (classId, title, instructions, imageUrl) => {
    if (!classId || !title) { 
      alert("Maklumat tidak lengkap!"); 
      return; 
    }
    try {
      await addDoc(collection(db, 'assignments'), {
        classId, 
        teacherId: user.uid, 
        title, 
        instructions: instructions || "",
        imageUrl: imageUrl || "", 
        createdAt: new Date().toISOString(), 
        status: 'active'
      });
      alert("Tugasan berjaya dihantar!");
      refreshData();
    } catch (err) { 
      alert("Gagal: " + err.message); 
    }
  };

  const handleEditAssignment = async (e, task) => {
    e.stopPropagation();
    const newTitle = prompt("Kemaskini Tajuk:", task.title);
    if (!newTitle) return;
    try {
      await updateDoc(doc(db, 'assignments', task.id), { title: newTitle });
      refreshData();
    } catch (err) { 
      alert("Gagal mengemaskini."); 
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (confirm("Adakah anda pasti mahu memadam tugasan ini?")) {
      try { 
        await deleteDoc(doc(db, 'assignments', assignmentId)); 
        refreshData(); 
      } catch (err) { 
        console.error(err); 
      }
    }
  };

  if (loading) return <div className="loader-box"><div className="spinner"></div></div>;

  return (
    <div className="dashboard-wrapper">
      <aside className="main-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">SI</div>
          <div className="logo-text"><h3>SI-PINTAR</h3><span>VERSI GURU</span></div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-header">UTAMA</div>
          <div className="nav-link" onClick={() => router.push('/dashboard')}>📊 Rekod Murid</div>
          <div className="nav-link" onClick={() => router.push('/trend')}>📈 Analisis Murid</div>
          <div className="nav-divider"></div>
          <div className="nav-header">PENGURUSAN</div>
          <div className="nav-link active">🏫 Urus Kelas</div>
          <div className="nav-link" onClick={() => router.push('/beli-kredit')}>💰 Beli Kredit</div>
          <div className="nav-link" onClick={() => router.push('/profile')}>👤 Profil Guru</div>
          <div className="nav-divider"></div>
          <div className="nav-action-zone">
            <div className="nav-link highlight" onClick={() => router.push('/semak')}>✍️ Mulakan Semakan</div>
          </div>
        </nav>
        <button className="btn-logout-sidebar" onClick={() => signOut(auth)}>Keluar Sistem</button>
      </aside>

      <main className="main-viewport">
        <header className="viewport-header">
          <h1>Urus Kelas Pelajar</h1>
          <div className="credit-badge">Baki Kredit: <b>{user?.credits || 0}</b></div>
        </header>

        <div className="fade-in">
          <div className="pro-card dark-mode-card">
            <h3>Bina Kelas Baru</h3>
            <div className="input-row-flex">
              <input 
                type="text" 
                placeholder="Nama Kelas" 
                value={newClassName} 
                onChange={(e) => setNewClassName(e.target.value)} 
              />
              <select 
                value={newClassLevel} 
                onChange={(e) => setNewClassLevel(e.target.value)} 
                style={{ borderRadius: '8px', padding: '0 10px', border: 'none', background: 'white' }}
              >
                <option value="">Pilih Tahap</option>
                <option value="P3">P3</option>
                <option value="P4">P4</option>
                <option value="P5">P5</option>
                <option value="P6">P6</option>
              </select>
              <button onClick={handleCreateClass} disabled={isCreatingClass}>
                {isCreatingClass ? 'Sedia...' : 'Bina Kelas'}
              </button>
            </div>
          </div>

          <div className="class-grid-layout">
            {classes.map(c => (
              <div key={c.id} className="pro-card class-card">
                <div className="class-card-header">
                  <div onClick={() => router.push(`/Class/${c.id}`)} style={{ cursor: 'pointer', flex: 1 }}>
                    <span className="class-label">KELAS {c.level || ''}</span>
                    <h4>{c.className}</h4>
                  </div>
                  <button className="btn-delete-class" onClick={(e) => { e.stopPropagation(); handleDeleteClass(c.id); }}>🗑️</button>
                </div>

                <div className="task-list-mini">
                  {assignments.filter(a => a.classId === c.id).map(task => (
                    <div key={task.id} className="task-item-row">
                      <span>{task.title}</span>
                      <div className="task-btns">
                        <button onClick={(e) => handleEditAssignment(e, task)}>✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteAssignment(task.id); }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button className="btn-add-task" onClick={async (e) => {
                    e.stopPropagation();
                    const title = prompt("Tajuk Tugasan:");
                    if (title) {
                      const instructions = prompt("Arahan:");
                      const img = prompt("URL Gambar (Jika ada):");
                      await handleCreateAssignment(c.id, title, instructions, img);
                    }
                }}>+ Tugasan Baru</button>
              </div>
            ))}
          </div>
        </div>
      </main>

      <style jsx>{`
        .dashboard-wrapper { display: flex; min-height: 100vh; background: #F2F6F6; font-family: 'Inter', sans-serif; color: #003D40; }
        .main-sidebar { width: 280px; background: #003D40; color: white; display: flex; flex-direction: column; padding: 2rem 1.5rem; position: sticky; top: 0; height: 100vh; }
        .sidebar-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 3rem; }
        .logo-icon { background: #FFD700; color: #003D40; font-weight: 900; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
        .logo-text h3 { margin: 0; font-size: 1.1rem; letter-spacing: 1px; }
        .logo-text span { font-size: 0.6rem; opacity: 0.5; font-weight: 700; }
        .sidebar-nav { flex: 1; }
        .nav-header { font-size: 0.65rem; font-weight: 800; color: rgba(255,255,255,0.4); letter-spacing: 1.5px; margin: 1.5rem 0 0.8rem 15px; }
        .nav-link { padding: 12px 15px; border-radius: 12px; cursor: pointer; margin-bottom: 4px; transition: 0.2s; color: rgba(255,255,255,0.7); font-size: 0.9rem; }
        .nav-link:hover { background: rgba(255,255,255,0.05); color: white; }
        .nav-link.active { background: #48A6A7; color: white; font-weight: 600; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .nav-link.highlight { background: #FFD700; color: #003D40; font-weight: 700; margin-top: 10px; }
        .nav-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 1.5rem 10px; }
        .btn-logout-sidebar { margin-top: auto; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 10px; cursor: pointer; }
        .main-viewport { flex: 1; padding: 2.5rem 3.5rem; overflow-y: auto; }
        .viewport-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .viewport-header h1 { margin: 0; font-size: 1.8rem; color: #003D40; }
        .credit-badge { background: white; padding: 8px 16px; border-radius: 50px; border: 1px solid #E0E7E7; font-size: 0.85rem; }
        .pro-card { background: white; border-radius: 20px; border: 1px solid #E0E7E7; box-shadow: 0 4px 20px rgba(0,61,64,0.04); padding: 1.5rem; margin-bottom: 1.5rem; }
        .dark-mode-card { background: #003D40; color: white; }
        .input-row-flex { display: flex; gap: 10px; margin-top: 1rem; }
        .input-row-flex input { flex: 1; padding: 12px; border-radius: 8px; border: none; }
        .input-row-flex button { background: #48A6A7; color: white; border: none; padding: 0 20px; border-radius: 8px; font-weight: bold; cursor: pointer; }
        .class-grid-layout { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
        .class-card h4 { margin: 0; }
        .class-label { font-size: 0.65rem; font-weight: 800; color: #48A6A7; }
        .btn-add-task { width: 100%; margin-top: 15px; padding: 8px; background: transparent; border: 1px dashed #48A6A7; color: #48A6A7; border-radius: 8px; font-weight: 600; font-size: 0.8rem; cursor: pointer; }
        .task-list-mini { margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px; }
        .task-item-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; font-size: 0.85rem; }
        .task-btns button { background: none; border: none; cursor: pointer; margin-left: 5px; }
        .class-card-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .btn-delete-class { background: none; border: none; cursor: pointer; opacity: 0.3; transition: 0.2s; }
        .btn-delete-class:hover { opacity: 1; }
        .fade-in { animation: fadeIn 0.5s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}