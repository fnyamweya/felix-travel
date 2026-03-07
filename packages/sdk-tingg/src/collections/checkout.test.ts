import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TinggCheckoutAdapter } from './checkout.js';
import type { TinggHttpClient } from '../http-client.js';

describe('TinggCheckoutAdapter', () => {
  let httpMock: { post: ReturnType<typeof vi.fn> };
  let adapter: TinggCheckoutAdapter;

  beforeEach(() => {
    httpMock = { post: vi.fn() };
    adapter = new TinggCheckoutAdapter(httpMock as unknown as TinggHttpClient);
  });

  it('calls /checkout/initiate with correct payload', async () => {
    httpMock.post.mockResolvedValue({
      results: {
        checkoutRequestID: 'CHK-001',
        merchantTransactionID: 'MTX-001',
        requestStatus: 'SUCCESS',
        requestStatusCode: '178',
        requestStatusDescription: 'Success',
        checkoutURL: 'https://pay.tingg.africa/checkout/CHK-001',
      },
    });

    const payload = {
      merchantTransactionID: 'MTX-001',
      requestAmount: 100,
      currencyCode: 'KES',
      accountNumber: '254700000001',
      serviceCode: 'TEST',
      callbackURL: 'https://api.test.com/webhooks/tingg/checkout',
      successRedirectURL: 'https://test.com/success',
      failRedirectURL: 'https://test.com/fail',
      countryCode: 'KE',
    };

    const result = await adapter.initiateCheckout(payload, { correlationId: 'corr-001' });
    expect(httpMock.post).toHaveBeenCalledWith('/checkout/initiate', payload, { correlationId: 'corr-001' });
    expect(result.results.checkoutRequestID).toBe('CHK-001');
  });

  it('calls /checkout/query-status with correct payload', async () => {
    httpMock.post.mockResolvedValue({
      results: {
        checkoutRequestID: 'CHK-001',
        merchantTransactionID: 'MTX-001',
        requestStatus: 'PENDING',
        requestStatusCode: '188',
        requestStatusDescription: 'Pending customer action',
      },
    });

    const result = await adapter.queryStatus(
      { checkoutRequestID: 'CHK-001', serviceCode: 'TEST' },
      { correlationId: 'corr-002' }
    );
    expect(result.results.requestStatusCode).toBe('188');
  });
});
