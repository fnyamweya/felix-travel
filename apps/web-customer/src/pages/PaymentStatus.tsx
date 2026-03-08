import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client.js';

export function PaymentStatusPage() {
  const { paymentId } = useParams<{ paymentId: string }>();

  const { data: payment } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => apiClient.payments.getStatus(paymentId!),
    enabled: !!paymentId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'succeeded' || status === 'failed' || status === 'refunded') return false;
      return 3_000; // poll every 3s
    },
  });

  const status = payment?.status;
  const isFinal = status === 'succeeded' || status === 'failed';

  return (
    <div className="page-narrow" style={{ textAlign: 'center', paddingTop: '4rem' }}>
      {!isFinal && (
        <>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Processing Payment</h1>
          <p className="text-muted">Please check your phone to confirm the M-Pesa prompt. This page updates automatically.</p>
        </>
      )}

      {status === 'succeeded' && (
        <>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#006644' }}>Payment Successful!</h1>
          <p className="text-muted" style={{ marginBottom: '2rem' }}>Your booking is confirmed. Check your email for details.</p>
          <Link to="/bookings"><button className="btn-primary">View My Bookings</button></Link>
        </>
      )}

      {status === 'failed' && (
        <>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#de350b' }}>Payment Failed</h1>
          <p className="text-muted" style={{ marginBottom: '2rem' }}>Your payment could not be processed. No charge was made.</p>
          <Link to="/bookings"><button className="btn-secondary">Back to Bookings</button></Link>
        </>
      )}
    </div>
  );
}
