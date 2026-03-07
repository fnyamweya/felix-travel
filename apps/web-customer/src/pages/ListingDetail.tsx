import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client.js';
import { useAuth } from '../lib/auth-context.js';

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(amount / 100);
}

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [guests, setGuests] = useState(1);
  const [date, setDate] = useState('');

  const { data: listing, isLoading } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => apiClient.catalog.getListing(id!),
    enabled: !!id,
  });

  const handleBook = () => {
    if (!user) { navigate('/login'); return; }
    if (!date) { alert('Please select a date'); return; }
    navigate(`/checkout/new?listingId=${id}&date=${date}&guests=${guests}`);
  };

  if (isLoading) return <div className="page">Loading…</div>;
  if (!listing) return <div className="page">Listing not found.</div>;

  const price = listing.basePrice ?? 0;
  const total = price * guests;

  return (
    <div className="page">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem', alignItems: 'start' }}>
        {/* Main content */}
        <div>
          <div style={{ background: '#ebecf0', height: 360, borderRadius: 8, marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem' }}>
            🌍
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>{listing.title}</h1>
          <p style={{ color: '#5e6c84', marginBottom: '1.5rem' }}>{listing.location}</p>
          <div style={{ lineHeight: 1.7 }}>{listing.description ?? 'Experience the wonder of Africa with our expertly guided tour.'}</div>
        </div>

        {/* Booking card */}
        <div className="card" style={{ position: 'sticky', top: '1rem' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem', color: '#0052cc' }}>
            {formatMoney(price, listing.currencyCode ?? 'KES')}
            <span style={{ fontWeight: 400, fontSize: '0.875rem', color: '#5e6c84' }}> / person</span>
          </div>
          <hr className="divider" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Guests</label>
              <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.875rem' }}>
            <span>{formatMoney(price, listing.currencyCode ?? 'KES')} × {guests}</span>
            <strong>{formatMoney(total, listing.currencyCode ?? 'KES')}</strong>
          </div>
          <button className="btn-primary" onClick={handleBook} style={{ width: '100%', padding: '0.75rem', fontWeight: 600 }}>
            Book Now
          </button>
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#5e6c84', marginTop: '0.5rem' }}>
            No charge until confirmed
          </p>
        </div>
      </div>
    </div>
  );
}
