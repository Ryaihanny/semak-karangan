import { useState } from 'react';
import { useRouter } from 'next/router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import Head from 'next/head';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Pautan pemulihan telah dihantar ke emel anda. Sila semak peti masuk (inbox) atau spam.');
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setError('Emel ini tidak dijumpai dalam sistem.');
      } else {
        setError('Gagal menghantar emel pemulihan. Sila cuba lagi.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="page-wrapper">
      <Head>
        <title>Lupa Kata Laluan | SemakKarangan.ai</title>
      </Head>

      <nav className="navbar">
        <div className="logo" onClick={() => router.push('/')} style={{cursor: 'pointer'}}>
          Semak<span>Karangan</span>
        </div>
      </nav>

      <main className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h2>Pulihkan Kata Laluan</h2>
            <p>Masukkan emel anda dan kami akan hantar pautan untuk menetapkan semula kata laluan anda.</p>
          </div>

          <form onSubmit={handleReset}>
            <div className="input-group">
              <label>Emel Berdaftar</label>
              <input 
                type="email" 
                placeholder="nama@contoh.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-reset" disabled={loading}>
              {loading ? "Menghantar..." : "Hantar Pautan Pemulihan"}
            </button>
          </form>

          {message && <div className="success-box">{message}</div>}
          {error && <div className="error-box">{error}</div>}

          <div className="auth-footer">
            <p><a href="/">← Kembali ke Log Masuk</a></p>
          </div>
        </div>
      </main>

      <style jsx global>{`
        body { margin: 0; padding: 0; background: #F2EFE7; font-family: 'Inter', sans-serif; color: #003D40; }
        .page-wrapper { min-height: 100vh; display: flex; flex-direction: column; }
        
        .navbar { padding: 25px 5%; display: flex; justify-content: center; }
        .logo { font-size: 1.5rem; font-weight: 800; }
        .logo span { color: #48A6A7; }

        .auth-container { flex: 1; display: flex; justify-content: center; align-items: center; padding: 20px; }
        .auth-card { 
          background: white; 
          padding: 40px; 
          border-radius: 30px; 
          box-shadow: 0 15px 35px rgba(0,0,0,0.06); 
          width: 100%; 
          max-width: 400px; 
        }

        .auth-header { text-align: center; margin-bottom: 25px; }
        .auth-header h2 { font-size: 1.6rem; margin-bottom: 10px; }
        .auth-header p { color: #666; font-size: 0.9rem; line-height: 1.5; }

        .input-group { margin-bottom: 20px; }
        .input-group label { display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 8px; }
        input { 
          width: 100%; 
          padding: 14px; 
          border-radius: 12px; 
          border: 1px solid #E0E0E0; 
          background: #F9F9F9;
          font-size: 1rem; 
          box-sizing: border-box;
        }

        .btn-reset { 
          width: 100%; 
          padding: 15px; 
          background: #48A6A7; 
          color: white; 
          border: none; 
          border-radius: 12px; 
          font-weight: 700; 
          cursor: pointer;
        }

        .success-box { 
          margin-top: 20px; 
          background: #F0FFF4; 
          color: #2F855A; 
          padding: 12px; 
          border-radius: 10px; 
          font-size: 0.85rem; 
          text-align: center;
          border: 1px solid #C6F6D5;
        }

        .error-box { 
          margin-top: 20px; 
          background: #FFF5F5; 
          color: #C53030; 
          padding: 12px; 
          border-radius: 10px; 
          font-size: 0.85rem; 
          text-align: center;
          border: 1px solid #FED7D7;
        }

        .auth-footer { margin-top: 25px; text-align: center; font-size: 0.9rem; }
        .auth-footer a { color: #48A6A7; text-decoration: none; font-weight: 600; }
      `}</style>
    </div>
  );
}