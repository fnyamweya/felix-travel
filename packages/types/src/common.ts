/** Generic API success response envelope */
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/** Generic API error response envelope */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** ISO 8601 date string (YYYY-MM-DD) */
export type DateString = string;

/** ISO 8601 datetime string */
export type DateTimeString = string;

/** Money values are always stored and transmitted as integers (minor units, e.g. cents) */
export type MinorCurrencyAmount = number;

export interface Money {
  amount: MinorCurrencyAmount;
  currency: string;
}

/** Idempotency key sent by client for financial operations */
export type IdempotencyKey = string;
