import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context.js';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div>
      <header style={{ background: 'white', borderBottom: '1px solid #ebecf0', padding: '0 2rem' }}>
        <nav style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <Link to="/" style={{ fontWeight: 700, fontSize: '1.125rem', color: '#172b4d', textDecoration: 'none' }}>
            ✈ Felix Travel
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.875rem' }}>
            <Link to="/search">Explore</Link>
            {user ? (
              <>
                <Link to="/bookings">My Bookings</Link>
                <Link to="/account" style={{ fontWeight: 600 }}>{user.firstName}</Link>
                <button onClick={handleLogout} className="btn-secondary" style={{ padding: '6px 12px' }}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login">Sign in</Link>
                <Link to="/register"><button className="btn-primary" style={{ padding: '6px 12px' }}>Sign up</button></Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer style={{ borderTop: '1px solid #ebecf0', padding: '2rem', textAlign: 'center', color: '#5e6c84', fontSize: '0.875rem', marginTop: '4rem' }}>
        © {new Date().getFullYear()} Felix Travel. All rights reserved.
      </footer>
    </div>
  );
}
