import { useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'; // Added sendPasswordResetEmail
import Link from 'next/link';

export default function Login() {
  const router = useRouter();
  const [loginType, setLoginType] = useState('username');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // New function for password reset
  const handleForgotPassword = async () => {
    if (!identifier || !identifier.includes('@')) {
      alert("Sila masukkan emel guru yang sah untuk set semula kata laluan.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, identifier.trim().toLowerCase());
      alert("Pautan set semula kata laluan telah dihantar ke emel anda! Sila semak folder Inbox atau Spam.");
    } catch (err) {
      alert("Ralat: Emel tidak dijumpai atau masalah rangkaian.");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanId = identifier.trim().toLowerCase();
      if (loginType === 'username') {
        const studentDocRef = doc(db, 'students', cleanId);
        const studentSnap = await getDoc(studentDocRef);

        if (studentSnap.exists() && studentSnap.data().password === password) {
          localStorage.setItem("studentUser", JSON.stringify({
            id: studentSnap.id,
            ...studentSnap.data()
          }));
          router.push('/student-dashboard');
          return;
        } else {
          alert("ID atau Kata Laluan salah! ❌ Sila cuba lagi.");
        }
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, cleanId, password);
        const userDocRef = doc(db, 'users', userCredential.user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const role = userDocSnap.data().role?.toLowerCase();
          if (role === 'admin') router.push('/admin/dashboard');
          else router.push('/dashboard');
        }
      }
    } catch (err) {
      alert("Oops! Maklumat tidak tepat atau ada masalah teknikal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>🚀 Si-Pintar</h1>
        <p>Log masuk untuk mulakan misi penulisan anda!</p>
        
        <div className="toggle-slider">
          <button type="button" className={loginType === 'username' ? 'active' : ''} onClick={() => setLoginType('username')}>ID Murid</button>
          <button type="button" className={loginType === 'email' ? 'active' : ''} onClick={() => setLoginType('email')}>Emel Guru</button>
        </div>

        <form onSubmit={handleLogin}>
          <div className="input-field">
            <label>{loginType === 'username' ? 'ID Murid' : 'Emel Guru'}</label>
            <input type={loginType === 'username' ? "text" : "email"} placeholder={loginType === 'username' ? "Masukkan ID anda" : "guru@sekolah.edu"} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </div>
          <div className="input-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Kata Laluan</label>
              {loginType === 'email' && (
                <span onClick={handleForgotPassword} className="forgot-link">Lupa?</span>
              )}
            </div>
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>{loading ? "Membuka Portal..." : "Mula Belajar!"}</button>
        </form>

        <div className="login-footer">
          Cikgu belum ada akaun? <Link href="/signup">Daftar di sini</Link>
        </div>
      </div>

      <style jsx>{`
        .login-page { min-height: 100vh; background: #6C63FF; display: flex; align-items: center; justify-content: center; font-family: 'Plus Jakarta Sans', sans-serif; }
        .login-card { background: white; padding: 50px; border-radius: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.2); width: 100%; max-width: 400px; text-align: center; }
        h1 { font-size: 2.5rem; color: #6C63FF; margin-bottom: 10px; font-weight: 800; }
        p { color: #636E72; margin-bottom: 30px; }
        .toggle-slider { display: flex; background: #F0F0FF; padding: 5px; border-radius: 15px; margin-bottom: 25px; }
        .toggle-slider button { flex: 1; border: none; background: none; padding: 10px; border-radius: 10px; cursor: pointer; font-weight: 700; transition: 0.3s; color: #636E72; }
        .toggle-slider button.active { background: white; color: #6C63FF; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .input-field { text-align: left; margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: 700; color: #2D3436; }
        .forgot-link { font-size: 0.8rem; color: #6C63FF; font-weight: 700; cursor: pointer; text-decoration: underline; }
        input { width: 100%; padding: 15px; border-radius: 15px; border: 2px solid #F0F0F0; font-size: 1rem; outline: none; transition: 0.3s; box-sizing: border-box; }
        input:focus { border-color: #6C63FF; }
        .login-btn { width: 100%; background: #6C63FF; color: white; border: none; padding: 18px; border-radius: 20px; font-size: 1.1rem; font-weight: 800; cursor: pointer; margin-top: 10px; transition: 0.3s; }
        .login-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(108, 99, 255, 0.3); }
        .login-footer { margin-top: 25px; font-size: 0.9rem; color: #636E72; }
        .login-footer :global(a) { color: #6C63FF; font-weight: 700; text-decoration: none; }
      `}</style>
    </div>
  );
}