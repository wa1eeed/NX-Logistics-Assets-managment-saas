import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { LookupItem } from '@nx-lam/shared';
import { api } from '../lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const NONE = '__none__';

/** A Select whose options come from a super-admin-managed lookup list. */
export function LookupSelect({
  type,
  value,
  onChange,
  placeholder,
  allowEmpty = true,
}: {
  type: string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const q = useQuery({
    queryKey: ['lookups', type],
    queryFn: async () => (await api.get<LookupItem[]>('/lookups', { params: { type } })).data,
    staleTime: 60_000,
  });
  const label = (l: LookupItem) => (isAr ? l.labelAr || l.labelEn : l.labelEn);

  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger><SelectValue placeholder={placeholder ?? '…'} /></SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value={NONE}>—</SelectItem>}
        {q.data?.map((l) => (
          <SelectItem key={l.id} value={l.value}>{label(l)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
