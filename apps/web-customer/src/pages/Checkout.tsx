import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client.js';

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(amount / 100);
}

export function CheckoutPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const { data: booking } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => apiClient.bookings.get(bookingId!),
    enabled: !!bookingId && bookingId !== 'new',
  });

  const checkoutMutation = useMutation({
    mutationFn: (data: { bookingId: string; MSISDN: string; accountNumber: string }) =>
      apiClient.payments.initiateCheckout(data),
    onSuccess: (result) => {
      if (result.checkoutURL) {
        window.location.href = result.checkoutURL;
      } else {
        navigate(`/payment-status/${result.paymentId}`);
      }
    },
    onError: (err: any) => {
      setError(err?.message ?? 'Payment initiation failed. Please try again.');
    },
  });

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setError('');
    checkoutMutation.mutate({
      bookingId: booking.id,
      MSISDN: phone,
      accountNumber: phone,
    });
  };

  if (!booking) return <div className="page">Loading checkout…</div>;

  return (
    <div className="page-narrow">
      <h1 className="page-title">Complete Payment</h1>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">Order Summary</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          <span>Booking #{booking.reference}</span>
          <span>{booking.serviceDate}</span>
        </div>
        <hr className="divider" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <span>Total</span>
          <span>{formatMoney(booking.totalAmount, booking.currencyCode)}</span>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Pay via M-Pesa</div>
        {error && <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>
              M-Pesa Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0712345678"
              required
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={checkoutMutation.isPending}
            style={{ padding: '0.75rem', fontWeight: 600 }}
          >
            {checkoutMutation.isPending ? 'Processing…' : `Pay ${formatMoney(booking.totalAmount, booking.currencyCode)}`}
          </button>
          <p style={{ fontSize: '0.75rem', color: '#5e6c84', textAlign: 'center' }}>
            You will receive an STK push on your phone to confirm payment.
          </p>
        </form>
      </div>
    </div>
  );
}
