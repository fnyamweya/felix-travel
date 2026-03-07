import type { PaginationMeta } from '@felix-travel/types';

export function buildPaginationMeta(total: number, page: number, pageSize: number): PaginationMeta {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
