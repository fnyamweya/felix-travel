import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client.js';
import { BookingStatusBadge } from '../components/BookingStatusBadge.js';
import { ChargeBreakdown } from '../components/ChargeBreakdown.js';

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(amount / 100);
}

export function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => apiClient.bookings.get(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="page">Loading…</div>;
  if (!booking) return <div className="page">Booking not found.</div>;

  const canPay = booking.status === 'pending_payment' || booking.status === 'quoted';

  return (
    <div className="page-narrow">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Booking #{booking.reference}</h1>
        <BookingStatusBadge status={booking.status} />
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-title">Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
          <div><span className="text-muted">Date</span><br /><strong>{booking.serviceDate}</strong></div>
          <div><span className="text-muted">Guests</span><br /><strong>{booking.guestCount}</strong></div>
          <div><span className="text-muted">Total</span><br /><strong>{formatMoney(booking.totalAmount, booking.currencyCode)}</strong></div>
          <div><span className="text-muted">Created</span><br /><strong>{new Date(booking.createdAt).toLocaleDateString()}</strong></div>
        </div>
      </div>

      {/* Charge breakdown — show if charges data available */}
      {booking.chargeBreakdown?.customer && (
        <ChargeBreakdown customer={booking.chargeBreakdown.customer} />
      )}

      {booking.status === 'pending_payment' || booking.status === 'quoted' ? (
        <div style={{ marginTop: '1.5rem' }}>
          <Link to={`/checkout/${booking.id}`}>
            <button className="btn-primary" style={{ width: '100%', padding: '0.75rem', fontWeight: 600 }}>
              Proceed to Payment
            </button>
          </Link>
        </div>
      ) : null}

      {booking.status === 'paid' || booking.status === 'confirmed' ? (
        <div style={{ marginTop: '1rem' }}>
          <button className="btn-secondary" style={{ width: '100%' }}>Request Refund</button>
        </div>
      ) : null}
    </div>
  );
}
