// components/AdminLayout.js
import { useRouter } from 'next/router';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import Head from 'next/head';

export default function AdminLayout({ children, activePage, user }) {
  const router = useRouter();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/admin/dashboard' },
    { id: 'users', label: 'Urus Pengguna', icon: '👥', path: '/admin/users' },
    { id: 'urus-kelas', label: 'Urus Kelas', icon: '🏫', path: '/admin/urus-kelas' },
    { id: 'trend', label: 'Analisis Trend', icon: '📈', path: '/admin/trend' },
    { id: 'semak', label: 'Semak Karangan', icon: '✍️', path: '/semak' },
  ];

  return (
    <div className="admin-container">
      <Head><title>Admin Master | SI-PINTAR</title></Head>
      
      <aside className="admin-sidebar">
        <div className="brand-header">
          <div className="logo-box">SP</div>
          <div className="brand-info">
            <h3>SI-PINTAR</h3>
            <span>MASTER CONSOLE</span>
          </div>
        </div>

        <nav className="nav-menu">
          <p className="nav-label">MENU UTAMA</p>
          {menuItems.map((item) => (
            <button 
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => router.push(item.path)}
            >
              <span className="icon">{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <p>{user?.username || 'Admin'}</p>
            <small>Kredit: {user?.credits || 0}</small>
          </div>
          <button className="btn-logout" onClick={() => signOut(auth).then(() => router.push('/'))}>
            Log Keluar
          </button>
        </div>
      </aside>

      <main className="admin-body">
        <div className="content-area">
          {children}
        </div>
      </main>

      <style jsx>{`
        .admin-container { display: flex; height: 100vh; background: #f4f7f6; overflow: hidden; }
        .admin-sidebar { width: 280px; background: #003032; color: white; padding: 25px; display: flex; flex-direction: column; }
        .brand-header { display: flex; gap: 12px; margin-bottom: 40px; }
        .logo-box { background: #ffd700; color: #003032; width: 40px; height: 40px; border-radius: 8px; display: grid; place-items: center; font-weight: 900; }
        .brand-info h3 { margin: 0; font-size: 1.2rem; letter-spacing: 1px; }
        .brand-info span { font-size: 0.7rem; color: #48a6a7; font-weight: 700; }

        .nav-menu { flex: 1; }
        .nav-label { font-size: 11px; color: #48a6a7; font-weight: 800; margin-bottom: 15px; }
        .nav-item { 
          width: 100%; text-align: left; background: none; border: none; color: #99afaf; 
          padding: 14px 15px; border-radius: 12px; cursor: pointer; margin-bottom: 8px; 
          display: flex; align-items: center; gap: 12px; transition: 0.2s; font-size: 0.95rem;
        }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: white; }
        .nav-item.active { background: #48a6a7; color: white; font-weight: 600; box-shadow: 0 4px 12px rgba(72, 166, 167, 0.3); }

        .admin-body { flex: 1; overflow-y: auto; padding: 40px; }
        .sidebar-footer { margin-top: auto; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); }
        .user-info { margin-bottom: 15px; }
        .user-info p { margin: 0; font-weight: 600; }
        .btn-logout { width: 100%; padding: 12px; background: #ff4d4d; border: none; border-radius: 10px; color: white; font-weight: bold; cursor: pointer; }
      `}</style>
    </div>
  );
}