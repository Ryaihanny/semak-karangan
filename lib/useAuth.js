// lib/useAuth.js
import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            console.log('User doc found:', userData);

            setUser({
              uid: currentUser.uid,
              email: currentUser.email,
              ...userData, // role, credits, nama, etc.
            });
          } else {
            console.warn('No Firestore user doc found for uid:', currentUser.uid);
            setUser({
              uid: currentUser.uid,
              email: currentUser.email,
            });
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setUser({
            uid: currentUser.uid,
            email: currentUser.email,
          });
        }
      } else {
        console.log('User signed out');
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    console.log('Auth hook user state:', user);
  }, [user]);

  return { user, loading };
}
