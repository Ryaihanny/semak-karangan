import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/router';

export default function GuruProfile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // State untuk form
  const [formData, setFormData] = useState({
    displayName: '',
    school: '',
    phone: ''
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace('/login');
        return;
      }
      const userDocSnap = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDocSnap.data();
      setUser({ ...currentUser, ...userData });
      setFormData({
        displayName: userData?.displayName || '',
        school: userData?.school || '',
        phone: userData?.phone || ''
      });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), formData);
      alert('Profil berjaya dikemaskini!');
    } catch (error) {
      console.error(error);
      alert('Gagal mengemaskini profil.');
    }
    setSaving(false);
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div className="profile-page">
      <nav className="simple-nav">
        <button onClick={() => router.push('/')}>← Kembali ke Dashboard</button>
      </nav>

      <div className="profile-container">
        <header className="profile-header">
          <div className="avatar-big">
            {formData.displayName ? formData.displayName[0].toUpperCase() : user?.email[0].toUpperCase()}
          </div>
          <div className="profile-info">
            <h1>Profil Guru</h1>
            <p className="email-text">{user?.email}</p>
            <div className="badge-kredit">Baki Kredit: <span>{user?.credits || 0}</span></div>
          </div>
        </header>

        <div className="profile-grid">
          <div className="p-card">
            <h3>Maklumat Peribadi</h3>
            <div className="p-field">
              <label>Nama Penuh</label>
              <input 
                type="text" 
                value={formData.displayName} 
                onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                placeholder="Contoh: Cikgu Ahmad Razak"
              />
            </div>
            <div className="p-field">
              <label>Sekolah / Institusi</label>
              <input 
                type="text" 
                value={formData.school} 
                onChange={(e) => setFormData({...formData, school: e.target.value})}
                placeholder="Nama Sekolah"
              />
            </div>
            <div className="p-field">
              <label>No. Telefon</label>
              <input 
                type="text" 
                value={formData.phone} 
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="012-3456789"
              />
            </div>
            <button className="btn-save" onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>

          <div className="p-card stats-side">
            <h3>Status Akaun</h3>
            <div className="status-item">
              <p>Peranan</p>
              <span>Guru Panel</span>
            </div>
            <div className="status-item">
              <p>ID Pengguna</p>
              <span className="mono">{user?.uid.substring(0, 8)}...</span>
            </div>
            <hr />
            <button className="btn-topup" onClick={() => router.push('/beli-kredit')}>Tambah Kredit</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .profile-page { background: #F8F9FA; min-height: 100vh; padding: 2rem; font-family: 'Inter', sans-serif; }
        .simple-nav { max-width: 900px; margin: 0 auto 1.5rem; }
        .simple-nav button { background: none; border: none; color: #48A6A7; cursor: pointer; font-weight: 600; }
        
        .profile-container { max-width: 900px; margin: 0 auto; }
        
        .profile-header { 
          background: #003D40; color: white; padding: 40px; border-radius: 20px; 
          display: flex; align-items: center; gap: 30px; margin-bottom: 2rem;
          box-shadow: 0 10px 20px rgba(0,61,64,0.1);
        }
        
        .avatar-big { 
          width: 90px; height: 90px; background: #48A6A7; color: white; 
          border-radius: 50%; display: flex; align-items: center; justify-content: center; 
          font-size: 2.5rem; font-weight: 800; border: 4px solid rgba(255,255,255,0.2);
        }

        .email-text { opacity: 0.8; margin: 5px 0; }
        .badge-kredit { background: rgba(255,255,255,0.1); padding: 5px 15px; border-radius: 20px; font-size: 0.9rem; }
        .badge-kredit span { color: #FFD700; font-weight: bold; }

        .profile-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 2rem; }
        .p-card { background: white; padding: 30px; border-radius: 15px; border: 1px solid #EEE; }
        
        .p-field { margin-bottom: 1.2rem; }
        .p-field label { display: block; font-size: 0.7rem; font-weight: bold; color: #AAA; text-transform: uppercase; margin-bottom: 5px; }
        .p-field input { width: 100%; padding: 12px; border: 1px solid #EEE; border-radius: 10px; background: #F9F9F9; }
        
        .btn-save { width: 100%; background: #003D40; color: white; border: none; padding: 12px; border-radius: 10px; font-weight: 600; cursor: pointer; margin-top: 10px; transition: 0.2s; }
        .btn-save:hover { background: #00565a; }

        .status-item { display: flex; justify-content: space-between; margin-bottom: 15px; }
        .status-item p { font-size: 0.85rem; color: #666; margin: 0; }
        .status-item span { font-weight: 600; color: #003D40; }
        .mono { font-family: monospace; color: #888 !important; }
        
        .btn-topup { width: 100%; background: #FFD700; color: #003D40; border: none; padding: 10px; border-radius: 10px; font-weight: bold; cursor: pointer; margin-top: 10px; }
        
        .loading-screen { height: 100vh; display: flex; justify-content: center; align-items: center; }
        .spinner { width: 30px; height: 30px; border: 3px solid #EEE; border-top-color: #48A6A7; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}