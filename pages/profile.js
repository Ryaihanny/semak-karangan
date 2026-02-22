import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
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
          }
          setLoading(false);
        }).catch(() => setLoading(false));
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

  if (loading) return <div className="loader-box">Memuatkan Profil...</div>;

  return (
    <div className="standalone-container">
      <header className="topbar">
        <div className="header-title">
          <h1>Tetapan Profil</h1>
          <p>Uruskan maklumat akaun anda.</p>
        </div>
        <button className="btn-back" onClick={() => router.back()}>Kembali</button>
      </header>

      <section className="profile-container">
        <div className="profile-card">
          <div className="card-header">
            <div className="avatar-large">
              {nama ? nama.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
            </div>
            <h3>{nama || 'Pengguna'}</h3>
            <p>{user?.email}</p>
          </div>

          <form className="profile-form" onSubmit={(e) => e.preventDefault()}>
            <div className="input-group">
              <label>Nama Penuh</label>
              <input type="text" value={nama} onChange={(e) => setNama(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Sekolah</label>
              <input type="text" value={sekolah} onChange={(e) => setSekolah(e.target.value)} />
            </div>
            <button className="btn-save" onClick={saveUserData} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
            {message && <p className="status-message">{message}</p>}
          </form>
        </div>
      </section>

      <style jsx>{`
        .standalone-container { padding: 40px; max-width: 800px; margin: 0 auto; font-family: sans-serif; }
        .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .btn-back { padding: 8px 16px; background: #eee; border: none; border-radius: 8px; cursor: pointer; }
        .profile-card { background: white; border-radius: 20px; padding: 2rem; border: 1px solid #E2E8F0; }
        .avatar-large { width: 60px; height: 60px; background: #48A6A7; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 1rem; }
        .input-group { margin-bottom: 1.5rem; }
        .input-group label { display: block; margin-bottom: 5px; font-weight: bold; }
        .input-group input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 8px; }
        .btn-save { width: 100%; padding: 12px; background: #003D40; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; }
        .status-message { margin-top: 10px; color: #48A6A7; text-align: center; }
        .loader-box { height: 100vh; display: grid; place-items: center; }
      `}</style>
    </div>
  );
}