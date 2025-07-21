import { useState } from 'react';
import { useRouter } from 'next/router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (err) {
      setError('Log masuk gagal. Sila semak emel dan kata laluan.');
    }
    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleLogin();
  };

  return (
    <div className="page">
      <main className="container">
        <section className="form-container">
          <h2>Log Masuk</h2>
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
            <button type="submit" disabled={loading}>
              {loading ? 'Sedang Log Masuk...' : '→'}
            </button>
          </form>
          {error && <p className="error">{error}</p>}

          <div className="links">
            <a href="/signup">Daftar Akaun</a> | <a href="/forgot-password">Lupa Kata Laluan?</a>
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
        }
      `}</style>
    </div>
  );
}
