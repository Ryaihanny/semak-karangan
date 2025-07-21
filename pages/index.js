import { useRouter } from 'next/router';
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Home() {
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
      <header className="nav">
        <ul>
          <li><a href="#about">Tentang</a></li>
          <li><a href="/signup">Daftar</a></li>
          <li><a href="#pricing">Harga</a></li>
          <li><a href="#contact">Hubungi</a></li>
        </ul>
      </header>

      <main className="container">
        <section className="left">
          <h1 className="title">
            <span>Semak</span>
            <span>Karangan</span>
            <span className="dot">.ai</span>
          </h1>
          <blockquote className="quote-box">
            <p>
              Membantu guru menyemak karangan murid secara automatik – kenal pasti isi penting, analisis kesalahan bahasa, berikan markah dan pembetulan – dalam satu sistem yang pantas.
            </p>
          </blockquote>
        </section>

        <section className="right">
          <h2>Log Masuk</h2>
          <form onSubmit={handleSubmit}>
            <input type="email" placeholder="Emel" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
            <input type="password" placeholder="Kata Laluan" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
            <button type="submit" disabled={loading}>{loading ? 'Sedang Log Masuk...' : '→'}</button>
          </form>
          {error && <p className="error">{error}</p>}
          <div className="links">
            <a href="/signup">Daftar Akaun</a> | <a href="/forgot-password">Lupa Kata Laluan?</a>
          </div>
        </section>
      </main>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap');

        * { box-sizing: border-box; }
        body, html, .page {
          margin: 0;
          padding: 0;
          height: 100vh;
          font-family: 'Poppins', sans-serif;
          background: #F2EFE7;
          color: #006A71;
          overflow: hidden;
        }

        .nav {
          position: fixed;
          top: 24px;
          right: 40px;
        }
        .nav ul {
          display: flex;
          gap: 24px;
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .nav ul li a {
          text-decoration: none;
          font-weight: 600;
          color: #006A71;
        }

        .container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 100%;
          padding: 6rem 8rem;
        }

        .left {
          flex: 1;
        }
        .title {
          font-size: 5rem;
          font-weight: 800;
          line-height: 1;
        }
        .title span {
          display: block;
        }
        .dot {
          color: #48A6A7;
        }
        .quote-box {
          margin-top: 2rem;
          font-size: 1.2rem;
          color: #444;
          border-left: 5px solid #48A6A7;
          padding-left: 1rem;
          max-width: 500px;
        }

        .right {
          background: #ffffffcc;
          padding: 2.5rem;
          border-radius: 20px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
          width: 360px;
        }

        .right h2 {
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
        }

        button:disabled {
          background: #9ACBD0;
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

        @media (max-width: 768px) {
          .container {
            flex-direction: column;
            padding: 2rem;
          }
          .left, .right {
            width: 100%;
            text-align: center;
          }
          .right {
            margin-top: 2rem;
          }
        }
      `}</style>
    </div>
  );
}
