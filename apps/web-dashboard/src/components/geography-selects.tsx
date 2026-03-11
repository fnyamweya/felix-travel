import { useQuery } from '@tanstack/react-query';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@felix-travel/ui';
import { apiClient } from '../lib/api-client.js';

/* ─── Country Select ─── */

export function CountrySelect({
    value,
    onChange,
    placeholder = 'Select country',
    continent,
    disabled,
}: {
    value: string;
    onChange: (code: string) => void;
    placeholder?: string;
    continent?: string;
    disabled?: boolean;
}) {
    const { data: raw = [] } = useQuery({
        queryKey: ['geography-countries', continent],
        queryFn: () => apiClient.geography.listCountries(continent ? { continent } : undefined),
        staleTime: 5 * 60 * 1000,
    });
    const countries = (Array.isArray(raw) ? raw : (raw as any)?.data ?? []) as any[];

    return (
        <Select value={value || '__none'} onValueChange={(v) => onChange(v === '__none' ? '' : v)} disabled={disabled ?? false}>
            <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
            <SelectContent>
                <SelectItem value="__none">{placeholder}</SelectItem>
                {countries.map((c: any) => (
                    <SelectItem key={c.code} value={c.code}>
                        {c.flagEmoji ? `${c.flagEmoji} ` : ''}{c.name} ({c.code})
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/* ─── Currency Select ─── */

export function CurrencySelect({
    value,
    onChange,
    placeholder = 'Select currency',
    disabled,
}: {
    value: string;
    onChange: (code: string) => void;
    placeholder?: string;
    disabled?: boolean;
}) {
    const { data: raw = [] } = useQuery({
        queryKey: ['geography-currencies'],
        queryFn: () => apiClient.geography.listCurrencies(),
        staleTime: 5 * 60 * 1000,
    });
    const currencies = (Array.isArray(raw) ? raw : (raw as any)?.data ?? []) as any[];

    return (
        <Select value={value || '__none'} onValueChange={(v) => onChange(v === '__none' ? '' : v)} disabled={disabled ?? false}>
            <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
            <SelectContent>
                <SelectItem value="__none">{placeholder}</SelectItem>
                {currencies.map((c: any) => (
                    <SelectItem key={c.code} value={c.code}>
                        {c.symbol} {c.name} ({c.code})
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/* ─── Region Select ─── */

export function RegionSelect({
    value,
    onChange,
    countryCode,
    placeholder = 'Select region',
    disabled,
}: {
    value: string;
    onChange: (id: string) => void;
    countryCode: string;
    placeholder?: string;
    disabled?: boolean;
}) {
    const { data: raw = [] } = useQuery({
        queryKey: ['geography-regions', countryCode],
        queryFn: () => apiClient.geography.listRegions(countryCode),
        enabled: Boolean(countryCode),
        staleTime: 5 * 60 * 1000,
    });
    const regions = (Array.isArray(raw) ? raw : (raw as any)?.data ?? []) as any[];

    return (
        <Select value={value || '__none'} onValueChange={(v) => onChange(v === '__none' ? '' : v)} disabled={disabled || !countryCode}>
            <SelectTrigger><SelectValue placeholder={countryCode ? placeholder : 'Select a country first'} /></SelectTrigger>
            <SelectContent>
                <SelectItem value="__none">{placeholder}</SelectItem>
                {regions.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                        {r.name}{r.code ? ` (${r.code})` : ''}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
