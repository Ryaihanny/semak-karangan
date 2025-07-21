import { useRouter } from 'next/router';

export default function Cancel() {
  const router = useRouter();

  return (
    <div className="page">
      <header className="nav">
        <ul>
          <li><a href="/dashboard">Dashboard</a></li>
          <li><a href="/semak">Semak Karangan</a></li>
          <li><a href="/profile">Profil</a></li>
          <li><a href="/beli-kredit">Beli Kredit</a></li>
        </ul>
      </header>

      <main className="container">
        <h1>Pembayaran Dibatalkan</h1>
        <p>Anda telah membatalkan pembayaran.</p>
        <button onClick={() => router.push('/beli-kredit')}>
          Cuba Lagi
        </button>
      </main>

      <style jsx>{`
        .page {
          font-family: 'Poppins', sans-serif;
          background: #F2EFE7;
          color: #006A71;
          min-height: 100vh;
          padding-top: 80px;
        }
        .nav {
          position: fixed;
          top: 24px;
          right: 40px;
          z-index: 100;
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
          background: #ffffffcc;
          padding: 2.5rem 3rem;
          border-radius: 20px;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
          text-align: center;
          max-width: 400px;
          margin: 3rem auto;
        }
        h1 {
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }
        p {
          font-size: 1.2rem;
          margin-bottom: 1.5rem;
        }
        button {
          background: #48A6A7;
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1.1rem;
          cursor: pointer;
        }
        button:hover {
          background: #3a8d8e;
        }
      `}</style>
    </div>
  );
}
