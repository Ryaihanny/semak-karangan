import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AdminLayout from '@/components/AdminLayout';

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
    setLoading(false); // Move it outside try/catch to be 100% sure
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

  if (loading) return <div className="loader-box">Memuatkan Sistem...</div>;

  return (
    <AdminLayout activePage="beli-kredit">
      <header className="topbar">
        <div className="header-title">
          <h1>Tambah Baki Kredit</h1>
          <p>Pilih pelan yang sesuai untuk keperluan semakan anda.</p>
        </div>
        <div className="credit-pill">
          Baki Semasa: <span>{userDoc?.credits || 0}</span>
        </div>
      </header>

      <section className="pricing-grid">
        {plans.map((plan) => (
          <div key={plan.id} className={`plan-card ${plan.popular ? 'popular' : ''}`}>
            {plan.popular && <span className="badge">Nilai Terbaik</span>}
            <div className="plan-header">
              <h3>{plan.name}</h3>
              <p className="plan-desc">{plan.desc}</p>
            </div>
            
            <div className="plan-body">
              <div className="credit-count">{plan.credits}</div>
              <div className="credit-label">KREDIT SEMAKAN</div>
              <div className="price-tag">SGD {plan.price.toFixed(2)}</div>
            </div>

            <button className="btn-buy" onClick={() => handleCheckout(plan)}>
              Beli Sekarang
            </button>
          </div>
        ))}
      </section>

      <footer className="pricing-footer">
        <p>Transaksi anda selamat dan dienkripsi (Stripe Secured). Kredit akan dikreditkan secara automatik selepas pembayaran berjaya.</p>
      </footer>

      <style jsx>{`
        .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; }
        .header-title h1 { margin: 0; font-size: 1.8rem; color: #003D40; }
        .header-title p { color: #64748B; margin: 5px 0 0; }
        
        .credit-pill { background: white; padding: 10px 20px; border-radius: 50px; border: 1px solid #E2E8F0; font-size: 0.9rem; font-weight: 600; }
        .credit-pill span { color: #48A6A7; font-weight: 800; }

        /* Pricing Grid */
        .pricing-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; }
        
        .plan-card { background: white; border-radius: 20px; padding: 3rem 1.5rem; border: 1px solid #E2E8F0; text-align: center; position: relative; transition: 0.3s ease; display: flex; flex-direction: column; }
        .plan-card:hover { transform: translateY(-8px); box-shadow: 0 15px 35px rgba(0,0,0,0.05); }
        .plan-card.popular { border: 2px solid #48A6A7; background: #f0fbfc; }
        
        .badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #48A6A7; color: white; padding: 4px 12px; border-radius: 50px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; }
        
        .plan-header h3 { margin: 0; font-size: 1.4rem; color: #003D40; }
        .plan-desc { font-size: 0.75rem; color: #94A3B8; margin: 5px 0 20px; font-weight: 500; }

        .credit-count { font-size: 3.5rem; font-weight: 800; color: #003D40; line-height: 1; }
        .credit-label { font-size: 0.65rem; font-weight: 700; color: #48A6A7; letter-spacing: 1px; margin-bottom: 20px; }
        .price-tag { font-size: 1.5rem; font-weight: 700; color: #333; margin-bottom: 25px; }

        .btn-buy { width: 100%; padding: 14px; background: #003D40; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; margin-top: auto; }
        .btn-buy:hover { background: #002D30; }
        .popular .btn-buy { background: #48A6A7; }
        .popular .btn-buy:hover { background: #003D40; }

        .pricing-footer { margin-top: 4rem; text-align: center; color: #94A3B8; font-size: 0.8rem; max-width: 600px; margin-left: auto; margin-right: auto; }
        .loader-box { height: 100vh; display: grid; place-items: center; font-weight: bold; color: #003D40; background: #F2F6F6; }
      `}</style>
    </AdminLayout>
  );
}