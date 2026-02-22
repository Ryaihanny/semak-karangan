import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function BeliKredit() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const packages = [
    { id: 'basic', name: 'Pek Permulaan', credits: 10, price: 'RM 10', desc: 'Sesuai untuk ujian kecil.' },
    { id: 'pro', name: 'Pek Popular', credits: 50, price: 'RM 45', desc: 'Terbaik untuk kegunaan kelas.', hot: true },
    { id: 'premium', name: 'Pek Institusi', credits: 150, price: 'RM 120', desc: 'Nilai terbaik untuk sekolah.' },
  ];

  if (loading) return <div className="loader-box"><div className="spinner"></div></div>;

  return (
    <div className="dashboard-wrapper">
      {/* --- SIDEBAR (MATCHES DASHBOARD) --- */}
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
          <div className="nav-link" onClick={() => router.push('/urus-kelas')}>🏫 Urus Kelas</div>
          <div className="nav-link active">💰 Beli Kredit</div>
          <div className="nav-link" onClick={() => router.push('/profile')}>👤 Profil Guru</div>
          
          <div className="nav-divider"></div>

          <div className="nav-action-zone">
            <div className="nav-link highlight" onClick={() => router.push('/semak')}>✍️ Mulakan Semakan</div>
          </div>
        </nav>

        <button className="btn-logout-sidebar" onClick={() => signOut(auth)}>Keluar Sistem</button>
      </aside>

      {/* --- MAIN VIEWPORT --- */}
      <main className="main-viewport">
        <header className="viewport-header">
          <h1>Tambah Kredit</h1>
          <div className="credit-badge">Baki Semasa: <b>{user?.credits || 0}</b></div>
        </header>

        <div className="fade-in">
          <p style={{ marginBottom: '2rem', color: '#666' }}>Pilih pakej kredit untuk meneruskan semakan karangan automatik.</p>
          
          <div className="original-grid-system">
            {packages.map((pkg) => (
              <div key={pkg.id} className={`og-card ${pkg.hot ? 'og-selected' : ''}`}>
                <div className="og-header">
                  <span className="og-set">{pkg.hot ? 'PILIHAN UTAMA' : 'PAKEJ'}</span>
                </div>
                <h3>{pkg.name}</h3>
                <p className="og-meta">{pkg.desc}</p>
                
                <div className="og-score-box">
                  <div className="sc-item total">
                    <span>Kredit</span>
                    <b>{pkg.credits}</b>
                  </div>
                  <div className="sc-item total">
                    <span>Harga</span>
                    <b>{pkg.price}</b>
                  </div>
                </div>

                <button 
                  className="btn-og-print" 
                  onClick={() => window.open(`https://wa.me/60123456789?text=Saya%20ingin%20beli%20${pkg.name}`, '_blank')}
                >
                  Beli Sekarang
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      <style jsx>{`
        /* EXACT DASHBOARD CSS */
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
        .original-grid-system { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .og-card { background: white; border-radius: 20px; padding: 1.8rem; border: 1px solid #E0E7E7; }
        .og-selected { border-color: #48A6A7; box-shadow: 0 10px 30px rgba(0,61,64,0.05); }
        .og-header { display: flex; justify-content: space-between; margin-bottom: 1rem; }
        .og-set { font-size: 0.75rem; font-weight: 900; color: #99AFAF; }
        .og-card h3 { margin: 0 0 5px; color: #003D40; }
        .og-meta { font-size: 0.85rem; color: #889999; margin-bottom: 1.5rem; min-height: 40px; }
        .og-score-box { display: flex; justify-content: space-between; background: #F9FAFA; padding: 15px; border-radius: 12px; margin-bottom: 1.5rem; }
        .sc-item { display: flex; flex-direction: column; align-items: center; }
        .sc-item span { font-size: 0.6rem; color: #99AFAF; text-transform: uppercase; }
        .sc-item.total b { color: #48A6A7; font-size: 1.2rem; }
        .btn-og-print { width: 100%; padding: 12px; background: #003D40; color: white; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .btn-og-print:hover { background: #48A6A7; }
        .fade-in { animation: fadeIn 0.5s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .loader-box { height: 100vh; display: grid; place-items: center; background: #F2F6F6; }
        .spinner { width: 40px; height: 40px; border: 4px solid #E0E7E7; border-top: 4px solid #003D40; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}