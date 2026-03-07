/**
 * Tingg API wire-format types.
 * These represent exact request/response shapes from Tingg's API.
 * Internal application types live in their respective domain modules.
 */

// ----------------------------------------------------------------
// Auth
// ----------------------------------------------------------------
export interface TinggAuthRequest {
  grant_type: 'client_credentials';
  client_id: string;
  client_secret: string;
}

export interface TinggAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// ----------------------------------------------------------------
// Collections — Checkout
// ----------------------------------------------------------------
export interface TinggCheckoutRequest {
  merchantTransactionID: string;
  requestAmount: number;
  currencyCode: string;
  accountNumber: string;
  serviceCode: string;
  callbackURL: string;
  successRedirectURL: string;
  failRedirectURL: string;
  countryCode: string;
  languageCode?: string;
  requestDescription?: string;
  payerClientCode?: string;
  MSISDN?: string;
  paymentOptions?: string;
  noOfRetries?: number;
  pendingRedirectURL?: string;
}

export interface TinggCheckoutResponse {
  results: {
    checkoutRequestID: string;
    merchantTransactionID: string;
    requestStatus: string;
    requestStatusCode: string;
    requestStatusDescription: string;
    checkoutURL?: string;
    ussdPushRequestID?: string;
  };
}

export interface TinggChargeRequest {
  checkoutRequestID: string;
  merchantTransactionID: string;
  amount: number;
  currencyCode: string;
  serviceCode: string;
  accountNumber: string;
  MSISDN: string;
  paymentOption: string;
  callbackURL: string;
}

export interface TinggChargeResponse {
  results: {
    checkoutRequestID: string;
    merchantTransactionID: string;
    requestStatus: string;
    requestStatusCode: string;
    requestStatusDescription: string;
    chargeRequestID?: string;
  };
}

export interface TinggValidateChargeRequest {
  chargeRequestID: string;
  OTP: string;
}

export interface TinggQueryStatusRequest {
  checkoutRequestID: string;
  serviceCode: string;
}

export interface TinggQueryStatusResponse {
  results: {
    checkoutRequestID: string;
    merchantTransactionID: string;
    requestStatus: string;
    requestStatusCode: string;
    requestStatusDescription: string;
    paidAmount?: number;
    payerTransactionID?: string;
    paymentOption?: string;
    paidDate?: string;
  };
}

export interface TinggAcknowledgeRequest {
  checkoutRequestID: string;
  serviceCode: string;
}

export interface TinggRefundRequest {
  checkoutRequestID: string;
  merchantTransactionID: string;
  amount: number;
  currencyCode: string;
  serviceCode: string;
  callbackURL: string;
  reason?: string;
}

export interface TinggRefundResponse {
  results: {
    refundRequestID: string;
    merchantTransactionID: string;
    requestStatus: string;
    requestStatusCode: string;
    requestStatusDescription: string;
  };
}

export interface TinggOtpRequest {
  MSISDN: string;
  serviceCode: string;
  paymentOption: string;
}

export interface TinggOtpResponse {
  results: {
    requestStatus: string;
    requestStatusCode: string;
    requestStatusDescription: string;
  };
}

export interface TinggOtpValidateRequest {
  MSISDN: string;
  OTP: string;
  serviceCode: string;
}

// ----------------------------------------------------------------
// Payouts
// ----------------------------------------------------------------
export interface TinggNetworkLookupRequest {
  MSISDN: string;
  countryCode: string;
}

export interface TinggNetworkLookupResponse {
  results: {
    MSISDN: string;
    network: string;
    networkCode: string;
    countryCode: string;
    requestStatus: string;
    requestStatusCode: string;
    requestStatusDescription: string;
  };
}

export interface TinggLocalPayoutRequest {
  merchantRef: string;
  serviceCode: string;
  amount: number;
  currencyCode: string;
  creditPartyIdentifier: string;
  creditPartyNetwork: string;
  countryCode: string;
  callbackURL: string;
  narration?: string;
  creditPartyName?: string;
}

export interface TinggLocalPayoutResponse {
  results: {
    paymentRef: string;
    merchantRef: string;
    requestStatus: string;
    requestStatusCode: string;
    requestStatusDescription: string;
    transactionRef?: string;
  };
}

export interface TinggPayoutStatusRequest {
  paymentRef: string;
  serviceCode: string;
}

export interface TinggPayoutStatusResponse {
  results: {
    paymentRef: string;
    merchantRef: string;
    requestStatus: string;
    requestStatusCode: string;
    requestStatusDescription: string;
    transactionRef?: string;
    settledDate?: string;
  };
}

export interface TinggFloatBalanceResponse {
  results: {
    serviceCode: string;
    availableBalance: number;
    currencyCode: string;
    requestStatus: string;
  };
}

export interface TinggRemittanceAccountValidationRequest {
  beneficiaryAccount: string;
  beneficiaryBankCode: string;
  countryCode: string;
  serviceCode: string;
}

export interface TinggRemittanceAccountValidationResponse {
  results: {
    beneficiaryAccount: string;
    beneficiaryName: string | null;
    requestStatus: string;
    requestStatusCode: string;
    requestStatusDescription: string;
  };
}

export interface TinggRemittanceRequest {
  merchantRef: string;
  serviceCode: string;
  amount: number;
  sourceCurrencyCode: string;
  destinationCurrencyCode: string;
  beneficiaryAccount: string;
  beneficiaryBankCode: string;
  countryCode: string;
  callbackURL: string;
  narration?: string;
  beneficiaryName?: string;
  beneficiaryAddress?: string;
  purposeOfPayment?: string;
}

export interface TinggRemittanceResponse {
  results: {
    paymentRef: string;
    merchantRef: string;
    requestStatus: string;
    requestStatusCode: string;
    requestStatusDescription: string;
    fxRate?: number;
    destinationAmount?: number;
  };
}

export interface TinggRemittanceStatusRequest {
  paymentRef: string;
  serviceCode: string;
}

// ----------------------------------------------------------------
// Status codes
// ----------------------------------------------------------------
export type TinggRequestStatus =
  | 'SUCCESS'
  | 'PENDING'
  | 'FAILED'
  | 'REVERSED'
  | 'REFUNDED'
  | 'PROCESSING'
  | 'CANCELLED';
