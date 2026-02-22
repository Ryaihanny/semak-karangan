import { useState } from 'react';
import Papa from 'papaparse';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function BulkRegister() {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    setUploading(true);

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        for (const row of results.data) {
          if (row.username) {
            await registerStudent(row);
          }
        }
        alert("Semua pelajar berjaya didaftarkan!");
        setUploading(false);
      },
    });
  };

  const registerStudent = async (data) => {
    const virtualEmail = `${data.username.toLowerCase()}@pintar.com`;
    const defaultPassword = "password123";

    try {
      // 1. Cipta akaun di Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, virtualEmail, defaultPassword);
      
      // 2. Simpan profil di Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        username: data.username.toUpperCase(),
        nama: data.nama,
        sekolah: data.sekolah,
        role: 'pelajar',
        credits: 10, // Kredit permulaan
        enrolledClasses: [],
        mustChangePassword: true // Paksa tukar password nanti
      });
    } catch (err) {
      console.error(`Gagal daftar ${data.username}:`, err.message);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>📤 Upload Excel Pelajar (CSV)</h2>
      <input type="file" accept=".csv" onChange={handleFileUpload} disabled={uploading} />
      {uploading && <p>Sedang memproses... Sila tunggu.</p>}
      <p style={{ marginTop: '10px', color: '#666' }}>
        Format CSV: <b>username, nama, sekolah</b>
      </p>
    </div>
  );
}