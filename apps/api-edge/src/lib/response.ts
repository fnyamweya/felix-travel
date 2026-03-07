import type { ApiResponse, ApiErrorResponse, PaginationMeta } from '@felix-travel/types';

export function success<T>(data: T, meta?: PaginationMeta): ApiResponse<T> {
  return meta ? { success: true, data, meta } : { success: true, data };
}

export function error(code: string, message: string, details?: Record<string, unknown>): ApiErrorResponse {
  return { success: false, error: { code, message, ...(details !== undefined && { details }) } };
}
