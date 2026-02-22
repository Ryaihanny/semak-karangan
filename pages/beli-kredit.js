import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const plans = [
  { id: 'price_1RkLm8JtYEymv1ohQZWw37UY', name: 'Standard', credits: 40, price: 9.90, desc: 'Pilihan guru biasa' },
  { id: 'price_1RkLm8JtYEymv1ohHqKogD7L', name: 'Premium', credits: 80, price: 15.90, desc: 'Paling popular', popular: true },
  { id: 'price_1RkLm8JtYEymv1ohv4vPnbJb', name: 'Bulk', credits: 160, price: 29.90, desc: 'Untuk satu aliran' },
  { id: 'price_1RkLm8JtYEymv1ohApMLRNwh', name: 'School Pack', credits: 500, price: 79.90, desc: 'Penggunaan satu sekolah' },
];

export default function BeliKredit() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser === null) {
        router.replace('/login');
        return;
      }
      setUser(currentUser);
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserDoc(userSnap.data());
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false); 
    });
    return () => unsubscribe();
  }, [router]);

  const handleCheckout = async (plan) => {
    if (!user) return;
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId: plan.id,
        uid: user.uid,
        credits: plan.credits,
      }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  if (loading) return <div className="loader-box"><div className="spinner"></div></div>;

  return (
    <div className="dashboard-wrapper">
      {/* --- SIDEBAR --- */}
      <aside className="main-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">SI</div>
          <div className="logo-text"><h3>SI-PINTAR</h3><span>VERSI GURU</span></div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-header">UTAMA</div>
          <div className="nav-link" onClick={() => router.push('/dashboard')}>📊 Rekod Murid</div>
          <div className="nav-link" onClick={() => router.push('/trend')}>📈 Analisis Murid</div>
          <div className="nav-divider"></div>
          <div className="nav-header">PENGURUSAN</div>
          <div className="nav-link" onClick={() => router.push('/urus-kelas')}>🏫 Urus Kelas</div>
          <div className="nav-link active">💰 Beli Kredit</div>
          <div className="nav-link" onClick={() => router.push('/profile')}>👤 Profil Guru</div>
          <div className="nav-divider"></div>
          <div className="nav-action-zone">
            <div className="nav-link highlight" onClick={() => router.push('/semak')}>✍️ Mulakan Semakan</div>
          </div>
        </nav>
        <button className="btn-logout-sidebar" onClick={() => signOut(auth)}>Keluar Sistem</button>
      </aside>

      {/* --- MAIN VIEWPORT --- */}
      <main className="main-viewport">
        <header className="viewport-header">
          <div className="header-title">
            <h1>Tambah Baki Kredit</h1>
            <p>Pilih pelan yang sesuai untuk keperluan semakan anda.</p>
          </div>
          <div className="credit-badge">
            Baki Semasa: <b>{userDoc?.credits || 0}</b>
          </div>
        </header>

        <section className="original-grid-system fade-in">
          {plans.map((plan) => (
            <div key={plan.id} className={`og-card ${plan.popular ? 'og-selected' : ''}`}>
              <div className="og-header">
                <span className="og-set">{plan.popular ? 'PILIHAN UTAMA' : 'PAKEJ'}</span>
                {plan.popular && <span className="popular-badge-text">BEST VALUE</span>}
              </div>
              
              <h3>{plan.name}</h3>
              <p className="og-meta">{plan.desc}</p>
              
              <div className="og-score-box">
                <div className="sc-item total">
                  <span>Kredit</span>
                  <b>{plan.credits}</b>
                </div>
                <div className="sc-item total">
                  <span>Harga</span>
                  <b>SGD {plan.price.toFixed(2)}</b>
                </div>
              </div>

              <button className="btn-og-print" onClick={() => handleCheckout(plan)}>
                Beli Sekarang
              </button>
            </div>
          ))}
        </section>

        <footer className="pricing-footer">
          <p>Transaksi anda selamat dan dienkripsi (Stripe Secured). Kredit akan dikreditkan secara automatik selepas pembayaran berjaya.</p>
        </footer>
      </main>

      <style jsx>{`
        /* EXACT DASHBOARD CSS */
        .dashboard-wrapper { display: flex; min-height: 100vh; background: #F2F6F6; font-family: 'Inter', sans-serif; color: #003D40; }
        .main-sidebar { width: 280px; background: #003D40; color: white; display: flex; flex-direction: column; padding: 2rem 1.5rem; position: sticky; top: 0; height: 100vh; flex-shrink: 0; }
        .sidebar-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 3rem; }
        .logo-icon { background: #FFD700; color: #003D40; font-weight: 900; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
        .logo-text h3 { margin: 0; font-size: 1.1rem; letter-spacing: 1px; }
        .logo-text span { font-size: 0.6rem; opacity: 0.5; font-weight: 700; }
        .sidebar-nav { flex: 1; }
        .nav-header { font-size: 0.65rem; font-weight: 800; color: rgba(255,255,255,0.4); letter-spacing: 1.5px; margin: 1.5rem 0 0.8rem 15px; }
        .nav-link { padding: 12px 15px; border-radius: 12px; cursor: pointer; margin-bottom: 4px; transition: 0.2s; color: rgba(255,255,255,0.7); font-size: 0.9rem; }
        .nav-link:hover { background: rgba(255,255,255,0.05); color: white; }
        .nav-link.active { background: #48A6A7; color: white; font-weight: 600; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .nav-link.highlight { background: #FFD700; color: #003D40; font-weight: 700; margin-top: 10px; }
        .nav-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 1.5rem 10px; }
        .btn-logout-sidebar { margin-top: auto; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 10px; cursor: pointer; }
        
        .main-viewport { flex: 1; padding: 2.5rem 3.5rem; overflow-y: auto; }
        .viewport-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .viewport-header h1 { margin: 0; font-size: 1.8rem; color: #003D40; }
        .viewport-header p { color: #64748B; margin: 5px 0 0; }
        .credit-badge { background: white; padding: 8px 16px; border-radius: 50px; border: 1px solid #E0E7E7; font-size: 0.85rem; }
        
        .original-grid-system { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
        .og-card { background: white; border-radius: 20px; padding: 1.8rem; border: 1px solid #E0E7E7; transition: 0.3s; }
        .og-card:hover { transform: translateY(-5px); }
        .og-selected { border: 2px solid #48A6A7; background: #F0FBFB; }
        .og-header { display: flex; justify-content: space-between; margin-bottom: 1rem; align-items: center; }
        .og-set { font-size: 0.7rem; font-weight: 900; color: #99AFAF; text-transform: uppercase; }
        .popular-badge-text { font-size: 0.65rem; background: #48A6A7; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
        .og-card h3 { margin: 0 0 5px; color: #003D40; font-size: 1.4rem; }
        .og-meta { font-size: 0.85rem; color: #889999; margin-bottom: 1.5rem; min-height: 40px; }
        .og-score-box { display: flex; justify-content: space-between; background: #F9FAFA; padding: 15px; border-radius: 12px; margin-bottom: 1.5rem; }
        .sc-item { display: flex; flex-direction: column; align-items: center; }
        .sc-item span { font-size: 0.6rem; color: #99AFAF; text-transform: uppercase; }
        .sc-item b { font-size: 1.1rem; color: #003D40; }
        .sc-item.total b { color: #48A6A7; font-size: 1.2rem; }
        
        .btn-og-print { width: 100%; padding: 12px; background: #003D40; color: white; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .btn-og-print:hover { background: #48A6A7; }
        
        .pricing-footer { margin-top: 4rem; text-align: center; color: #94A3B8; font-size: 0.75rem; max-width: 500px; margin-left: auto; margin-right: auto; line-height: 1.5; }
        .fade-in { animation: fadeIn 0.5s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .loader-box { height: 100vh; display: grid; place-items: center; background: #F2F6F6; }
        .spinner { width: 40px; height: 40px; border: 4px solid #E0E7E7; border-top: 4px solid #003D40; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}