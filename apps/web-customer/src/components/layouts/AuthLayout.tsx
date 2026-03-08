import { Outlet, Link } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7', padding: '1rem' }}>
      <Link to="/" style={{ fontWeight: 700, fontSize: '1.25rem', color: '#172b4d', textDecoration: 'none', marginBottom: '2rem' }}>
        ✈ Felix Travel
      </Link>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <Outlet />
      </div>
    </div>
  );
}
