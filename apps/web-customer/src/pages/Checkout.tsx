import { type FormEvent, useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client.js';
import { useAuth } from '../lib/auth-context.js';

/* ── helpers ──────────────────────────────────────────────── */

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(amount / 100);
}

const PAYMENT_METHODS = [
  { code: 'MPESA_KE', label: 'M-Pesa', needsPhone: true },
  { code: 'AIRTEL_KE', label: 'Airtel Money', needsPhone: true },
  { code: 'CARD', label: 'Card', needsPhone: false },
] as const;

type MethodCode = (typeof PAYMENT_METHODS)[number]['code'];

interface SplitLine {
  id: string;
  method: MethodCode;
  amount: string; // user-entered display amount (in major units)
  accountNumber: string;
}

/* ── component ────────────────────────────────────────────── */

export function CheckoutPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState('');
  const creatingRef = useRef(false);

  // payment mode
  const [mode, setMode] = useState<'single' | 'split'>('single');

  // single-pay state
  const [singleMethod, setSingleMethod] = useState<MethodCode>('MPESA_KE');
  const [singleAccount, setSingleAccount] = useState('');

  // split-pay state
  const [splits, setSplits] = useState<SplitLine[]>(() => [
    { id: crypto.randomUUID(), method: 'MPESA_KE', amount: '', accountNumber: '' },
    { id: crypto.randomUUID(), method: 'CARD', amount: '', accountNumber: '' },
  ]);

  const isNew = bookingId === 'new';

  /* ── draft booking creation (unchanged) ─── */
  useEffect(() => {
    if (!isNew || creatingRef.current || !user) return;
    creatingRef.current = true;

    const listingId = searchParams.get('listingId');
    const date = searchParams.get('date');
    const guests = Number(searchParams.get('guests')) || 1;

    if (!listingId || !date) {
      setError('Missing listing or date information.');
      return;
    }

    (async () => {
      try {
        const draft = await apiClient.bookings.createDraft({
          listingId,
          serviceDate: date,
          guestCount: guests,
          travelers: [{ firstName: user.firstName || 'Guest', lastName: user.lastName || 'Traveler', isPrimary: true }],
        });
        const confirmed = await apiClient.bookings.confirm(draft.id, crypto.randomUUID());
        navigate(`/checkout/${confirmed.id}`, { replace: true });
      } catch (err: any) {
        setError(err?.message ?? 'Failed to create booking. Please try again.');
        creatingRef.current = false;
      }
    })();
  }, [isNew, user, searchParams, navigate]);

  const { data: booking } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => apiClient.bookings.get(bookingId!),
    enabled: !!bookingId && !isNew,
  });

  /* ── single checkout mutation ──────────── */
  const singleMutation = useMutation({
    mutationFn: (data: { bookingId: string; MSISDN?: string; accountNumber: string; paymentOptionCode: string }) =>
      apiClient.payments.initiateCheckout(data, crypto.randomUUID()),
    onSuccess: (result) => {
      if (result.checkoutUrl) window.location.href = result.checkoutUrl;
      else navigate(`/payment-status/${result.id}`);
    },
    onError: (err: any) => setError(err?.message ?? 'Payment initiation failed.'),
  });

  /* ── split checkout mutation ───────────── */
  const splitMutation = useMutation({
    mutationFn: (data: Parameters<typeof apiClient.payments.initiateSplitCheckout>[0]) =>
      apiClient.payments.initiateSplitCheckout(data, crypto.randomUUID()),
    onSuccess: (result) => {
      // redirect to first split that has a checkout URL, else go to status
      const withUrl = result.splits.find((s) => s.checkoutURL);
      if (withUrl?.checkoutURL) window.location.href = withUrl.checkoutURL;
      else navigate(`/payment-status/${result.paymentId}`);
    },
    onError: (err: any) => setError(err?.message ?? 'Split payment initiation failed.'),
  });

  const isPending = singleMutation.isPending || splitMutation.isPending;

  /* ── split helpers ─────────────────────── */
  const updateSplit = useCallback((id: string, patch: Partial<SplitLine>) => {
    setSplits((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const removeSplit = useCallback((id: string) => {
    setSplits((prev) => (prev.length <= 2 ? prev : prev.filter((s) => s.id !== id)));
  }, []);

  const addSplit = useCallback(() => {
    setSplits((prev) => [...prev, { id: crypto.randomUUID(), method: 'MPESA_KE', amount: '', accountNumber: '' }]);
  }, []);

  const splitTotal = splits.reduce((sum, s) => sum + (Math.round(Number(s.amount) * 100) || 0), 0);
  const bookingTotal = booking?.totalAmount ?? 0;
  const splitBalanced = splitTotal === bookingTotal;

  /* ── submit ────────────────────────────── */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setError('');

    if (mode === 'single') {
      const methodDef = PAYMENT_METHODS.find((m) => m.code === singleMethod)!;
      singleMutation.mutate({
        bookingId: booking.id,
        ...(methodDef.needsPhone ? { MSISDN: singleAccount } : {}),
        accountNumber: singleAccount,
        paymentOptionCode: singleMethod,
      });
    } else {
      if (!splitBalanced) {
        setError(`Split amounts must equal ${formatMoney(bookingTotal, booking.currencyCode)}.`);
        return;
      }
      splitMutation.mutate({
        bookingId: booking.id,
        splits: splits.map((s) => {
          const methodDef = PAYMENT_METHODS.find((m) => m.code === s.method)!;
          return {
            method: s.method,
            amount: Math.round(Number(s.amount) * 100),
            accountNumber: s.accountNumber,
            ...(methodDef.needsPhone ? { MSISDN: s.accountNumber } : {}),
            paymentOptionCode: s.method,
          };
        }),
      });
    }
  };

  /* ── render ────────────────────────────── */
  if (!booking)
    return (
      <div className="page">
        {error ? <div className="alert-error">{error}</div> : 'Loading checkout…'}
      </div>
    );

  const currency = booking.currencyCode;

  return (
    <div className="page-narrow">
      <h1 className="page-title">Complete Payment</h1>

      {/* order summary */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">Order Summary</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          <span>Booking #{booking.reference}</span>
          <span>{booking.serviceDate}</span>
        </div>
        <hr className="divider" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <span>Total</span>
          <span>{formatMoney(bookingTotal, currency)}</span>
        </div>
      </div>

      {/* mode selector */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className={mode === 'single' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1, padding: '0.5rem' }}
            onClick={() => setMode('single')}
          >
            Pay in full
          </button>
          <button
            type="button"
            className={mode === 'split' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1, padding: '0.5rem' }}
            onClick={() => setMode('split')}
          >
            Split payment
          </button>
        </div>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        {mode === 'single' ? (
          /* ── single payment ──────────── */
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="section-title">Payment Method</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.code}
                  type="button"
                  className={singleMethod === m.code ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
                  onClick={() => setSingleMethod(m.code)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>
                {PAYMENT_METHODS.find((m) => m.code === singleMethod)?.needsPhone
                  ? 'Phone Number'
                  : 'Account / Email'}
              </label>
              <input
                type={PAYMENT_METHODS.find((m) => m.code === singleMethod)?.needsPhone ? 'tel' : 'text'}
                value={singleAccount}
                onChange={(e) => setSingleAccount(e.target.value)}
                placeholder={
                  PAYMENT_METHODS.find((m) => m.code === singleMethod)?.needsPhone
                    ? 'e.g. 0712345678'
                    : 'e.g. email@example.com'
                }
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={isPending} style={{ padding: '0.75rem', fontWeight: 600 }}>
              {isPending ? 'Processing…' : `Pay ${formatMoney(bookingTotal, currency)}`}
            </button>
          </div>
        ) : (
          /* ── split payment ───────────── */
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="section-title">Split Payment</div>
            <p style={{ fontSize: '0.8125rem', color: '#5e6c84', margin: 0 }}>
              Divide the total across multiple payment methods.
            </p>

            {splits.map((split, idx) => (
              <div
                key={split.id}
                style={{
                  border: '1px solid #dfe1e6',
                  borderRadius: 8,
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Split {idx + 1}</span>
                  {splits.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeSplit(split.id)}
                      style={{ fontSize: '0.75rem', color: '#de350b', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.code}
                      type="button"
                      className={split.method === m.code ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                      onClick={() => updateSplit(split.id, { method: m.code })}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: 2 }}>
                      Amount ({currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={split.amount}
                      onChange={(e) => updateSplit(split.id, { amount: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: 2 }}>
                      {PAYMENT_METHODS.find((m) => m.code === split.method)?.needsPhone
                        ? 'Phone'
                        : 'Account'}
                    </label>
                    <input
                      type={PAYMENT_METHODS.find((m) => m.code === split.method)?.needsPhone ? 'tel' : 'text'}
                      value={split.accountNumber}
                      onChange={(e) => updateSplit(split.id, { accountNumber: e.target.value })}
                      placeholder={
                        PAYMENT_METHODS.find((m) => m.code === split.method)?.needsPhone
                          ? '0712345678'
                          : 'email@example.com'
                      }
                      required
                    />
                  </div>
                </div>
              </div>
            ))}

            <button type="button" className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.8125rem' }} onClick={addSplit}>
              + Add split
            </button>

            {/* running total */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: splitBalanced ? '#006644' : '#de350b',
              }}
            >
              <span>Split total</span>
              <span>
                {formatMoney(splitTotal, currency)} / {formatMoney(bookingTotal, currency)}
              </span>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={isPending || !splitBalanced}
              style={{ padding: '0.75rem', fontWeight: 600 }}
            >
              {isPending ? 'Processing…' : `Pay ${formatMoney(bookingTotal, currency)}`}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
