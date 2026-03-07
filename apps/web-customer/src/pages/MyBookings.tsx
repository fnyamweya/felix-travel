import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client.js';
import { BookingStatusBadge } from '../components/BookingStatusBadge.js';

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(amount / 100);
}

export function MyBookingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => apiClient.bookings.list(),
  });

  if (isLoading) return <div className="page">Loading bookings…</div>;

  const bookings = data ?? [];

  return (
    <div className="page">
      <h1 className="page-title">My Bookings</h1>
      {bookings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#5e6c84' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
          <p>No bookings yet. <Link to="/search">Start exploring.</Link></p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {bookings.map((booking: any) => (
            <Link key={booking.id} to={`/bookings/${booking.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card flex justify-between items-center" style={{ cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Booking #{booking.reference}</div>
                  <div style={{ color: '#5e6c84', fontSize: '0.875rem' }}>{booking.serviceDate}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>{formatMoney(booking.totalAmount, booking.currencyCode)}</div>
                  <div className="mt-2"><BookingStatusBadge status={booking.status} /></div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
