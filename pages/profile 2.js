import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace('/');
      } else {
        setUser(currentUser);
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
        } catch (err) {
          console.error('Fail dapat data profil:', err);
        }
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/');
  };

  if (loading) {
    return (
      <div className="loading">
        <p>Loading...</p>
        <style jsx>{`
          .loading {
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: #F2EFE7;
            color: #006A71;
            font-family: 'Poppins', sans-serif;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2>Menu</h2>
        <nav>
          <ul>
            <li><a href="/dashboard">Dashboard</a></li>
            <li><a href="/semak">Semak Karangan</a></li>
            <li><a href="/profile" className="active">Profil</a></li>
          </ul>
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>Profil Saya</h1>
          <div className="user-info">
            <span>{user.email}</span>
            <button onClick={handleLogout}>Log Keluar</button>
          </div>
        </header>

        <section className="content">
          <p>Maklumat Akaun:</p>
          <ul>
            <li><strong>Emel:</strong> {user.email}</li>
            <li><strong>Pelan Akaun:</strong> {userData?.planName || 'Tidak diketahui'}</li>
            <li><strong>Baki Kredit:</strong> {userData?.credits ?? 'Tidak diketahui'}</li>
          </ul>
        </section>
      </main>

      <style jsx>{`
        .dashboard {
          display: flex;
          height: 100vh;
          font-family: 'Poppins', sans-serif;
        }

        .sidebar {
          width: 220px;
          background: #006A71;
          color: white;
          padding: 1.5rem;
        }

        .sidebar h2 {
          margin-bottom: 1rem;
        }

        .sidebar ul {
          list-style: none;
          padding: 0;
        }

        .sidebar ul li {
          margin: 1rem 0;
        }

        .sidebar ul li a {
          color: #F2EFE7;
          text-decoration: none;
        }

        .sidebar ul li a.active,
        .sidebar ul li a:hover {
          background: #48A6A7;
          padding: 0.3rem 0.5rem;
          border-radius: 6px;
          display: inline-block;
        }

        .main {
          flex: 1;
          background: #F2EFE7;
          padding: 2rem;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #9ACBD0;
          padding-bottom: 1rem;
          margin-bottom: 2rem;
        }

        .topbar h1 {
          margin: 0;
          color: #006A71;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .user-info span {
          font-weight: 600;
          color: #006A71;
        }

        .user-info button {
          background: #48A6A7;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
        }

        .content {
          color: #333;
          font-size: 1.1rem;
        }

        .content ul {
          padding-left: 1.2rem;
        }

        .content li {
          margin-bottom: 0.8rem;
        }
      `}</style>
    </div>
  );
}
