import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth'; // Added sendPasswordResetEmail
import { auth, db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [loginType, setLoginType] = useState('username'); // 'username' or 'email'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

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
      setError("Ralat: Emel tidak dijumpai atau masalah rangkaian.");
    }
  };

  // Robust Redirection Logic
  const redirectUser = useCallback(async (firebaseUser) => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const role = userDocSnap.data().role?.toLowerCase();
        if (role === 'admin') router.push('/admin/dashboard');
        else router.push('/dashboard');
        return;
      }

      const q = query(collection(db, 'students'), where('email', '==', firebaseUser.email), limit(1));
      const studentSnap = await getDocs(q);
      
      if (!studentSnap.empty) {
        localStorage.setItem("studentUser", JSON.stringify({
          id: studentSnap.docs[0].id,
          ...studentSnap.docs[0].data()
        }));
        router.push('/student-dashboard');
      }
    } catch (err) {
      console.error("Redirect error:", err);
      setAuthChecking(false);
    }
  }, [router]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) redirectUser(user);
      else setAuthChecking(false);
    });
    return () => unsubscribe();
  }, [redirectUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const cleanId = identifier.trim().toLowerCase();

    try {
      if (loginType === 'username') {
        const studentRef = doc(db, 'students', cleanId);
        const studentSnap = await getDoc(studentRef);

        if (studentSnap.exists() && studentSnap.data().password === password) {
          localStorage.setItem("studentUser", JSON.stringify({
            id: studentSnap.id,
            ...studentSnap.data()
          }));
          router.push('/student-dashboard');
          return;
        } else {
          throw new Error("ID Murid atau Kata Laluan salah.");
        }
      }
      const userCredential = await signInWithEmailAndPassword(auth, cleanId, password);
      await redirectUser(userCredential.user);
    } catch (err) {
      setError(err.message || "Gagal log masuk. Sila cuba lagi.");
      setLoading(false);
    }
  };

  if (authChecking) {
    return <div className="loading-screen">🔮 <span>Memuatkan Portal...</span></div>;
  }

  return (
    <div className="landing-page">
      <Head>
        <title>Si-Pintar | Diari Penulisan AI</title>
      </Head>

      <nav className="glass-nav">
        <div className="logo">🔮 Si-<span>Pintar</span></div>
        <Link href="/signup" className="nav-btn">Mula Sekarang</Link>
      </nav>

      <main className="hero">
        <div className="hero-text">
          <div className="badge">✨ Dibina untuk Pelajar Pintar</div>
          <h1>Tulis Karangan Lebih <span>Hebat</span> Dengan AI.</h1>
          <p>Dapatkan teguran tatabahasa dan kosa kata secara terus. Belajar menulis dengan seronok!</p>
          <div className="mini-stats">
            <div className="m-stat">🚀 <b>Laju</b></div>
            <div className="m-stat">🎯 <b>Tepat</b></div>
            <div className="m-stat">🌈 <b>Ceria</b></div>
          </div>
        </div>

        <div className="login-box-container">
          <div className="login-card">
            <h3>Selamat Kembali! 👋</h3>
            <div className="toggle-slider">
              <button className={loginType === 'username' ? 'active' : ''} onClick={() => setLoginType('username')}>ID Murid</button>
              <button className={loginType === 'email' ? 'active' : ''} onClick={() => setLoginType('email')}>Emel Guru</button>
            </div>

            <form onSubmit={handleLogin}>
              <div className="input-group">
                <input type={loginType === 'username' ? 'text' : 'email'} placeholder={loginType === 'username' ? "ID Murid (cth: ali123)" : "Emel Guru"} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
              </div>
              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 5px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#2D3436' }}>Kata Laluan</label>
                  {loginType === 'email' && (
                    <span onClick={handleForgotPassword} style={{ fontSize: '0.75rem', color: '#6C63FF', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>Lupa?</span>
                  )}
                </div>
                <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>{loading ? "Menyemak..." : "Masuk Sekarang"}</button>
            </form>
            
            <div className="signup-link">
              Cikgu baru di sini? <Link href="/signup">Daftar Akaun Guru</Link>
            </div>

            {error && <div className="error-pill">{error}</div>}
          </div>
        </div>
      </main>

      <style jsx global>{`
        body { margin: 0; background: #F8F7FF; font-family: 'Plus Jakarta Sans', sans-serif; }
        .landing-page { min-height: 100vh; display: flex; flex-direction: column; }
        .glass-nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 8%; }
        .logo { font-size: 1.6rem; font-weight: 800; color: #2D3436; }
        .logo span { color: #6C63FF; }
        .nav-btn { text-decoration: none; background: #6C63FF; color: white; padding: 10px 20px; border-radius: 12px; font-weight: 700; font-size: 0.9rem; }
        .hero { flex: 1; display: flex; align-items: center; padding: 0 8%; gap: 60px; }
        .hero-text { flex: 1.2; }
        .badge { background: #EBE9FF; color: #6C63FF; display: inline-block; padding: 6px 15px; border-radius: 20px; font-weight: 800; font-size: 0.8rem; margin-bottom: 20px; }
        h1 { font-size: 3.8rem; line-height: 1.1; margin-bottom: 20px; color: #2D3436; }
        h1 span { color: #6C63FF; }
        p { font-size: 1.2rem; color: #636E72; line-height: 1.6; margin-bottom: 30px; }
        .mini-stats { display: flex; gap: 20px; }
        .m-stat { background: white; padding: 10px 20px; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.03); font-weight: 600; }
        .login-box-container { flex: 0.8; display: flex; justify-content: center; }
        .login-card { background: white; padding: 40px; border-radius: 35px; box-shadow: 0 20px 40px rgba(108, 99, 255, 0.1); width: 100%; max-width: 380px; }
        .login-card h3 { text-align: center; margin-bottom: 25px; color: #2D3436; }
        .toggle-slider { display: flex; background: #F0F0FF; padding: 5px; border-radius: 15px; margin-bottom: 25px; }
        .toggle-slider button { flex: 1; border: none; background: none; padding: 10px; border-radius: 10px; cursor: pointer; font-weight: 700; transition: 0.3s; color: #636E72; }
        .toggle-slider button.active { background: white; color: #6C63FF; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .input-group { margin-bottom: 15px; }
        input { width: 100%; padding: 15px; border-radius: 15px; border: 2px solid #F0F0FF; font-size: 1rem; outline: none; transition: 0.3s; box-sizing: border-box; }
        input:focus { border-color: #6C63FF; }
        .submit-btn { width: 100%; background: #6C63FF; color: white; border: none; padding: 16px; border-radius: 15px; font-weight: 800; font-size: 1rem; cursor: pointer; transition: 0.3s; }
        .submit-btn:hover { background: #564ED9; transform: translateY(-3px); }
        .signup-link { text-align: center; margin-top: 20px; font-size: 0.9rem; color: #636E72; }
        .signup-link :global(a) { color: #6C63FF; font-weight: 700; text-decoration: none; }
        .error-pill { background: #FFE5E5; color: #D63031; padding: 10px; border-radius: 12px; margin-top: 15px; font-size: 0.85rem; text-align: center; font-weight: 600; }
        .loading-screen { height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #6C63FF; color: white; font-size: 1.5rem; font-weight: 800; }
        @media (max-width: 1000px) { .hero { flex-direction: column; padding: 40px 5%; text-align: center; } h1 { font-size: 2.5rem; } .mini-stats { justify-content: center; } }
      `}</style>
    </div>
  );
}