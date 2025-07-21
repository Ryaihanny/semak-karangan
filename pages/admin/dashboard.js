// pages/admin/dashboard.js

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  increment,
  doc,
  getDoc,
} from 'firebase/firestore';
import useAuth from '@/lib/useAuth';
import { auth } from '@/lib/firebase';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [role, setRole] = useState(null);
  const [targetEmail, setTargetEmail] = useState('');
  const [amount, setAmount] = useState(0);

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCredits: 0,
    totalKaranganResults: 0,
    totalMarkedKaranganResults: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    if (user) {
      const fetchUserRole = async () => {
        try {
          const docRef = doc(db, 'users', user.uid);
          const snap = await getDoc(docRef);
          setRole(snap.exists() ? snap.data().role : null);
        } catch (err) {
          console.error('Failed to fetch role:', err);
          setRole(null);
        }
      };
      fetchUserRole();
    } else {
      setRole(null);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && role !== null) {
      if (!user) {
        router.push('/login');
      } else if (role !== 'admin') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, role, router]);

  useEffect(() => {
    if (role === 'admin') {
      const fetchStats = async () => {
        setStatsLoading(true);
        setStatsError('');
        try {
          // Fetch users
          const usersCol = collection(db, 'users');
          const usersSnap = await getDocs(usersCol);
          const users = usersSnap.docs.map(doc => doc.data());

          const totalUsers = users.length;
          const totalCredits = users.reduce((sum, u) => sum + (u.credits ?? 0), 0);

          // Fetch karanganResults
          const karanganCol = collection(db, 'karanganResults');
          const karanganSnap = await getDocs(karanganCol);

          const totalKaranganResults = karanganSnap.size;

          // Count marked karanganResults (assumes a boolean field 'marked')
          let totalMarkedKaranganResults = 0;
          karanganSnap.forEach(doc => {
            const data = doc.data();
            if (data.marked === true) totalMarkedKaranganResults++;
          });

          setStats({
            totalUsers,
            totalCredits,
            totalKaranganResults,
            totalMarkedKaranganResults,
          });
        } catch (err) {
          console.error('Failed to fetch stats:', err);
          setStatsError('Gagal mendapatkan statistik.');
        } finally {
          setStatsLoading(false);
        }
      };

      fetchStats();
    }
  }, [role]);

  async function handleAddCredits(e) {
    e.preventDefault();
    if (!targetEmail) return alert('Sila masukkan email pengguna.');
    if (amount <= 0) return alert('Masukkan jumlah kredit yang sah.');

    try {
      const q = query(collection(db, 'users'), where('email', '==', targetEmail));
      const snap = await getDocs(q);
      if (snap.empty) return alert('Pengguna tidak dijumpai.');

      const userRef = snap.docs[0].ref;
      await updateDoc(userRef, {
        credits: increment(amount),
      });

      alert('Kredit berjaya ditambah!');
      setTargetEmail('');
      setAmount(0);

      // Refresh stats after update
      if (role === 'admin') {
        const usersCol = collection(db, 'users');
        const usersSnap = await getDocs(usersCol);
        const users = usersSnap.docs.map(doc => doc.data());
        const totalCredits = users.reduce((sum, u) => sum + (u.credits ?? 0), 0);
        setStats(prev => ({ ...prev, totalCredits }));
      }
    } catch (err) {
      console.error(err);
      alert('Ralat semasa menambah kredit.');
    }
  }

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  };

  if (loading || role === null) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '1.5rem',
        color: '#006A71',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}>
        Memuatkan...
      </div>
    );
  }

  if (role !== 'admin') {
    return null;
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px',
        backgroundColor: '#003D40',
        color: '#fff',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        <h2 style={{ color: '#FFFFFF', marginBottom: '2rem' }}>⚙️ Admin Menu</h2>
        <nav>
          <ul style={{ listStyle: 'none', padding: 0, lineHeight: '2' }}>
            <li><a href="/dashboard" style={{ color: '#fff', textDecoration: 'none' }}>User Dashboard</a></li>
            <li><a href="/semak" style={{ color: '#fff', textDecoration: 'none' }}>Semak Karangan</a></li>
            <li><a href="/admin/dashboard" style={{ color: '#48A6A7', fontWeight: 'bold', textDecoration: 'underline' }}>Admin Dashboard</a></li>
            <li><a href="/beli-kredit" style={{ color: '#fff', textDecoration: 'none' }}>Beli Kredit</a></li>
            <li><button onClick={handleLogout} style={{ marginTop: 'auto', backgroundColor: '#d9534f', border: 'none', padding: '0.5rem 1rem', borderRadius: '5px', cursor: 'pointer', color: '#fff', fontWeight: 'bold' }}>Log Keluar</button></li>
          </ul>
        </nav>
      </aside>

      {/* Main */}
      <main style={{
        flex: 1,
        padding: '2rem',
        backgroundColor: '#F2EFE7',
        color: '#003D40',
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>📊 Admin Dashboard</h1>

        {/* Admin Info Card */}
        <div style={{
          backgroundColor: '#48A6A7',
          color: '#fff',
          borderRadius: '10px',
          padding: '1.5rem 2rem',
          boxShadow: '0 3px 8px rgba(0,0,0,0.15)',
          textAlign: 'center',
          maxWidth: '400px',
          margin: '0 auto 2rem',
        }}>
          <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>👩‍💼 Profil Anda (Admin)</h3>
          <p><strong>Nama:</strong> {user?.nama ?? '-'}</p>
          <p><strong>Email:</strong> {user?.email ?? '-'}</p>
          <p><strong>Sekolah:</strong> {user?.sekolah ?? '-'}</p>
          <p><strong>Role:</strong> {role}</p>
        </div>

        {/* Stats */}
        <section style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '1rem 2rem',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
          maxWidth: '600px',
          margin: '0 auto 2rem',
          color: '#006A71',
        }}>
          <h2>📈 Statistik Sistem</h2>
          {statsLoading && <p>Memuatkan statistik...</p>}
          {statsError && <p style={{ color: 'red' }}>{statsError}</p>}
          {!statsLoading && !statsError && (
            <>
              <p><strong>Jumlah Pengguna:</strong> {stats.totalUsers}</p>
              <p><strong>Jumlah Kredit Keseluruhan:</strong> {stats.totalCredits}</p>
              <p><strong>Jumlah Karangan Dihantar:</strong> {stats.totalKaranganResults}</p>
              <p><strong>Jumlah Karangan Telah Disemak:</strong> {stats.totalMarkedKaranganResults}</p>
            </>
          )}
        </section>

        {/* Tambah Kredit */}
        <section style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '1rem',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
          maxWidth: '600px',
          margin: '2rem auto',
        }}>
          <h2 style={{ color: '#006A71', marginBottom: '1rem' }}>Tambah Kredit Pengguna</h2>
          <form onSubmit={handleAddCredits}>
            <input
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value.trim())}
              placeholder="Email pengguna"
              style={inputStyle}
              required
              type="email"
            />
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Jumlah kredit"
              style={inputStyle}
              required
            />
            <button type="submit" style={buttonStyle}>
              Tambah Kredit
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

const inputStyle = {
  display: 'block',
  width: '100%',
  padding: '0.5rem',
  marginBottom: '0.75rem',
  border: '1px solid #ccc',
  borderRadius: '5px',
};

const buttonStyle = {
  padding: '0.5rem 1rem',
  backgroundColor: '#006A71',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
};
