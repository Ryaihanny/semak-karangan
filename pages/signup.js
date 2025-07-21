import { useState } from 'react';
import { useRouter } from 'next/router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

const handleSignup = async () => {
  setLoading(true);
  setError('');

  if (password !== confirmPassword) {
    setError('Kata laluan tidak sepadan.');
    setLoading(false);
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);

    // ✅ Add user to Firestore
    const db = getFirestore();
    await setDoc(doc(db, 'users', auth.currentUser.uid), {
      email,
      nama: '',
      sekolah: '',
      role: 'pelajar',
      credit: 5,
      createdAt: new Date()
    });

    router.push('/beli-kredit');
  } catch (err) {
    setError('Pendaftaran gagal. Sila cuba lagi.');
  }

  setLoading(false);
};

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSignup();
  };

  return (
    <div className="page">
      <main className="container">
        <section className="form-container">
          <h2>Daftar Akaun</h2>
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Emel"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <input
              type="password"
              placeholder="Kata Laluan"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <input
              type="password"
              placeholder="Sahkan Kata Laluan"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Sedang Daftar...' : 'Daftar'}
            </button>
          </form>
          {error && <p className="error">{error}</p>}

          <div className="links">
            Sudah ada akaun?{' '}
            <a href="/login">Log Masuk</a>
          </div>
        </section>
      </main>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap');

        * {
          box-sizing: border-box;
        }
        body,
        html,
        .page {
          margin: 0;
          padding: 0;
          height: 100vh;
          font-family: 'Poppins', sans-serif;
          background: #F2EFE7;
          color: #006A71;
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
        }

        .container {
          background: #ffffffcc;
          padding: 2.5rem;
          border-radius: 20px;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
          width: 360px;
        }

        .form-container h2 {
          margin-bottom: 1.5rem;
          font-size: 2rem;
          color: #006A71;
          text-align: center;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        input {
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid #ccc;
          font-size: 1rem;
          color: #006A71;
        }

        input:disabled {
          background-color: #f5f5f5;
          cursor: not-allowed;
        }

        button {
          background: #48A6A7;
          color: white;
          font-weight: 600;
          padding: 1rem;
          border: none;
          border-radius: 12px;
          font-size: 1.2rem;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        button:hover:enabled {
          background: #3a8d8e;
        }

        button:disabled {
          background: #9ACBD0;
          cursor: not-allowed;
        }

        .error {
          color: red;
          font-size: 0.9rem;
          margin-top: 1rem;
          text-align: center;
        }

        .links {
          text-align: center;
          margin-top: 1rem;
          font-size: 0.9rem;
        }

        .links a {
          color: #006A71;
          text-decoration: underline;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
