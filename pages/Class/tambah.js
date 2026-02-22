import { useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useRouter } from 'next/router';

export default function TambahKelas() {
  const [className, setClassName] = useState('');
  const [level, setLevel] = useState('P6');
  const [teacherName, setTeacherName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Simpan ke koleksi 'classes'
      const docRef = await addDoc(collection(db, 'classes'), {
        className: className,
        level: level,
        teacherName: teacherName,
        createdAt: new Date().toISOString()
      });

      alert("Kelas berjaya didaftarkan!");
      router.push(`/Class/${docRef.id}`); // Terus ke dashboard kelas baru
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("Gagal menambah kelas.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="form-card">
        <h2>Daftar Kelas Baru</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Nama Kelas (Contoh: 6 Cerdik)</label>
            <input 
              type="text" 
              value={className} 
              onChange={(e) => setClassName(e.target.value)} 
              required 
              placeholder="Masukkan nama kelas"
            />
          </div>

          <div className="input-group">
            <label>Peringkat</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="P3">P3</option>
              <option value="P4">P4</option>
              <option value="P5">P5</option>
              <option value="P6">P6</option>
            </select>
          </div>

          <div className="input-group">
            <label>Nama Guru</label>
            <input 
              type="text" 
              value={teacherName} 
              onChange={(e) => setTeacherName(e.target.value)} 
              required 
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Menyimpan..." : "Bina Kelas"}
          </button>
        </form>
      </div>

      <style jsx>{`
        .container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: #f4f7f6;
          font-family: 'Poppins', sans-serif;
        }
        .form-card {
          background: white;
          padding: 2.5rem;
          border-radius: 20px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          width: 100%;
          max-width: 400px;
        }
        h2 { color: #006A71; margin-bottom: 1.5rem; text-align: center; }
        .input-group { margin-bottom: 1.2rem; }
        label { display: block; margin-bottom: 5px; color: #48A6A7; font-weight: bold; }
        input, select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 1rem;
        }
        button {
          width: 100%;
          padding: 12px;
          background: #006A71;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
          transition: background 0.3s;
        }
        button:hover { background: #48A6A7; }
      `}</style>
    </div>
  );
}