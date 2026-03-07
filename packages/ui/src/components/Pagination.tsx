import { Button } from './Button.js';
import type { PaginationMeta } from '@felix-travel/types';

export function Pagination({ meta, onPageChange }: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <p className="text-sm text-gray-700">
        Showing {(meta.page - 1) * meta.pageSize + 1} to {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!meta.hasPreviousPage}
          onClick={() => onPageChange(meta.page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!meta.hasNextPage}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
