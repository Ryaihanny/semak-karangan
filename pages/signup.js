import { useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import Head from 'next/head';
import Link from 'next/link';

export default function Signup() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    nama: '',
    email: '',
    password: '',
    sekolah: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log("Mula pendaftaran..."); // Debugging

      // 1. Create Account in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email.trim(), 
        formData.password
      );
      const user = userCredential.user;
      
      console.log("Auth Berjaya. UID:", user.uid); // Debugging

      // 2. Save to 'users' collection with 20 FREE CREDITS
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        nama: formData.nama,
        email: formData.email.trim().toLowerCase(),
        role: 'guru', 
        sekolah: formData.sekolah,
        credits: 20, // <--- 20 Free Credits Added Here
        createdAt: new Date().toISOString()
      });

      console.log("Firestore Berjaya disimpan!"); // Debugging

      // 3. Redirect to Teacher Dashboard
      router.push('/dashboard');

    } catch (err) {
      console.error("Ralat penuh:", err); // Look at F12 console for this!
      
      if (err.code === 'auth/email-already-in-use') {
        setError("Emel ini telah digunakan. Sila log masuk.");
      } else if (err.code === 'auth/operation-not-allowed') {
        setError("Sila aktifkan 'Email/Password' di Firebase Console Authentication.");
      } else {
        setError(`Ralat: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <Head><title>Daftar Guru | Si-Pintar</title></Head>
      <div className="signup-card">
        <h1>👨‍🏫 Daftar Guru</h1>
        <p>Sertai portal penulisan AI untuk mula mengurus kelas anda.</p>

        <form onSubmit={handleSignup}>
          <div className="input-group">
            <label>Nama Penuh</label>
            <input name="nama" type="text" placeholder="Cth: Cikgu Sarah" onChange={handleChange} required />
          </div>
          
          <div className="input-group">
            <label>Sekolah</label>
            <input name="sekolah" type="text" placeholder="Nama Sekolah" onChange={handleChange} required />
          </div>

          <div className="input-group">
            <label>Emel</label>
            <input name="email" type="email" placeholder="cikgu@email.com" onChange={handleChange} required />
          </div>

          <div className="input-group">
            <label>Kata Laluan</label>
            <input name="password" type="password" placeholder="Minima 6 aksara" onChange={handleChange} required />
          </div>

          <button type="submit" className="signup-btn" disabled={loading}>
            {loading ? "Mendaftarkan Akaun..." : "Daftar & Dapatkan 20 Kredit"}
          </button>
        </form>

        {error && <div className="error-pill">{error}</div>}

        <div className="footer">
          Sudah ada akaun? <Link href="/">Log Masuk</Link>
        </div>
      </div>

      <style jsx>{`
        .signup-page { min-height: 100vh; background: #6C63FF; display: flex; align-items: center; justify-content: center; padding: 20px; font-family: 'Plus Jakarta Sans', sans-serif; }
        .signup-card { background: white; padding: 40px; border-radius: 35px; width: 100%; max-width: 420px; box-shadow: 0 20px 50px rgba(0,0,0,0.1); }
        h1 { color: #6C63FF; margin-bottom: 5px; font-weight: 800; text-align: center; }
        p { color: #666; margin-bottom: 25px; font-size: 0.95rem; text-align: center; }
        
        .input-group { margin-bottom: 15px; }
        label { display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 5px; color: #2D3436; }
        input { width: 100%; padding: 12px; border-radius: 12px; border: 2px solid #F0F0FF; box-sizing: border-box; font-size: 1rem; outline: none; transition: 0.3s; }
        input:focus { border-color: #6C63FF; }
        
        .signup-btn { width: 100%; padding: 16px; background: #6C63FF; color: white; border: none; border-radius: 15px; font-weight: 800; cursor: pointer; transition: 0.3s; margin-top: 10px; font-size: 1rem; }
        .signup-btn:hover { background: #564ED9; transform: translateY(-2px); }
        .signup-btn:disabled { background: #A29BFE; cursor: not-allowed; }

        .error-pill { background: #FFE5E5; color: #D63031; padding: 12px; border-radius: 12px; margin-top: 20px; font-size: 0.85rem; text-align: center; font-weight: 600; }
        .footer { margin-top: 25px; text-align: center; font-size: 0.9rem; color: #636E72; }
        .footer :global(a) { color: #6C63FF; font-weight: 700; text-decoration: none; }
      `}</style>
    </div>
  );
}