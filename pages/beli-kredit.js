import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const plans = [
  {
    id: 'price_1RkLm9JtYEymv1ohW2UsdXwW',
    name: 'Lite',
    credits: 10,
    price: 3.90,
  },
  {
    id: 'price_1RkLm8JtYEymv1ohQZWw37UY',
    name: 'Standard',
    credits: 40,
    price: 9.90,
  },
  {
    id: 'price_1RkLm8JtYEymv1ohHqKogD7L',
    name: 'Premium',
    credits: 80,
    price: 15.90,
  },
  {
    id: 'price_1RkLm8JtYEymv1ohv4vPnbJb',
    name: 'Bulk',
    credits: 160,
    price: 29.90,
  },
  {
    id: 'price_1RkLm8JtYEymv1ohApMLRNwh',
    name: 'School Pack',
    credits: 500,
    price: 79.90,
  },
];

export default function BeliKredit() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace('/');
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

 const handleCheckout = async (priceId) => {
  const plan = plans.find(p => p.id === priceId);
  if (!plan || !user) return;

  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      priceId: plan.id,
      uid: user.uid,
      credits: plan.credits,  // Pass credits here
    }),
  });

  const data = await res.json();
  if (data.url) {
    window.location.href = data.url;
  }
};

  if (loading) return <p>Loading...</p>;

  return (
    <div className="page">
      <header className="nav">
        <ul>
          <li><a href="/dashboard">Dashboard</a></li>
          <li><a href="/semak">Semak Karangan</a></li>
          <li><a href="/profile">Profil</a></li>
          <li><a href="/beli-kredit">Beli Kredit</a></li>
        </ul>
      </header>

      <main className="container">
        <section className="intro">
          <h1 className="title">
            Beli <span>Kredit</span> <span className="dot">.ai</span>
          </h1>
          <p className="subtitle">
            Pilih pelan yang sesuai dan tambah kredit untuk menggunakan sistem semak karangan AI anda dengan lebih lancar dan efisien.
          </p>
        </section>

        <section className="plans">
          {plans.map(plan => (
            <div key={plan.id} className="plan-card">
              <h3>{plan.name}</h3>
              <p className="credits"><strong>{plan.credits}</strong> kredit</p>
              <p className="price"><strong>${plan.price.toFixed(2)}</strong></p>
              <button onClick={() => handleCheckout(plan.id)}>Beli Sekarang</button>
            </div>
          ))}
        </section>
      </main>

      <style jsx>{`
        .page {
          font-family: 'Poppins', sans-serif;
          background: #F2EFE7;
          color: #006A71;
          min-height: 100vh;
          padding-bottom: 4rem;
        }
        .nav {
          position: fixed;
          top: 24px;
          right: 40px;
          z-index: 100;
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
          color: #006A71;
          transition: color 0.3s;
        }
        .nav ul li a:hover {
          color: #48A6A7;
        }
        .container {
          max-width: 1080px;
          margin: 0 auto;
          padding: 6rem 2rem 2rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .intro {
          margin-bottom: 3rem;
        }
        .title {
          font-size: 3.5rem;
          font-weight: 800;
          color: #006A71;
        }
        .title span {
          display: inline;
        }
        .dot {
          color: #48A6A7;
        }
        .subtitle {
          font-size: 1.25rem;
          color: #444;
          max-width: 600px;
          margin: 1rem auto 0;
          line-height: 1.5;
        }
        .plans {
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
          justify-content: center;
          width: 100%;
        }
        .plan-card {
          background: #ffffffcc;
          border-radius: 20px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
          padding: 2rem 1.5rem;
          width: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: transform 0.3s ease;
          cursor: pointer;
        }
        .plan-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.15);
        }
        .plan-card h3 {
          margin-bottom: 0.5rem;
          font-size: 1.8rem;
          color: #006A71;
        }
        .credits {
          font-size: 1.2rem;
          margin: 0.25rem 0;
          color: #444;
        }
        .price {
          font-size: 1.6rem;
          margin: 0.25rem 0 1rem 0;
          color: #48A6A7;
          font-weight: 700;
        }
        .plan-card button {
          background: #48A6A7;
          border: none;
          border-radius: 12px;
          padding: 0.75rem 1.5rem;
          color: white;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: background-color 0.3s ease;
          width: 100%;
        }
        .plan-card button:hover {
          background: #369191;
        }

        @media (max-width: 768px) {
          .title {
            font-size: 2.8rem;
          }
          .plans {
            gap: 1rem;
          }
          .plan-card {
            width: 140px;
            padding: 1.5rem 1rem;
          }
        }

        @media (max-width: 480px) {
          .container {
            padding: 4rem 1rem 2rem 1rem;
          }
          .title {
            font-size: 2.2rem;
          }
          .subtitle {
            font-size: 1rem;
          }
          .plan-card {
            width: 100%;
            max-width: 280px;
            margin: 0 auto;
          }
        }
      `}</style>
    </div>
  );
}
