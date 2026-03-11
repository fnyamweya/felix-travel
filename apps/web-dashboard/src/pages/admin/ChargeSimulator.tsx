import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
    Badge,
    Button,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Input,
} from '@felix-travel/ui';
import {
    Play,
    Zap,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client.js';
import { formatMoney } from '../../lib/admin-utils.js';
import {
    EmptyBlock,
    Field,
    PageHeader,
    PageShell,
    SectionCard,
    WorkspaceGrid,
} from '../../components/workspace-ui.js';

export function AdminChargeSimulator() {
    const [form, setForm] = useState({
        scope: 'booking_level',
        timing: 'booking_confirm',
        jurisdictionCountry: 'KE',
        currencyCode: 'KES',
        bookingSubtotal: '100000',
        payoutAmount: '',
        paymentAmount: '',
        providerId: '',
        guestCount: '1',
    });

    const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

    // Fetch countries + currencies from geography API
    const { data: countriesRaw = [] } = useQuery({
        queryKey: ['geography-countries'],
        queryFn: () => apiClient.geography.listCountries(),
    });
    const countries = (Array.isArray(countriesRaw) ? countriesRaw : (countriesRaw as any)?.data ?? []) as any[];

    const { data: currenciesRaw = [] } = useQuery({
        queryKey: ['geography-currencies'],
        queryFn: () => apiClient.geography.listCurrencies(),
    });
    const currencies = (Array.isArray(currenciesRaw) ? currenciesRaw : (currenciesRaw as any)?.data ?? []) as any[];

    const { data: providersRaw = [] } = useQuery({
        queryKey: ['admin-providers'],
        queryFn: () => apiClient.providers.list(),
    });
    const providers = (Array.isArray(providersRaw) ? providersRaw : (providersRaw as any)?.data ?? []) as any[];

    const simulate = useMutation({
        mutationFn: () =>
            apiClient.charges.simulate({
                scope: form.scope as any,
                timing: form.timing as any,
                jurisdictionCountry: form.jurisdictionCountry.toUpperCase(),
                currencyCode: form.currencyCode.toUpperCase(),
                bookingSubtotal: form.bookingSubtotal ? Number(form.bookingSubtotal) : undefined,
                payoutAmount: form.payoutAmount ? Number(form.payoutAmount) : undefined,
                paymentAmount: form.paymentAmount ? Number(form.paymentAmount) : undefined,
                providerId: form.providerId || undefined,
                guestCount: form.guestCount ? Number(form.guestCount) : undefined,
            }),
    });

    const result = simulate.data;

    function BreakdownLine({ label, amount, variant = 'default' }: { label: string; amount: number; variant?: 'default' | 'add' | 'sub' | 'total' }) {
        const cls = variant === 'add' ? 'text-muted-foreground' : variant === 'sub' ? 'text-destructive' : variant === 'total' ? 'font-bold text-foreground' : 'text-foreground';
        const prefix = variant === 'add' ? '+' : variant === 'sub' ? '−' : '';
        return (
            <div className="flex items-center justify-between py-1.5">
                <span className={`text-sm ${variant === 'total' ? 'font-semibold' : ''}`}>{label}</span>
                <span className={`text-sm font-mono tabular-nums ${cls}`}>{prefix}{formatMoney(Math.abs(amount), form.currencyCode)}</span>
            </div>
        );
    }

    return (
        <PageShell>
            <PageHeader
                eyebrow="Charges"
                title="Charge Simulator"
                description="Preview charge breakdowns by simulating different booking scenarios."
            />

            <WorkspaceGrid
                main={
                    <div className="space-y-6">
                        {/* Input form */}
                        <SectionCard title="Simulation Parameters" description="Configure the scenario for the charge engine.">
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Scope">
                                    <Select value={form.scope} onValueChange={set('scope')}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="booking_level">Booking Level</SelectItem>
                                            <SelectItem value="booking_item_level">Booking Item Level</SelectItem>
                                            <SelectItem value="payment_level">Payment Level</SelectItem>
                                            <SelectItem value="payout_level">Payout Level</SelectItem>
                                            <SelectItem value="commission_level">Commission Level</SelectItem>
                                            <SelectItem value="refund_level">Refund Level</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>

                                <Field label="Timing">
                                    <Select value={form.timing} onValueChange={set('timing')}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="booking_quote">Booking Quote</SelectItem>
                                            <SelectItem value="booking_confirm">Booking Confirm</SelectItem>
                                            <SelectItem value="payment_capture">Payment Capture</SelectItem>
                                            <SelectItem value="payout">Payout</SelectItem>
                                            <SelectItem value="refund">Refund</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>

                                <Field label="Country">
                                    <Select value={form.jurisdictionCountry} onValueChange={set('jurisdictionCountry')}>
                                        <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                                        <SelectContent>
                                            {countries.length > 0 ? (
                                                countries.map((c: any) => (
                                                    <SelectItem key={c.code} value={c.code}>{c.flagEmoji} {c.name} ({c.code})</SelectItem>
                                                ))
                                            ) : (
                                                <>
                                                    <SelectItem value="KE">🇰🇪 Kenya</SelectItem>
                                                    <SelectItem value="TZ">🇹🇿 Tanzania</SelectItem>
                                                    <SelectItem value="UG">🇺🇬 Uganda</SelectItem>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </Field>

                                <Field label="Currency">
                                    <Select value={form.currencyCode} onValueChange={set('currencyCode')}>
                                        <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                                        <SelectContent>
                                            {currencies.length > 0 ? (
                                                currencies.map((c: any) => (
                                                    <SelectItem key={c.code} value={c.code}>{c.symbol} {c.name} ({c.code})</SelectItem>
                                                ))
                                            ) : (
                                                <>
                                                    <SelectItem value="KES">KES — Kenyan Shilling</SelectItem>
                                                    <SelectItem value="USD">USD — US Dollar</SelectItem>
                                                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </Field>

                                <Field label="Booking Subtotal (minor units)" description="e.g. 100000 = KES 1,000">
                                    <Input
                                        type="number"
                                        value={form.bookingSubtotal}
                                        onChange={(e) => set('bookingSubtotal')(e.target.value)}
                                        placeholder="100000"
                                    />
                                </Field>

                                <Field label="Guest Count">
                                    <Input
                                        type="number"
                                        value={form.guestCount}
                                        onChange={(e) => set('guestCount')(e.target.value)}
                                        min={1}
                                        placeholder="1"
                                    />
                                </Field>

                                <Field label="Payout Amount (optional)">
                                    <Input
                                        type="number"
                                        value={form.payoutAmount}
                                        onChange={(e) => set('payoutAmount')(e.target.value)}
                                        placeholder="Leave empty if N/A"
                                    />
                                </Field>

                                <Field label="Provider (optional)">
                                    <Select value={form.providerId || '__none'} onValueChange={(v) => set('providerId')(v === '__none' ? '' : v)}>
                                        <SelectTrigger><SelectValue placeholder="Any provider" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none">Any provider</SelectItem>
                                            {providers.map((p: any) => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                            </div>

                            <div className="mt-6">
                                <Button
                                    onClick={() => simulate.mutate()}
                                    disabled={simulate.isPending}
                                    className="w-full"
                                    size="lg"
                                >
                                    {simulate.isPending ? (
                                        <><Zap className="mr-2 h-4 w-4 animate-pulse" /> Running Simulation...</>
                                    ) : (
                                        <><Play className="mr-2 h-4 w-4" /> Run Simulation</>
                                    )}
                                </Button>
                            </div>
                        </SectionCard>
                    </div>
                }
                side={
                    <div className="space-y-4">
                        {simulate.error && (
                            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                                {String((simulate.error as any)?.message ?? simulate.error)}
                            </div>
                        )}

                        {result ? (
                            <>
                                {/* Customer breakdown */}
                                <SectionCard title="Customer Breakdown" description="What the customer pays">
                                    <div className="divide-y divide-border/50">
                                        <BreakdownLine label="Subtotal" amount={result.breakdown.customer.subtotal} />
                                        {[
                                            ...result.breakdown.customer.taxLines,
                                            ...result.breakdown.customer.levyLines,
                                            ...result.breakdown.customer.dutyLines,
                                            ...result.breakdown.customer.feeLines,
                                        ].map((l: any) => (
                                            <BreakdownLine
                                                key={l.chargeCode}
                                                label={`${l.chargeName}${l.rateBps ? ` (${l.rateBps / 100}%)` : ''}`}
                                                amount={l.chargeAmount}
                                                variant="add"
                                            />
                                        ))}
                                        {result.breakdown.customer.discountLines.map((l: any) => (
                                            <BreakdownLine key={l.chargeCode} label={l.chargeName} amount={l.chargeAmount} variant="sub" />
                                        ))}
                                        <div className="pt-2">
                                            <BreakdownLine label="Total Payable" amount={result.breakdown.customer.total} variant="total" />
                                        </div>
                                    </div>
                                </SectionCard>

                                {/* Provider breakdown */}
                                <SectionCard title="Provider Settlement" description="Net amount to provider">
                                    <div className="divide-y divide-border/50">
                                        <BreakdownLine label="Gross Booking Value" amount={result.breakdown.provider.grossBookingValue} />
                                        {[
                                            ...result.breakdown.provider.commissionLines,
                                            ...result.breakdown.provider.taxOnCommissionLines,
                                            ...result.breakdown.provider.withholdingLines,
                                            ...result.breakdown.provider.fxLines,
                                            ...result.breakdown.provider.feeLines,
                                        ].map((l: any) => (
                                            <BreakdownLine key={l.chargeCode} label={l.chargeName} amount={l.chargeAmount} variant="sub" />
                                        ))}
                                        <div className="pt-2">
                                            <BreakdownLine label="Net Payable" amount={result.breakdown.provider.netPayable} variant="total" />
                                        </div>
                                    </div>
                                </SectionCard>

                                {/* Applied rules */}
                                {result.appliedRules.length > 0 && (
                                    <SectionCard title="Applied Rules" description={`${result.appliedRules.length} charge rule(s) matched`}>
                                        <div className="space-y-2">
                                            {result.appliedRules.map((r: any) => (
                                                <div key={r.ruleId} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                                                    <Badge variant="secondary" className="text-[10px]">{r.chargeCode}</Badge>
                                                    <span className="text-muted-foreground truncate">
                                                        rule: {r.ruleId.slice(-8)} / set: {r.ruleSetId.slice(-8)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </SectionCard>
                                )}
                            </>
                        ) : (
                            <SectionCard title="Results">
                                <EmptyBlock
                                    title="No simulation results"
                                    description="Configure parameters and run a simulation to see the charge breakdown."
                                />
                            </SectionCard>
                        )}
                    </div>
                }
            />
        </PageShell>
    );
}
