import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import Head from 'next/head';

export default function AdminLayout({ children, activePage }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { router.replace('/login'); return; }
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.data()?.role !== 'admin') { router.replace('/dashboard'); return; }
      setUser({ uid: currentUser.uid, ...userDoc.data() });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) return <div className="loader-box">Memuatkan Sistem...</div>;

// Add 'profile' to this array
const isGuruMode = ['semak', 'trend', 'urus-kelas', 'rekod_murid', 'profile'].includes(activePage);

  return (
    <div className="dashboard-wrapper">
      <Head><title>SI-PINTAR | {activePage?.toUpperCase()}</title></Head>

      <aside className="main-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">SI</div>
          <div className="logo-text"><h3>SI-PINTAR</h3><span>ADMIN PORTAL</span></div>
        </div>

        <div className="mode-toggle-container" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '5px', borderRadius: '12px', marginBottom: '1.5rem' }}>
           <Link href="/admin/dashboard" style={{flex:1}}>
              <button className={!isGuruMode ? 'active' : ''} style={{ width: '100%', border: 'none', background: !isGuruMode ? '#48A6A7' : 'transparent', color: 'white', padding: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', borderRadius: '8px' }}>🛡️ Admin View</button>
           </Link>
           <Link href="/admin/trend" style={{flex:1}}>
              <button className={isGuruMode ? 'active' : ''} style={{ width: '100%', border: 'none', background: isGuruMode ? '#48A6A7' : 'transparent', color: 'white', padding: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', borderRadius: '8px' }}>👨‍🏫 Guru View</button>
           </Link>
        </div>

        <nav className="sidebar-nav">
          {!isGuruMode ? (
            <>
              <div className="nav-header">SYSTEM CONTROL</div>
              <Link href="/admin/dashboard">
                <div className={`nav-link ${activePage === 'dashboard' ? 'active' : ''}`}>👥 Database Pengguna</div>
              </Link>
              <div className="nav-link">🏫 Semua Kelas</div>
              <div className="nav-link">📋 Tugasan Guru</div>
            </>
          ) : (
            <>
              <div className="nav-header">UTAMA</div>
              {/* Linked to dashboard which handles the 'rekod_murid' tab state */}
              <Link href="/admin/dashboard">
                <div className={`nav-link ${activePage === 'rekod_murid' ? 'active' : ''}`}>📊 Keputusan Murid</div>
              </Link>
              <Link href="/admin/trend">
                <div className={`nav-link ${activePage === 'trend' ? 'active' : ''}`}>📈 Analisis Murid</div>
              </Link>
              <Link href="/admin/semak">
                <div className={`nav-link ${activePage === 'semak' ? 'active' : ''}`}>✍️ Semak Karangan</div>
              </Link>
              
              <div className="nav-divider"></div>
              
              <div className="nav-header">PENGURUSAN</div>
              <Link href="/admin/urus-kelas">
                <div className={`nav-link ${activePage === 'urus-kelas' ? 'active' : ''}`}>🏫 Urus Kelas</div>
              </Link>
              <Link href="/profile">
                <div className="nav-link">👤 Profil Guru</div>
              </Link>
            </>
          )}
        </nav>

        <button className="btn-logout-sidebar" onClick={() => signOut(auth)}>Keluar Sistem</button>
      </aside>

      <main className="main-viewport">
        {children}
      </main>

      <style jsx>{`
        .dashboard-wrapper { display: flex; min-height: 100vh; background: #F2F6F6; color: #003D40; font-family: 'Inter', sans-serif; }
        .main-sidebar { width: 280px; background: #003D40; color: white; display: flex; flex-direction: column; padding: 2rem 1.5rem; position: sticky; top: 0; height: 100vh; }
        .sidebar-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 2rem; }
        .logo-icon { background: #FFD700; color: #003D40; font-weight: 900; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .logo-text h3 { margin: 0; font-size: 1.1rem; }
        .logo-text span { font-size: 0.6rem; opacity: 0.6; letter-spacing: 1px; }

        .nav-header { font-size: 0.65rem; font-weight: 800; color: rgba(255,255,255,0.4); letter-spacing: 1.5px; margin: 1.5rem 0 0.8rem 15px; }
        .nav-link { padding: 12px 15px; border-radius: 12px; cursor: pointer; margin-bottom: 4px; transition: 0.2s; color: rgba(255,255,255,0.7); font-size: 0.9rem; }
        .nav-link:hover { background: rgba(255,255,255,0.05); color: white; }
        .nav-link.active { background: #48A6A7 !important; color: white !important; font-weight: 600; }
        .nav-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 1.5rem 10px; }
        
        .btn-logout-sidebar { margin-top: auto; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 10px; cursor: pointer; font-weight: bold; }
        .btn-logout-sidebar:hover { background: #ff4d4d; border-color: #ff4d4d; }

        .main-viewport { flex: 1; padding: 2.5rem 3.5rem; overflow-y: auto; }
        .loader-box { height: 100vh; display: grid; place-items: center; font-weight: bold; color: #003D40; background: #F2F6F6; font-family: sans-serif; }
      `}</style>
    </div>
  );
}