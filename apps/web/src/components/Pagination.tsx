import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export const PAGE_SIZES = [20, 50, 100];

/** Client-side pagination over an already-filtered array. */
export function usePagination<T>(items: T[], defaultSize = 20) {
  const [pageSize, setPageSize] = useState(defaultSize);
  const [page, setPage] = useState(1);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Clamp the current page when the data set or page size shrinks.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  const changePageSize = (n: number) => {
    setPageSize(n);
    setPage(1);
  };

  return { pageItems, page, setPage, pageSize, setPageSize: changePageSize, total, pageCount, start };
}

/** Pagination footer: rows-per-page selector (20/50/100) + range + prev/next. */
export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  start,
  onPage,
  onPageSize,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  start: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const { t } = useTranslation();
  if (total === 0) return null;
  const from = start + 1;
  const to = Math.min(start + pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{t('pagination.rowsPerPage')}</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
          <SelectTrigger className="h-8 w-[74px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground tabular-nums">{t('pagination.showing', { from, to, total })}</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t('pagination.prev')}>
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <span className="min-w-[64px] text-center tabular-nums">{page} / {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label={t('pagination.next')}>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
}
