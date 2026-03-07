import React from 'react';
import { useNavigate } from 'react-router-dom';

export function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0052cc 0%, #0041a3 100%)', color: 'white', padding: '5rem 1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '1rem' }}>
          Unforgettable African Adventures
        </h1>
        <p style={{ fontSize: '1.125rem', opacity: 0.9, maxWidth: 500, margin: '0 auto 2rem' }}>
          Discover handpicked tours, safaris, and experiences across Africa.
        </p>
        <form onSubmit={handleSearch} style={{ display: 'flex', maxWidth: 480, margin: '0 auto', gap: '0.5rem' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search destinations, activities…"
            style={{ flex: 1, border: 'none', fontSize: '1rem', padding: '0.75rem 1rem' }}
          />
          <button type="submit" className="btn-primary" style={{ padding: '0.75rem 1.5rem', fontWeight: 600 }}>
            Search
          </button>
        </form>
      </div>

      {/* Categories */}
      <div className="page">
        <h2 className="section-title">Browse by Experience</h2>
        <div className="grid-4">
          {[
            { icon: '🦁', label: 'Safari', q: 'safari' },
            { icon: '🏖️', label: 'Beach', q: 'beach' },
            { icon: '🏔️', label: 'Hiking', q: 'hiking' },
            { icon: '🏙️', label: 'City Tours', q: 'city' },
          ].map((cat) => (
            <div
              key={cat.q}
              className="card"
              onClick={() => navigate(`/search?q=${cat.q}`)}
              style={{ textAlign: 'center', cursor: 'pointer', padding: '2rem 1rem' }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{cat.icon}</div>
              <div style={{ fontWeight: 600 }}>{cat.label}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginTop: '4rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
            Ready to explore?
          </h2>
          <button className="btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }} onClick={() => navigate('/search')}>
            View All Tours
          </button>
        </div>
      </div>
    </div>
  );
}
