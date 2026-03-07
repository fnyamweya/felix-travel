import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client.js';

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(amount / 100);
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['listings', q],
    queryFn: () => apiClient.catalog.search({ q, limit: 24 }),
  });

  return (
    <div className="page">
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          defaultValue={q}
          placeholder="Search tours, safaris, activities…"
          onChange={(e) => setSearchParams({ q: e.target.value })}
          style={{ maxWidth: 400 }}
        />
      </div>

      {q && <h2 className="page-title">Results for "{q}"</h2>}

      {isLoading && <div>Searching…</div>}

      {data && data.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#5e6c84' }}>
          No tours found. Try a different search.
        </div>
      )}

      <div className="grid-3">
        {(data ?? []).map((listing: any) => (
          <Link key={listing.id} to={`/listings/${listing.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}>
              <div style={{ background: '#ebecf0', height: 160, borderRadius: 4, marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                {listing.category === 'safari' ? '🦁' : listing.category === 'beach' ? '🏖️' : listing.category === 'hiking' ? '🏔️' : '🌍'}
              </div>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{listing.title}</div>
              <div style={{ color: '#5e6c84', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{listing.location ?? listing.providerId}</div>
              <div style={{ fontWeight: 700, color: '#0052cc', fontSize: '1.125rem' }}>
                {formatMoney(listing.basePrice ?? 0, listing.currencyCode ?? 'KES')}
                <span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#5e6c84' }}> / person</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
