import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import AdminLayout from '@/components/AdminLayout';

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null); // Auth User
  const [role, setRole] = useState('guru'); // Default role
  const [loading, setLoading] = useState(true);

  const [nama, setNama] = useState('');
  const [sekolah, setSekolah] = useState('');
  const [credits, setCredits] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userRef = doc(db, 'users', currentUser.uid);
        
        getDoc(userRef).then((snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setNama(d.nama || '');
            setSekolah(d.sekolah || '');
            setCredits(d.credits || 0);
            setRole(d.role || 'guru'); 
          }
          setLoading(false);
        }).catch((err) => {
          console.error(err);
          setLoading(false);
        });
      } else {
        router.replace('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const saveUserData = async () => {
    if (!user) return;
    setSaving(true);
    setMessage('');
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { nama, sekolah }, { merge: true });
      setMessage('✅ Maklumat berjaya dikemaskini.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ Ralat menyimpan maklumat.');
    }
    setSaving(false);
  };

  // Keep only this one loading check
  if (loading) return <div className="loader-box">Memuatkan Profil...</div>;

  return (
    <AdminLayout 
      activePage="profile" 
      role={role} 
      user={{ nama, credits }} 
    >
      <header className="topbar">
        <div className="header-title">
          <h1>Tetapan Profil</h1>
          <p>Uruskan maklumat peribadi dan akaun anda sebagai {role === 'admin' ? 'Pentadbir' : 'Guru'}.</p>
        </div>
        <div className="credit-pill">
          Baki Kredit: <span>{credits}</span>
        </div>
      </header>

      <section className="profile-container">
        <div className="profile-card">
          <div className="card-header">
            <div className="avatar-large">
              {nama ? nama.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
            </div>
            <h3>{nama || 'Pengguna Pintar'}</h3>
            <p>{user?.email}</p>
          </div>

          <form className="profile-form" onSubmit={(e) => e.preventDefault()}>
            <div className="input-group">
              <label>Nama Penuh</label>
              <input type="text" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Masukkan nama anda" />
            </div>

            <div className="input-group">
              <label>Nama Sekolah / Institusi</label>
              <input type="text" value={sekolah} onChange={(e) => setSekolah(e.target.value)} placeholder="Contoh: SK Taman Melati" />
            </div>

            <div className="input-group">
              <label>ID Akaun (Read Only)</label>
              <input type="text" value={user?.uid} disabled className="disabled-input" />
            </div>

            <button className="btn-save" onClick={saveUserData} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
            
            {message && <p className="status-message">{message}</p>}
          </form>
        </div>

        <div className="info-side">
          <div className="info-card">
            <h4>Akses {role === 'admin' ? 'Pentadbir' : 'Guru'}</h4>
            <p>Anda log masuk sebagai <b>{role.toUpperCase()}</b>. {role === 'admin' ? 'Anda mempunyai akses penuh untuk mengurus sistem.' : 'Gunakan menu untuk mula menyemak karangan.'}</p>
          </div>
          <div className="info-card teal">
            <h4>Baki Kredit</h4>
            <p>Kredit digunakan untuk proses semakan AI. Baki anda sekarang adalah {credits}.</p>
            <button className="btn-white" onClick={() => router.push('/beli-kredit')}>Tambah Kredit</button>
          </div>
        </div>
      </section>

      <style jsx>{`
        .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; }
        .header-title h1 { margin: 0; font-size: 1.8rem; color: #003D40; }
        .header-title p { color: #666; margin: 5px 0 0; }
        
        .credit-pill { background: white; padding: 10px 20px; border-radius: 50px; border: 1px solid #E2E8F0; font-size: 0.9rem; font-weight: 600; }
        .credit-pill span { color: #48A6A7; font-weight: 800; }

        .profile-container { display: grid; grid-template-columns: 1.5fr 1fr; gap: 2rem; }
        
        .profile-card { background: white; border-radius: 20px; padding: 2.5rem; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .card-header { text-align: center; margin-bottom: 2rem; }
        .avatar-large { width: 80px; height: 80px; background: #48A6A7; color: white; font-size: 2rem; font-weight: 800; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; }
        .card-header h3 { margin: 0; color: #003D40; font-size: 1.4rem; }
        .card-header p { color: #94A3B8; margin: 5px 0 0; font-size: 0.9rem; }

        .profile-form { display: flex; flex-direction: column; gap: 1.2rem; }
        .input-group label { display: block; font-size: 0.75rem; font-weight: 700; color: #64748B; text-transform: uppercase; margin-bottom: 6px; }
        .input-group input { width: 100%; padding: 12px 16px; border: 1px solid #E2E8F0; border-radius: 12px; background: #F8FAFC; font-size: 1rem; color: #333; transition: 0.2s; }
        .input-group input:focus { border-color: #48A6A7; outline: none; background: white; }
        .disabled-input { color: #94A3B8 !important; cursor: not-allowed; }

        .btn-save { background: #003D40; color: white; padding: 14px; border-radius: 12px; border: none; font-weight: 700; font-size: 1rem; cursor: pointer; transition: 0.2s; margin-top: 1rem; }
        .btn-save:hover { background: #002D30; transform: translateY(-1px); }
        .btn-save:disabled { background: #CBD5E1; transform: none; }

        .status-message { text-align: center; font-size: 0.9rem; font-weight: 600; color: #48A6A7; margin-top: 10px; }

        .info-side { display: flex; flex-direction: column; gap: 1.5rem; }
        .info-card { background: white; padding: 1.8rem; border-radius: 20px; border: 1px solid #E2E8F0; }
        .info-card h4 { margin-top: 0; color: #003D40; font-size: 1.1rem; }
        .info-card p { font-size: 0.9rem; color: #64748B; line-height: 1.6; }
        .info-card.teal { background: #003D40; color: white; border: none; }
        .info-card.teal h4, .info-card.teal p { color: white; }
        
        .btn-white { width: 100%; padding: 10px; border: none; background: #FFD700; color: #003D40; border-radius: 10px; cursor: pointer; font-weight: 700; margin-top: 1rem; }

        .loader-box { height: 100vh; display: grid; place-items: center; font-weight: bold; color: #003D40; background: #F2F6F6; }
      `}</style>
    </AdminLayout>
  );
}