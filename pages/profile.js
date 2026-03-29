import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut, sendPasswordResetEmail } from 'firebase/auth'; // Added reset import
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Profile State
  const [nama, setNama] = useState('');
  const [sekolah, setSekolah] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false); // New state for password reset

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace('/login');
        return;
      }
      const userDocSnap = await getDoc(doc(db, 'users', currentUser.uid));
      const data = userDocSnap.data();
      setUser({ uid: currentUser.uid, ...data });
      setNama(data?.nama || '');
      setSekolah(data?.sekolah || '');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        nama: nama,
        sekolah: sekolah
      });
      alert('Profil berjaya dikemaskini!');
    } catch (err) {
      console.error(err);
      alert('Ralat menyimpan maklumat.');
    }
    setSaving(false);
  };

  // New function to handle password reset from within profile
  const handlePasswordReset = async () => {
    if (!auth.currentUser?.email) return;
    
    const confirmReset = confirm("Pautan untuk menukar kata laluan akan dihantar ke emel anda. Teruskan?");
    if (!confirmReset) return;

    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email);
      alert('E-mel set semula kata laluan telah dihantar! Sila semak inbox anda.');
    } catch (err) {
      console.error(err);
      alert('Gagal menghantar e-mel. Sila cuba sebentar lagi.');
    }
    setResetting(false);
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
          <div className="nav-link" onClick={() => router.push('/urus-kelas')}>🏫 Urus Kelas</div>
          <div className="nav-link" onClick={() => router.push('/beli-kredit')}>💰 Beli Kredit</div>
          <div className="nav-link active">👤 Profil Guru</div>
          
          <div className="nav-divider"></div>

          <div className="nav-action-zone">
            <div className="nav-link highlight" onClick={() => router.push('/semak')}>✍️ Mulakan Semakan</div>
          </div>
        </nav>

        <button className="btn-logout-sidebar" onClick={() => signOut(auth)}>Keluar Sistem</button>
      </aside>

      <main className="main-viewport">
        <header className="viewport-header">
          <h1>Tetapan Profil</h1>
          <div className="credit-badge">Baki Kredit: <b>{user?.credits || 0}</b></div>
        </header>

        <div className="fade-in">
          <div className="pro-card" style={{ maxWidth: '600px' }}>
            <div className="profile-edit-form">
              <div className="t-group" style={{ marginBottom: '20px' }}>
                <label>Nama Penuh</label>
                <input 
                  type="text" 
                  value={nama} 
                  onChange={(e) => setNama(e.target.value)} 
                  placeholder="Nama anda"
                />
              </div>

              <div className="t-group" style={{ marginBottom: '20px' }}>
                <label>Sekolah / Institusi</label>
                <input 
                  type="text" 
                  value={sekolah} 
                  onChange={(e) => setSekolah(e.target.value)} 
                  placeholder="Nama sekolah"
                />
              </div>

              <div className="t-group" style={{ marginBottom: '30px' }}>
                <label>E-mel (Akaun)</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    value={auth.currentUser?.email} 
                    disabled 
                    style={{ background: '#f0f0f0', color: '#999', flex: 1 }}
                  />
                  <button 
                    type="button"
                    className="btn-reset-pw"
                    onClick={handlePasswordReset}
                    disabled={resetting}
                  >
                    {resetting ? '...' : 'Tukar Kata Laluan'}
                  </button>
                </div>
              </div>

              <button 
                className="btn-og-print" 
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        /* ... ALL YOUR ORIGINAL CSS ... */
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
        .pro-card { background: white; border-radius: 20px; border: 1px solid #E0E7E7; box-shadow: 0 4px 20px rgba(0,61,64,0.04); padding: 2rem; }
        .t-group { display: flex; flex-direction: column; gap: 6px; }
        .t-group label { font-size: 0.65rem; font-weight: 800; color: #99AFAF; text-transform: uppercase; }
        .t-group input { padding: 12px; border-radius: 10px; border: 1px solid #E0E7E7; background: #F9FAFA; font-size: 1rem; width: 100%; color: #003D40; }
        .btn-og-print { width: 100%; padding: 14px; background: #003D40; color: white; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .btn-og-print:hover { background: #48A6A7; }
        .btn-og-print:disabled { background: #ccc; }
        
        /* ADDED: Button for Password Reset */
        .btn-reset-pw { 
          padding: 10px 15px; 
          background: white; 
          border: 1px solid #48A6A7; 
          color: #48A6A7; 
          border-radius: 10px; 
          font-size: 0.75rem; 
          font-weight: 700; 
          cursor: pointer; 
          white-space: nowrap;
          transition: 0.2s;
        }
        .btn-reset-pw:hover { background: #48A6A7; color: white; }
        .btn-reset-pw:disabled { opacity: 0.5; cursor: not-allowed; }

        .fade-in { animation: fadeIn 0.5s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .loader-box { height: 100vh; display: grid; place-items: center; background: #F2F6F6; }
        .spinner { width: 40px; height: 40px; border: 4px solid #E0E7E7; border-top: 4px solid #003D40; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}