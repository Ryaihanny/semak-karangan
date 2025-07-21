import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
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

  // Load user profile data from Firestore
  const loadUserData = async (uid) => {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      setNama(data.nama || '');
      setSekolah(data.sekolah || '');
      setCredits(data.credits || 0);
    }
  };

  // Save profile data
  const saveUserData = async () => {
    if (!user) return;
    setSaving(true);
    setMessage('');
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(
        userRef,
        {
          nama,
          sekolah,
          credits, // plural here
        },
        { merge: true }
      );
      setMessage('Maklumat berjaya disimpan.');
    } catch (error) {
      setMessage('Ralat menyimpan maklumat. Sila cuba lagi.');
    }
    setSaving(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace('/');
      } else {
        setUser(currentUser);
        await loadUserData(currentUser.uid);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/');
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="page">
      <header className="nav">
        <ul>
          <li>
            <a href="/dashboard">Dashboard</a>
          </li>
          <li>
            <a href="/semak">Semak Karangan</a>
          </li>
          <li>
            <a href="/profile">Profil</a>
          </li>
          <li>
            <a onClick={handleLogout} style={{ cursor: 'pointer' }}>
              Log Keluar
            </a>
          </li>
        </ul>
      </header>

      <main className="container">
        <section className="left">
          <h1 className="title">
            <span>Profil</span>
            <span>Pengguna</span>
            <span className="dot">.ai</span>
          </h1>
          <blockquote className="quote-box">
            <p>Kemaskini maklumat akaun anda dan lihat status kredit anda di sini.</p>
          </blockquote>
        </section>

        <section className="right">
          <h2>Maklumat Akaun</h2>
          <form onSubmit={(e) => e.preventDefault()}>
            <label>Emel</label>
            <input type="text" value={user.email} disabled />

            <label>Nama</label>
            <input type="text" value={nama} onChange={(e) => setNama(e.target.value)} />

            <label>Sekolah</label>
            <input type="text" value={sekolah} onChange={(e) => setSekolah(e.target.value)} />

            <label>Kredit Tersedia</label>
            <input type="text" value={credits} disabled />

            <button type="button" onClick={saveUserData} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
            {message && <p className="message">{message}</p>}
          </form>
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
          background: #f2efe7;
          color: #006a71;
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
          color: #006a71;
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
          color: #48a6a7;
        }
        .quote-box {
          margin-top: 2rem;
          font-size: 1.2rem;
          color: #444;
          border-left: 5px solid #48a6a7;
          padding-left: 1rem;
          max-width: 500px;
        }

        .right {
          background: #ffffffcc;
          padding: 2.5rem;
          border-radius: 20px;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
          width: 360px;
        }

        .right h2 {
          margin-bottom: 1.5rem;
          font-size: 2rem;
          color: #006a71;
          text-align: center;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        label {
          font-weight: 600;
          color: #006a71;
        }

        input {
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid #ccc;
          font-size: 1rem;
        }

        button {
          background: #48a6a7;
          color: white;
          font-weight: 600;
          padding: 1rem;
          border: none;
          border-radius: 12px;
          font-size: 1.2rem;
          cursor: pointer;
        }

        button:disabled {
          background: #9acbd0;
          cursor: not-allowed;
        }

        .message {
          margin-top: 1rem;
          font-weight: 600;
          color: #006a71;
          text-align: center;
        }

        @media (max-width: 768px) {
          .container {
            flex-direction: column;
            padding: 2rem;
          }
          .left,
          .right {
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
