// lib/useUserData.js
import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function useUserData(uid) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    const fetchData = async () => {
      try {
        const ref = doc(db, 'users', uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setData(snap.data());
        }
      } catch (err) {
        console.error('Fail fetch user data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [uid]);

  return { data, loading };
}
