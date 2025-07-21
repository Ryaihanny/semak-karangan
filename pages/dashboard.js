// pages/dashboard.js

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getIdToken } from 'firebase/auth';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function Dashboard() {
  const router = useRouter();

  // --- State Variables ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [availableSets, setAvailableSets] = useState([]);
  const [selectedSet, setSelectedSet] = useState('');

  const [viewMode, setViewMode] = useState('class'); // 'class' or 'individual'

  // Class view
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState('');

  // Individual view
  const [allStudents, setAllStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [studentProgress, setStudentProgress] = useState([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState('');

  // Checkbox selected students for bulk delete
  const [selectedIds, setSelectedIds] = useState([]);

  // Save last valid student progress to avoid flicker on empty fetch
  const lastValidProgress = useRef([]);

  // --- Auth and user info loading ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace('/');
        return;
      }

      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setUser({
            ...currentUser,
            role: userData.role || 'user',
            credits: userData.credits ?? 0,
            email: currentUser.email,
          });
        } else {
          setUser({
            ...currentUser,
            role: 'user',
            credits: 0,
            email: currentUser.email,
          });
        }
      } catch (error) {
        console.error('Failed to get user data:', error);
        setUser({
          ...currentUser,
          role: 'user',
          credits: 0,
          email: currentUser.email,
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // --- Fetch available sets ---
  useEffect(() => {
    async function fetchSets() {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const token = await getIdToken(user, true);
        const res = await fetch('/api/sets', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        setAvailableSets(data.sets || []);
        if (data.sets?.length > 0) {
          setSelectedSet(String(data.sets[0]));
        }
      } catch (err) {
        console.error('Gagal mendapatkan senarai set:', err);
      }
    }

    if (auth.currentUser) {
      fetchSets();
    } else {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) fetchSets();
      });
      return () => unsubscribe();
    }
  }, []);

  // --- Fetch all distinct students for individual view ---
  useEffect(() => {
    async function fetchAllStudents() {
      try {
        const token = await getIdToken(auth.currentUser, true);
        const res = await fetch('/api/allstudents', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setAllStudents(data.students || []);
        if (data.students?.length > 0 && !selectedStudent) {
          setSelectedStudent(data.students[0]);
        }
      } catch (err) {
        console.error('Gagal mendapatkan senarai semua pelajar:', err);
      }
    }

    if (auth.currentUser) {
      fetchAllStudents();
    } else {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) fetchAllStudents();
      });
      return () => unsubscribe();
    }
  }, [selectedStudent]);

  // --- Fetch results and students for selected set when in class view ---
  useEffect(() => {
    if (!selectedSet || viewMode !== 'class') return;

    async function fetchResults() {
      setResultsLoading(true);
      setResultsError('');
      try {
        const user = auth.currentUser;
        if (!user) {
          setResultsError('Pengguna tidak ditemui.');
          setResultsLoading(false);
          return;
        }

        const token = await getIdToken(user, true);
        const res = await fetch(
  `/api/results/class?set=${encodeURIComponent(selectedSet)}`,
  { headers: { Authorization: `Bearer ${token}` } }
);


        if (!res.ok) throw new Error('Gagal memuatkan data pelajar');

        const data = await res.json();

        // Filter results by selected set
        const filtered = data.results.filter(r => String(r.set) === String(selectedSet));
        setResults(filtered || []);
      } catch (err) {
        setResultsError(err.message || 'Ralat tidak diketahui');
        setResults([]);
      } finally {
        setResultsLoading(false);
      }
    }

    if (auth.currentUser) {
      fetchResults();
    } else {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) fetchResults();
      });
      return () => unsubscribe();
    }
  }, [selectedSet, viewMode]);

  // --- Fetch individual student progress when in individual view ---
  useEffect(() => {
    if (!selectedStudent || viewMode !== 'individual') return;

    async function fetchStudentProgress() {
      setProgressLoading(true);
      setProgressError('');
      try {
        const token = await getIdToken(auth.currentUser, true);
        const res = await fetch(
          `/api/results/student?nama=${encodeURIComponent(selectedStudent)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!res.ok) throw new Error('Gagal memuatkan data kemajuan pelajar');

        const data = await res.json();

        if (data.results && data.results.length > 0) {
          lastValidProgress.current = data.results;
          setStudentProgress(data.results);
        } else {
          setStudentProgress(lastValidProgress.current);
        }
      } catch (err) {
        setProgressError(err.message || 'Ralat tidak diketahui');
        setStudentProgress([]);
      } finally {
        setProgressLoading(false);
      }
    }

    fetchStudentProgress();
  }, [selectedStudent, viewMode]);

  // --- Logout handler ---
  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/');
  };

  // --- Delete single student result ---
  async function handleDelete(nama) {
    if (!confirm(`Padam data pelajar ${nama}? Tindakan ini tidak boleh dibatalkan.`)) return;

    try {
      const res = await fetch('/api/semak/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ralat memadam data');

      setResults((prev) => prev.filter((r) => r.nama !== nama));
      setSelectedIds((prev) => prev.filter((id) => id !== nama));
      alert(data.message);
    } catch (err) {
      alert(`Gagal memadam data: ${err.message}`);
    }
  }

  // --- Bulk delete handler ---
  async function handleBulkDelete() {
    if (!confirm('Padam semua pelajar terpilih? Tindakan ini tidak boleh dibatalkan.')) return;

    try {
      const res = await fetch('/api/semak/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama: selectedIds }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ralat memadam data');

      setResults((prev) => prev.filter((r) => !selectedIds.includes(r.nama)));
      setSelectedIds([]);
      alert('Karangan berjaya dipadam.');
    } catch (err) {
      alert(`Gagal memadam data: ${err.message}`);
    }
  }

  // --- Select All handler ---
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allNames = results.map((r) => r.nama);
      setSelectedIds(allNames);
    } else {
      setSelectedIds([]);
    }
  };

  // --- Prepare Chart Data and Options ---
  const chartData = {
    labels:
      studentProgress?.map((r) =>
        r.timestamp
          ? new Date(r.timestamp).toLocaleDateString('ms-MY', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : '-'
      ) || [],
    datasets: [
      {
        label: 'Markah Isi',
        data: studentProgress?.map((r) => r.markahIsi ?? 0) || [],
        borderColor: '#006A71',
        backgroundColor: '#006A71aa',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Markah Bahasa',
        data: studentProgress?.map((r) => r.markahBahasa ?? 0) || [],
        borderColor: '#48A6A7',
        backgroundColor: '#48A6A7aa',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Jumlah Markah',
        data: studentProgress?.map((r) => r.markahKeseluruhan ?? 0) || [],
        borderColor: '#9ACBD0',
        backgroundColor: '#9ACBD0aa',
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: {
        display: true,
        text: selectedStudent ? `Kemajuan ${selectedStudent}` : 'Kemajuan Pelajar',
        font: { size: 18 },
      },
      tooltip: { mode: 'index', intersect: false },
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    scales: {
      y: {
        min: 0,
        max: 40,
        ticks: { stepSize: 4 },
        title: {
          display: true,
          text: 'Markah',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Tarikh',
        },
      },
    },
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <h2>Menu</h2>
        <nav>
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
              <a href="/beli-kredit">Beli Kredit</a>
            </li>
            {user?.role === 'admin' && (
              <li>
                <a href="/admin/dashboard">Admin Dashboard</a>
              </li>
            )}
          </ul>
        </nav>
      </aside>

      {/* Main content */}
      <main className="main">
        {/* Topbar */}
        <header className="topbar">
          <h1>Dashboard</h1>
          <div className="user-info">
            <span>{user.email}</span>
            <span style={{ marginLeft: '1rem', fontWeight: '600', color: '#006A71' }}>
              Kredit: {user.credits ?? 0}
            </span>
            <button onClick={handleLogout}>Log Keluar</button>
          </div>
        </header>

        <section className="content">
          <p>
            Selamat datang ke papan pemuka anda! Di sini anda boleh semak karangan dan lihat kemajuan
            anda.
          </p>

          {/* View mode selector */}
          <div className="mb-4">
            <label htmlFor="viewMode" className="block mb-1 font-semibold text-[#006A71]">
              Lihat Mengikut:
            </label>
            <select
              id="viewMode"
              className="p-2 border rounded bg-white text-[#006A71]"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
            >
              <option value="class">Kemajuan Kelas Berdasarkan Set</option>
              <option value="individual">Kemajuan Individu Semua Set</option>
            </select>
          </div>

          {/* Class view */}
          {viewMode === 'class' && (
            <>
              <div className="mb-4">
                <label htmlFor="setSelect" className="block mb-1 font-semibold text-[#006A71]">
                  Pilih Set:
                </label>
                <select
                  id="setSelect"
                  className="p-2 border rounded bg-white text-[#006A71]"
                  value={selectedSet}
                  onChange={(e) => setSelectedSet(e.target.value)}
                >
                  {availableSets.map((s) => (
                    <option key={s} value={String(s)}>
                      Set {s}
                    </option>
                  ))}
                </select>
              </div>

              <h2 className="results-title">Prestasi Karangan Pelajar</h2>

              <div className="select-all-container">
                <label>
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={selectedIds.length === results.length && results.length > 0}
                  />{' '}
                  Pilih Semua
                </label>

                <button
                  onClick={handleBulkDelete}
                  disabled={selectedIds.length === 0}
                  className="delete-btn"
                >
                  🗑️ Padam Pilihan
                </button>
              </div>

              {resultsLoading && <p>Memuatkan keputusan pelajar...</p>}
              {resultsError && <p className="error">{resultsError}</p>}
              {!resultsLoading && results.length === 0 && (
                <p>Tiada data pelajar untuk dipaparkan.</p>
              )}

              <div className="results-list stacked-list">
                {results.map(({ nama, set, markahIsi, markahBahasa, markahKeseluruhan, id }) => (
                  <div key={id ?? `${nama}-${set}`} className="result-card">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(nama)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds((prev) => [...prev, nama]);
                        else setSelectedIds((prev) => prev.filter((n) => n !== nama));
                      }}
                    />
                    <h3>{nama}</h3>
                    <p>
                      <strong>Set:</strong> {set || '-'}
                    </p>
                    <p>
                      <strong>Markah Isi:</strong> {markahIsi ?? '-'}
                    </p>
                    <p>
                      <strong>Markah Bahasa:</strong> {markahBahasa ?? '-'}
                    </p>
                    <p>
                      <strong>Jumlah Markah:</strong> {markahKeseluruhan ?? '-'}
                    </p>
                    <button className="delete-btn" onClick={() => handleDelete(nama)}>
                      Padam
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Individual view */}
          {viewMode === 'individual' && (
            <>
              <div className="mb-4">
                <label htmlFor="studentSelect" className="block mb-1 font-semibold text-[#006A71]">
                  Pilih Pelajar:
                </label>
                <select
                  id="studentSelect"
                  className="p-2 border rounded bg-white text-[#006A71]"
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                >
                  <option value="">-- Pilih Pelajar --</option>
                  {allStudents.map((student) => (
                    <option key={student} value={student}>
                      {student}
                    </option>
                  ))}
                </select>
              </div>

              {progressLoading && <p>Memuatkan kemajuan pelajar...</p>}
              {progressError && <p className="error">{progressError}</p>}

              {selectedStudent && studentProgress && studentProgress.length > 0 && (
                <div style={{ maxWidth: '700px', marginBottom: '2rem' }}>
                  <Line options={chartOptions} data={chartData} />
                </div>
              )}

              {!progressLoading &&
                (!studentProgress || studentProgress.length === 0) && (
                  <p>Tiada data kemajuan untuk pelajar ini.</p>
                )}
            </>
          )}
        </section>
      </main>

      {/* Styles */}
      <style jsx>{`
        .dashboard {
          display: flex;
          height: 100vh;
          font-family: 'Poppins', sans-serif;
        }

        .sidebar {
          width: 220px;
          background: #006a71;
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
          color: #f2efe7;
          text-decoration: none;
        }

        .main {
          flex: 1;
          background: #f2efe7;
          padding: 2rem;
          overflow-y: auto;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #9acbd0;
          padding-bottom: 1rem;
          margin-bottom: 2rem;
        }

        .topbar h1 {
          margin: 0;
          color: #006a71;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .user-info span {
          font-weight: 600;
          color: #006a71;
        }

        .user-info button {
          background: #48a6a7;
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

        .mb-4 {
          margin-bottom: 1rem;
        }

        label {
          display: block;
          margin-bottom: 0.25rem;
        }

        select {
          width: 100%;
          max-width: 300px;
          padding: 0.5rem;
          border: 1px solid #ccc;
          border-radius: 8px;
          font-size: 1rem;
          color: #006a71;
          background-color: white;
        }

        .results-title {
          font-weight: 700;
          color: #006a71;
          margin-bottom: 1rem;
          font-size: 1.3rem;
        }

        .select-all-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          max-width: 500px;
        }

        .delete-btn {
          background: #cc4444;
          border: none;
          color: white;
          padding: 0.3rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: background-color 0.3s ease;
        }
        .delete-btn:disabled {
          background: #aaa;
          cursor: not-allowed;
        }
        .delete-btn:hover:not(:disabled) {
          background: #a83333;
        }

        .results-list {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .result-card {
          background: white;
          border-radius: 12px;
          padding: 1rem;
          box-shadow: 0 0 6px rgb(0 106 113 / 0.1);
          width: 280px;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          position: relative;
        }

        .result-card h3 {
          margin: 0;
          color: #006a71;
          font-weight: 700;
        }

        .result-card p {
          margin: 0;
          font-size: 0.95rem;
        }

        .error {
          color: red;
          font-weight: 600;
          margin-top: 1rem;
        }
      `}</style>
    </div>
  );
}
