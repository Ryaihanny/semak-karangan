import { useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/AdminLayout';

export default function PaymentSuccess() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard after 5 seconds
    const timer = setTimeout(() => {
      router.push('/dashboard');
    }, 5000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <AdminLayout activePage="beli-kredit">
      <div className="success-container">
        <div className="success-card">
          <div className="icon-circle">
            <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          
          <h1>Pembayaran Berjaya!</h1>
          <p>Terima kasih. Kredit anda sedang dikemas kini secara automatik.</p>
          
          <div className="status-box">
            <div className="pulse"></div>
            <span>Mengalihkan anda ke Dashboard...</span>
          </div>

          <button className="btn-return" onClick={() => router.push('/dashboard')}>
            Kembali ke Dashboard Sekarang
          </button>
        </div>
      </div>

      <style jsx>{`
        .success-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 70vh;
        }

        .success-card {
          background: white;
          padding: 3.5rem 2rem;
          border-radius: 24px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.05);
          border: 1px solid #E2E8F0;
          text-align: center;
          max-width: 500px;
          width: 100%;
        }

        .icon-circle {
          width: 80px;
          height: 80px;
          background: #48A6A7;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
          box-shadow: 0 4px 15px rgba(72, 166, 167, 0.4);
        }

        h1 {
          color: #003D40;
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        p {
          color: #64748B;
          font-size: 1.1rem;
          line-height: 1.5;
          margin-bottom: 2rem;
        }

        .status-box {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: #F8FAFC;
          padding: 12px;
          border-radius: 12px;
          margin-bottom: 2rem;
          font-size: 0.9rem;
          color: #48A6A7;
          font-weight: 600;
        }

        .pulse {
          width: 8px;
          height: 8px;
          background: #48A6A7;
          border-radius: 50%;
          animation: pulse-animation 1.5s infinite;
        }

        @keyframes pulse-animation {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(72, 166, 167, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(72, 166, 167, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(72, 166, 167, 0); }
        }

        .btn-return {
          background: #003D40;
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s;
        }

        .btn-return:hover {
          background: #002D30;
          transform: translateY(-2px);
        }
      `}</style>
    </AdminLayout>
  );
}