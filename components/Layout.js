import Link from 'next/link';
import { useRouter } from 'next/router';
import { getAuth, signOut } from 'firebase/auth';
import { useState } from 'react';

export default function Layout({ children, pageTitle }) {
  const router = useRouter();
  const auth = getAuth();
  const [loadingLogout, setLoadingLogout] = useState(false);

  const navItems = [
    { label: 'Dashboard', href: '/' },
    { label: 'Semak Karangan', href: '/semak' },
    // Add more links as needed
  ];

  const handleLogout = async () => {
    setLoadingLogout(true);
    await signOut(auth);
    router.push('/login');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Sidebar */}
      <nav
        style={{
          width: 220,
          backgroundColor: '#fff',
          borderRight: '1px solid #ddd',
          padding: '20px 10px',
          boxSizing: 'border-box',
        }}
      >
        <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: 30, textAlign: 'center' }}>
          SemakKarangan
        </h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {navItems.map(({ label, href }) => {
            const active = router.pathname === href;
            return (
              <li key={href} style={{ marginBottom: 15 }}>
                <Link href={href} legacyBehavior>
                  <a
                    style={{
                      color: active ? '#000' : '#555',
                      fontWeight: active ? '600' : '400',
                      textDecoration: 'none',
                      padding: '8px 12px',
                      display: 'block',
                      borderLeft: active ? '4px solid #000' : '4px solid transparent',
                      transition: 'all 0.2s ease',
                      borderRadius: '0 4px 4px 0',
                    }}
                  >
                    {label}
                  </a>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Main content + Topbar */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            height: 60,
            backgroundColor: '#f9f9f9',
            borderBottom: '1px solid #ddd',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>{pageTitle}</h1>
          <button
            onClick={handleLogout}
            disabled={loadingLogout}
            style={{
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '8px 14px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#333')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#000')}
          >
            {loadingLogout ? 'Logging out...' : 'Logout'}
          </button>
        </header>

        <main style={{ padding: 20, overflowY: 'auto', height: 'calc(100vh - 60px)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
