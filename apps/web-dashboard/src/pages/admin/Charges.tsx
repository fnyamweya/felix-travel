import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  calcMethodSchema,
  chargeBaseTypeSchema,
  chargeBeneficiarySchema,
  chargeCategorySchema,
  chargePayerSchema,
  chargeScopeSchema,
  createChargeDefinitionSchema,
  createChargeDependencySchema,
  createChargeRuleSchema,
  createChargeRuleSetSchema,
  refundBehaviorSchema,
  updateChargeDefinitionSchema,
  updateChargeRuleSchema,
} from '@felix-travel/validation';
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@felix-travel/ui';
import { Blocks, FileStack, Plus, Scale, Workflow } from 'lucide-react';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, getErrorMessage, titleizeToken, toOptionalNumber, toOptionalTrimmed } from '../../lib/admin-utils.js';
import {
  ActionButtonLink,
  DataTable,
  DataTableEmpty,
  EmptyBlock,
  EntityCell,
  Field,
  FieldGrid,
  InfoCard,
  InfoGrid,
  Notice,
  PageHeader,
  PageShell,
  SearchField,
  SectionCard,
  StatCard,
  StatGrid,
  SwitchField,
  TextField,
  TextareaField,
  WorkspaceGrid,
} from '../../components/workspace-ui.js';

/* ─────────────────── Form types ─── */

type DefinitionFormState = {
  code: string;
  name: string;
  description: string;
  category: (typeof chargeCategorySchema.options)[number];
  scope: (typeof chargeScopeSchema.options)[number];
  payer: (typeof chargePayerSchema.options)[number];
  beneficiary: (typeof chargeBeneficiarySchema.options)[number];
  baseType: (typeof chargeBaseTypeSchema.options)[number];
  calcMethod: (typeof calcMethodSchema.options)[number];
  calcPriority: string;
  isTaxable: boolean;
  isRecoverable: boolean;
  refundBehavior: (typeof refundBehaviorSchema.options)[number];
  ledgerDebitAccountCode: string;
  ledgerCreditAccountCode: string;
  effectiveFrom: string;
  effectiveTo: string;
  jurisdictionCountry: string;
  jurisdictionRegion: string;
  jurisdictionTaxCode: string;
  jurisdictionNotes: string;
  requiresApproval: boolean;
  isEnabled: boolean;
};

type RuleSetFormState = {
  name: string;
  jurisdictionCountry: string;
  jurisdictionRegion: string;
  providerId: string;
  listingCategory: string;
  minBookingAmount: string;
  maxBookingAmount: string;
  priority: string;
};

type TierRowState = { from: string; to: string; rateBps: string };

type ConditionRowState = {
  field: 'booking_amount' | 'provider_id' | 'listing_category' | 'country' | 'region' | 'service_date_day_of_week' | 'guest_count';
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in';
  value: string;
};

type RuleFormState = {
  calcMethod: (typeof calcMethodSchema.options)[number];
  rateBps: string;
  fixedAmount: string;
  currencyCode: string;
  minAmount: string;
  maxAmount: string;
  formula: string;
  tiers: TierRowState[];
  conditions: ConditionRowState[];
  isInclusive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
};

type RuleUpdateFormState = {
  rateBps: string;
  fixedAmount: string;
  minAmount: string;
  maxAmount: string;
  effectiveTo: string;
  isActive: boolean;
  changeReason: string;
};

type DependencyFormState = {
  dependsOnChargeId: string;
  dependencyType: 'base_of' | 'after' | 'exclusive';
};

/* ─────────────────── Constants ─── */

const CONDITION_FIELD_OPTIONS: ConditionRowState['field'][] = [
  'booking_amount', 'provider_id', 'listing_category', 'country', 'region', 'service_date_day_of_week', 'guest_count',
];
const CONDITION_OPERATOR_OPTIONS: ConditionRowState['op'][] = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in',
];

const EMPTY_TIER_ROW: TierRowState = { from: '0', to: '', rateBps: '' };
const EMPTY_CONDITION_ROW: ConditionRowState = { field: 'country', op: 'eq', value: '' };

const EMPTY_DEFINITION_FORM: DefinitionFormState = {
  code: '', name: '', description: '',
  category: 'commission', scope: 'booking_level', payer: 'provider',
  beneficiary: 'platform', baseType: 'booking_subtotal', calcMethod: 'percentage',
  calcPriority: '100', isTaxable: false, isRecoverable: false,
  refundBehavior: 'fully_refundable', ledgerDebitAccountCode: '', ledgerCreditAccountCode: '',
  effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '',
  jurisdictionCountry: '', jurisdictionRegion: '', jurisdictionTaxCode: '', jurisdictionNotes: '',
  requiresApproval: false, isEnabled: true,
};

const EMPTY_RULE_SET_FORM: RuleSetFormState = {
  name: '', jurisdictionCountry: '', jurisdictionRegion: '',
  providerId: '', listingCategory: '', minBookingAmount: '', maxBookingAmount: '', priority: '0',
};

const EMPTY_RULE_FORM: RuleFormState = {
  calcMethod: 'percentage', rateBps: '', fixedAmount: '', currencyCode: 'KES',
  minAmount: '', maxAmount: '', formula: '',
  tiers: [{ ...EMPTY_TIER_ROW }], conditions: [],
  isInclusive: false, effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '',
};

const EMPTY_RULE_UPDATE_FORM: RuleUpdateFormState = {
  rateBps: '', fixedAmount: '', minAmount: '', maxAmount: '',
  effectiveTo: '', isActive: true, changeReason: '',
};

const EMPTY_DEPENDENCY_FORM: DependencyFormState = { dependsOnChargeId: '', dependencyType: 'after' };

/* ─────────────────── Helpers ─── */

function parseJsonRecord(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; }
}

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try { const p = JSON.parse(value) as T[]; return Array.isArray(p) ? p : []; } catch { return []; }
}

function definitionFormFromRecord(d: any): DefinitionFormState {
  const m = parseJsonRecord(d.jurisdictionMetadata);
  return {
    code: d.code, name: d.name, description: d.description ?? '',
    category: d.category, scope: d.scope, payer: d.payer, beneficiary: d.beneficiary,
    baseType: d.baseType, calcMethod: d.calcMethod, calcPriority: String(d.calcPriority ?? 100),
    isTaxable: Boolean(d.isTaxable), isRecoverable: Boolean(d.isRecoverable),
    refundBehavior: d.refundBehavior,
    ledgerDebitAccountCode: d.ledgerDebitAccountCode ?? '',
    ledgerCreditAccountCode: d.ledgerCreditAccountCode ?? '',
    effectiveFrom: d.effectiveFrom, effectiveTo: d.effectiveTo ?? '',
    jurisdictionCountry: String(m.country ?? ''), jurisdictionRegion: String(m.region ?? ''),
    jurisdictionTaxCode: String(m.taxCode ?? ''), jurisdictionNotes: String(m.notes ?? ''),
    requiresApproval: Boolean(d.requiresApproval), isEnabled: Boolean(d.isEnabled),
  };
}

function ruleUpdateFormFromRecord(r: any): RuleUpdateFormState {
  return {
    rateBps: r.rateBps != null ? String(r.rateBps) : '', fixedAmount: r.fixedAmount != null ? String(r.fixedAmount) : '',
    minAmount: r.minAmount != null ? String(r.minAmount) : '', maxAmount: r.maxAmount != null ? String(r.maxAmount) : '',
    effectiveTo: r.effectiveTo ?? '', isActive: Boolean(r.isActive), changeReason: '',
  };
}

function buildJurisdictionMetadata(f: DefinitionFormState) {
  const m: Record<string, unknown> = {};
  if (f.jurisdictionCountry.trim()) m.country = f.jurisdictionCountry.trim().toUpperCase();
  if (f.jurisdictionRegion.trim()) m.region = f.jurisdictionRegion.trim();
  if (f.jurisdictionTaxCode.trim()) m.taxCode = f.jurisdictionTaxCode.trim().toUpperCase();
  if (f.jurisdictionNotes.trim()) m.notes = f.jurisdictionNotes.trim();
  return Object.keys(m).length > 0 ? m : undefined;
}

function isNumericConditionField(f: ConditionRowState['field']) {
  return f === 'booking_amount' || f === 'guest_count';
}

function buildConditionValue(c: ConditionRowState) {
  if (c.op === 'in' || c.op === 'not_in') return c.value.split(',').map((i) => i.trim()).filter(Boolean);
  if (isNumericConditionField(c.field)) return Number(c.value);
  return c.value.trim();
}

function buildTierConfig(tiers: TierRowState[]) {
  const cleaned = tiers.filter((t) => t.rateBps.trim() || t.to.trim() || t.from.trim());
  if (!cleaned.length) return undefined;
  return { tiers: cleaned.map((t) => ({ from: Number(t.from || '0'), to: t.to.trim() ? Number(t.to) : null, rateBps: Number(t.rateBps) })) };
}

function categoryVariant(c: string): 'info' | 'warning' | 'secondary' | 'success' | 'destructive' {
  if (['commission', 'fx'].includes(c)) return 'info';
  if (['tax', 'duty', 'levy'].includes(c)) return 'warning';
  if (c === 'discount') return 'success';
  if (c === 'withholding') return 'destructive';
  return 'secondary';
}

/* ─────────────────── Ledger Account Select ─── */

function LedgerAccountSelect({
  value,
  onValueChange,
  disabled,
  accounts,
  placeholder = 'Select account',
}: {
  value: string;
  onValueChange: (v: string) => void;
  disabled?: boolean;
  accounts: any[];
  placeholder?: string;
}) {
  return (
    <Select value={value || '__none'} onValueChange={(v) => onValueChange(v === '__none' ? '' : v)} disabled={disabled ?? false}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">None</SelectItem>
        {accounts.map((a: any) => (
          <SelectItem key={a.id} value={a.code}>
            {a.code} — {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ═══════════════════ Main Component ═══════════════════ */

export function AdminCharges() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('definitions');
  const [search, setSearch] = useState('');
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);
  const [isCreatingDefinition, setIsCreatingDefinition] = useState(false);
  const [selectedRuleSetId, setSelectedRuleSetId] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [definitionForm, setDefinitionForm] = useState<DefinitionFormState>(EMPTY_DEFINITION_FORM);
  const [ruleSetForm, setRuleSetForm] = useState<RuleSetFormState>(EMPTY_RULE_SET_FORM);
  const [ruleForm, setRuleForm] = useState<RuleFormState>(EMPTY_RULE_FORM);
  const [ruleUpdateForm, setRuleUpdateForm] = useState<RuleUpdateFormState>(EMPTY_RULE_UPDATE_FORM);
  const [dependencyForm, setDependencyForm] = useState<DependencyFormState>(EMPTY_DEPENDENCY_FORM);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* ─── Queries ─── */

  const { data: definitions = [], isLoading } = useQuery({
    queryKey: ['charge-definitions'],
    queryFn: () => apiClient.charges.listDefinitions(),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['admin-providers'],
    queryFn: () => apiClient.providers.list(),
  });

  const { data: ledgerAccountsRaw } = useQuery({
    queryKey: ['admin-ledger-accounts'],
    queryFn: () => apiClient.admin.listLedgerAccounts(),
  });
  const ledgerAccounts = (Array.isArray(ledgerAccountsRaw) ? ledgerAccountsRaw : (ledgerAccountsRaw as any)?.data ?? []) as any[];

  const { data: ruleSets = [] } = useQuery({
    queryKey: ['charge-rule-sets', selectedDefinitionId],
    queryFn: () => apiClient.charges.listRuleSets(selectedDefinitionId ? { chargeDefinitionId: selectedDefinitionId } : undefined),
    enabled: Boolean(selectedDefinitionId),
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['charge-rules', selectedRuleSetId],
    queryFn: () => apiClient.charges.listRules(selectedRuleSetId ? { ruleSetId: selectedRuleSetId } : undefined),
    enabled: Boolean(selectedRuleSetId),
  });

  const { data: dependencies = [] } = useQuery({
    queryKey: ['charge-dependencies', selectedDefinitionId],
    queryFn: () => apiClient.charges.listDependencies(selectedDefinitionId ? { chargeDefinitionId: selectedDefinitionId } : undefined),
    enabled: Boolean(selectedDefinitionId),
  });

  /* ─── Derived state ─── */

  const selectedDefinition = definitions.find((d: any) => d.id === selectedDefinitionId) ?? null;
  const selectedRuleSet = ruleSets.find((r: any) => r.id === selectedRuleSetId) ?? null;
  const selectedRule = rules.find((r: any) => r.id === selectedRuleId) ?? null;

  useEffect(() => {
    if (!definitions.length || selectedDefinitionId || isCreatingDefinition) return;
    setSelectedDefinitionId(definitions[0].id);
  }, [definitions, selectedDefinitionId, isCreatingDefinition]);

  useEffect(() => {
    if (selectedDefinition) { setDefinitionForm(definitionFormFromRecord(selectedDefinition)); return; }
    setDefinitionForm(EMPTY_DEFINITION_FORM);
  }, [selectedDefinition, isCreatingDefinition]);

  useEffect(() => {
    if (!ruleSets.length) { setSelectedRuleSetId(null); return; }
    if (!selectedRuleSetId || !ruleSets.some((r: any) => r.id === selectedRuleSetId))
      setSelectedRuleSetId(ruleSets[0].id);
  }, [ruleSets, selectedRuleSetId]);

  useEffect(() => {
    if (!rules.length) { setSelectedRuleId(null); setRuleUpdateForm(EMPTY_RULE_UPDATE_FORM); return; }
    if (!selectedRuleId || !rules.some((r: any) => r.id === selectedRuleId))
      setSelectedRuleId(rules[0].id);
  }, [rules, selectedRuleId]);

  useEffect(() => {
    if (!selectedRule) return;
    setRuleUpdateForm(ruleUpdateFormFromRecord(selectedRule));
  }, [selectedRule]);

  const filteredDefinitions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return definitions;
    return definitions.filter((d: any) =>
      [d.code, d.name, d.category, d.scope, d.payer].some((v) => String(v).toLowerCase().includes(q))
    );
  }, [definitions, search]);

  const enabledDefinitions = definitions.filter((d: any) => d.isEnabled).length;
  const approvalDefinitions = definitions.filter((d: any) => d.requiresApproval).length;
  const scopeCoverage = new Set(definitions.map((d: any) => d.scope)).size;

  /* ─── Mutations ─── */

  const definitionMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: definitionForm.code.trim(), name: definitionForm.name.trim(),
        description: toOptionalTrimmed(definitionForm.description),
        category: definitionForm.category, scope: definitionForm.scope,
        payer: definitionForm.payer, beneficiary: definitionForm.beneficiary,
        baseType: definitionForm.baseType as any, calcMethod: definitionForm.calcMethod,
        calcPriority: Number(definitionForm.calcPriority),
        isTaxable: definitionForm.isTaxable, isRecoverable: definitionForm.isRecoverable,
        refundBehavior: definitionForm.refundBehavior,
        ledgerDebitAccountCode: toOptionalTrimmed(definitionForm.ledgerDebitAccountCode),
        ledgerCreditAccountCode: toOptionalTrimmed(definitionForm.ledgerCreditAccountCode),
        effectiveFrom: definitionForm.effectiveFrom,
        effectiveTo: toOptionalTrimmed(definitionForm.effectiveTo),
        jurisdictionMetadata: buildJurisdictionMetadata(definitionForm),
        requiresApproval: definitionForm.requiresApproval,
      };
      if (!selectedDefinition) {
        const parsed = createChargeDefinitionSchema.safeParse(payload);
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid definition');
        return apiClient.charges.createDefinition(parsed.data);
      }
      const updatePayload = {
        name: payload.name, description: payload.description, calcPriority: payload.calcPriority,
        refundBehavior: payload.refundBehavior, effectiveTo: payload.effectiveTo,
        requiresApproval: payload.requiresApproval, isEnabled: definitionForm.isEnabled,
      };
      const parsed = updateChargeDefinitionSchema.safeParse(updatePayload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid definition update');
      return apiClient.charges.updateDefinition(selectedDefinition.id, parsed.data);
    },
    onSuccess: async (d: any) => {
      await queryClient.invalidateQueries({ queryKey: ['charge-definitions'] });
      if (d?.id) setSelectedDefinitionId(d.id);
      setIsCreatingDefinition(false);
      setMessage(selectedDefinition && !isCreatingDefinition ? 'Definition updated.' : 'Definition created.');
      setErrorMessage(null);
    },
    onError: (e) => setErrorMessage(getErrorMessage(e)),
  });

  const ruleSetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDefinitionId) throw new Error('Select a charge definition first.');
      const payload = {
        chargeDefinitionId: selectedDefinitionId, name: ruleSetForm.name.trim(),
        jurisdictionCountry: toOptionalTrimmed(ruleSetForm.jurisdictionCountry)?.toUpperCase(),
        jurisdictionRegion: toOptionalTrimmed(ruleSetForm.jurisdictionRegion),
        providerId: toOptionalTrimmed(ruleSetForm.providerId),
        listingCategory: toOptionalTrimmed(ruleSetForm.listingCategory),
        minBookingAmount: toOptionalNumber(ruleSetForm.minBookingAmount),
        maxBookingAmount: toOptionalNumber(ruleSetForm.maxBookingAmount),
        priority: Number(ruleSetForm.priority || 0),
      };
      const parsed = createChargeRuleSetSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid rule set');
      return apiClient.charges.createRuleSet(parsed.data);
    },
    onSuccess: async (rs: any) => {
      await queryClient.invalidateQueries({ queryKey: ['charge-rule-sets', selectedDefinitionId] });
      setSelectedRuleSetId(rs.id); setRuleSetForm(EMPTY_RULE_SET_FORM);
      setMessage('Rule set created.'); setErrorMessage(null);
    },
    onError: (e) => setErrorMessage(getErrorMessage(e)),
  });

  const ruleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRuleSetId) throw new Error('Select a rule set first.');
      const payload = {
        ruleSetId: selectedRuleSetId, calcMethod: ruleForm.calcMethod,
        rateBps: toOptionalNumber(ruleForm.rateBps), fixedAmount: toOptionalNumber(ruleForm.fixedAmount),
        currencyCode: toOptionalTrimmed(ruleForm.currencyCode)?.toUpperCase(),
        minAmount: toOptionalNumber(ruleForm.minAmount), maxAmount: toOptionalNumber(ruleForm.maxAmount),
        formula: toOptionalTrimmed(ruleForm.formula),
        tieredConfig: buildTierConfig(ruleForm.tiers),
        conditions: ruleForm.conditions.filter((c) => c.value.trim()).map((c) => ({
          field: c.field, op: c.op, value: buildConditionValue(c),
        })),
        isInclusive: ruleForm.isInclusive, effectiveFrom: ruleForm.effectiveFrom,
        effectiveTo: toOptionalTrimmed(ruleForm.effectiveTo),
      };
      const parsed = createChargeRuleSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid rule');
      return apiClient.charges.createRule(parsed.data);
    },
    onSuccess: async (r: any) => {
      await queryClient.invalidateQueries({ queryKey: ['charge-rules', selectedRuleSetId] });
      setSelectedRuleId(r.id); setRuleForm(EMPTY_RULE_FORM);
      setMessage('Rule created.'); setErrorMessage(null);
    },
    onError: (e) => setErrorMessage(getErrorMessage(e)),
  });

  const ruleUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRuleId) throw new Error('Select a rule first.');
      const payload = {
        rateBps: toOptionalNumber(ruleUpdateForm.rateBps), fixedAmount: toOptionalNumber(ruleUpdateForm.fixedAmount),
        minAmount: toOptionalNumber(ruleUpdateForm.minAmount), maxAmount: toOptionalNumber(ruleUpdateForm.maxAmount),
        effectiveTo: toOptionalTrimmed(ruleUpdateForm.effectiveTo),
        isActive: ruleUpdateForm.isActive, changeReason: ruleUpdateForm.changeReason.trim(),
      };
      const parsed = updateChargeRuleSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid rule update');
      return apiClient.charges.updateRule(selectedRuleId, parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['charge-rules', selectedRuleSetId] });
      setMessage('Rule updated.'); setErrorMessage(null);
      setRuleUpdateForm((c) => ({ ...c, changeReason: '' }));
    },
    onError: (e) => setErrorMessage(getErrorMessage(e)),
  });

  const dependencyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDefinitionId) throw new Error('Select a definition first.');
      const payload = {
        dependentChargeId: selectedDefinitionId,
        dependsOnChargeId: dependencyForm.dependsOnChargeId,
        dependencyType: dependencyForm.dependencyType,
      };
      const parsed = createChargeDependencySchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid dependency');
      return apiClient.charges.addDependency(parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['charge-dependencies', selectedDefinitionId] });
      setDependencyForm(EMPTY_DEPENDENCY_FORM);
      setMessage('Dependency added.'); setErrorMessage(null);
    },
    onError: (e) => setErrorMessage(getErrorMessage(e)),
  });

  const otherDefinitions = definitions.filter((d: any) => d.id !== selectedDefinitionId);
  const selectedRuleConditions = selectedRule ? parseJsonArray<ConditionRowState>(selectedRule.conditions) : [];
  const selectedRuleTiers = selectedRule ? parseJsonRecord(selectedRule.tieredConfig) : {};
  const selectedRuleTierRows = Array.isArray((selectedRuleTiers as any).tiers)
    ? ((selectedRuleTiers as any).tiers as Array<{ from: number; to: number | null; rateBps: number }>)
    : [];

  const isEditingDefinition = Boolean(selectedDefinition && !isCreatingDefinition);

  /* ═══════════════════ Render ═══════════════════ */

  return (
    <PageShell>
      <PageHeader
        eyebrow="Charge domain"
        title="Charge studio"
        description="Manage definitions, rule sets, rules, and dependencies."
        actions={
          <>
            <Button variant="outline" onClick={() => {
              setIsCreatingDefinition(true); setSelectedDefinitionId(null);
              setSelectedRuleSetId(null); setSelectedRuleId(null);
              setDefinitionForm(EMPTY_DEFINITION_FORM); setActiveTab('definitions');
              setMessage(null); setErrorMessage(null);
            }}>
              New definition
            </Button>
            <ActionButtonLink to="/admin/charges/simulate">Open simulator</ActionButtonLink>
          </>
        }
      />

      {(message || errorMessage) && (
        <Notice message={errorMessage ?? message ?? ''} variant={errorMessage ? 'destructive' : 'success'} />
      )}

      <StatGrid>
        <StatCard label="Definitions" value={definitions.length} hint={`${enabledDefinitions} currently enabled`} icon={Blocks} />
        <StatCard label="Approval tracked" value={approvalDefinitions} hint="Require approval for changes" icon={Scale} tone="warning" />
        <StatCard label="Rule sets" value={ruleSets.length} hint={selectedDefinition ? `For ${selectedDefinition.code}` : 'Select a definition'} icon={FileStack} tone="info" />
        <StatCard label="Scope coverage" value={scopeCoverage} hint="Distinct charge scopes" icon={Workflow} />
      </StatGrid>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="definitions">Definitions</TabsTrigger>
          <TabsTrigger value="rules">Rule Sets & Rules</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
        </TabsList>

        {/* ═══════════════ TAB 1: Definitions ═══════════════ */}
        <TabsContent value="definitions">
          <WorkspaceGrid
            main={
              <SectionCard
                title="Definition catalog"
                description="Select a charge to view or edit its config."
                action={<SearchField value={search} onChange={setSearch} placeholder="Search definitions" />}
              >
                <DataTable headers={['Definition', 'Category', 'Scope', 'Payer', 'Ledger DR / CR', 'Status']}>
                  {isLoading && <DataTableEmpty colSpan={6} label="Loading definitions..." />}
                  {!isLoading && filteredDefinitions.length === 0 && <DataTableEmpty colSpan={6} label="No definitions match." />}
                  {filteredDefinitions.map((d: any) => (
                    <tr key={d.id}
                      className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40 ${d.id === selectedDefinitionId ? 'bg-primary/5' : ''}`}
                      onClick={() => { setIsCreatingDefinition(false); setSelectedDefinitionId(d.id); }}
                    >
                      <td className="p-4"><EntityCell title={d.code} subtitle={d.name} /></td>
                      <td className="p-4"><Badge variant={categoryVariant(d.category)}>{titleizeToken(d.category)}</Badge></td>
                      <td className="p-4 text-sm text-muted-foreground">{titleizeToken(d.scope)}</td>
                      <td className="p-4 text-sm text-muted-foreground">{titleizeToken(d.payer)}</td>
                      <td className="p-4 font-mono text-xs text-muted-foreground">
                        {d.ledgerDebitAccountCode || '—'} / {d.ledgerCreditAccountCode || '—'}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={d.isEnabled ? 'success' : 'destructive'}>{d.isEnabled ? 'Enabled' : 'Disabled'}</Badge>
                          {d.requiresApproval && <Badge variant="warning">Approval</Badge>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              </SectionCard>
            }
            side={
              <SectionCard
                title={isEditingDefinition ? 'Edit definition' : 'Create definition'}
                description={isEditingDefinition ? `Editing ${selectedDefinition?.code}` : 'Configure a new charge definition.'}
                action={
                  <Button onClick={() => void definitionMutation.mutateAsync()} loading={definitionMutation.isPending}>
                    {isEditingDefinition ? 'Save' : 'Create'}
                  </Button>
                }
              >
                <div className="space-y-6">
                  {/* Identity */}
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Identity</h4>
                  </div>
                  <FieldGrid>
                    <TextField label="Code" value={definitionForm.code} disabled={isEditingDefinition}
                      onChange={(e) => setDefinitionForm((c) => ({ ...c, code: e.target.value.toUpperCase() }))} placeholder="PLATFORM_COMMISSION" />
                    <TextField label="Name" value={definitionForm.name}
                      onChange={(e) => setDefinitionForm((c) => ({ ...c, name: e.target.value }))} placeholder="Platform commission" />
                    <Field label="Category">
                      <Select value={definitionForm.category} disabled={isEditingDefinition}
                        onValueChange={(v) => setDefinitionForm((c) => ({ ...c, category: v as DefinitionFormState['category'] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{chargeCategorySchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Scope">
                      <Select value={definitionForm.scope} disabled={isEditingDefinition}
                        onValueChange={(v) => setDefinitionForm((c) => ({ ...c, scope: v as DefinitionFormState['scope'] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{chargeScopeSchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                  </FieldGrid>

                  {/* Flow */}
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Flow & Calculation</h4>
                  </div>
                  <FieldGrid>
                    <Field label="Payer">
                      <Select value={definitionForm.payer} disabled={isEditingDefinition}
                        onValueChange={(v) => setDefinitionForm((c) => ({ ...c, payer: v as DefinitionFormState['payer'] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{chargePayerSchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Beneficiary">
                      <Select value={definitionForm.beneficiary} disabled={isEditingDefinition}
                        onValueChange={(v) => setDefinitionForm((c) => ({ ...c, beneficiary: v as DefinitionFormState['beneficiary'] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{chargeBeneficiarySchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Base type">
                      <Select value={definitionForm.baseType} disabled={isEditingDefinition}
                        onValueChange={(v) => setDefinitionForm((c) => ({ ...c, baseType: v as DefinitionFormState['baseType'] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{chargeBaseTypeSchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Calculation method">
                      <Select value={definitionForm.calcMethod} disabled={isEditingDefinition}
                        onValueChange={(v) => setDefinitionForm((c) => ({ ...c, calcMethod: v as DefinitionFormState['calcMethod'] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{calcMethodSchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <TextField label="Priority" type="number" value={definitionForm.calcPriority}
                      onChange={(e) => setDefinitionForm((c) => ({ ...c, calcPriority: e.target.value }))} />
                    <Field label="Refund behavior">
                      <Select value={definitionForm.refundBehavior}
                        onValueChange={(v) => setDefinitionForm((c) => ({ ...c, refundBehavior: v as DefinitionFormState['refundBehavior'] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{refundBehaviorSchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                  </FieldGrid>

                  {/* Ledger Accounts */}
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ledger Accounts</h4>
                  </div>
                  <FieldGrid>
                    <Field label="Debit account">
                      <LedgerAccountSelect
                        value={definitionForm.ledgerDebitAccountCode}
                        onValueChange={(v) => setDefinitionForm((c) => ({ ...c, ledgerDebitAccountCode: v }))}
                        disabled={isEditingDefinition}
                        accounts={ledgerAccounts}
                        placeholder="Select debit account"
                      />
                    </Field>
                    <Field label="Credit account">
                      <LedgerAccountSelect
                        value={definitionForm.ledgerCreditAccountCode}
                        onValueChange={(v) => setDefinitionForm((c) => ({ ...c, ledgerCreditAccountCode: v }))}
                        disabled={isEditingDefinition}
                        accounts={ledgerAccounts}
                        placeholder="Select credit account"
                      />
                    </Field>
                  </FieldGrid>

                  {/* Dates */}
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Effective Period</h4>
                  </div>
                  <FieldGrid>
                    <TextField label="Effective from" type="date" value={definitionForm.effectiveFrom} disabled={isEditingDefinition}
                      onChange={(e) => setDefinitionForm((c) => ({ ...c, effectiveFrom: e.target.value }))} />
                    <TextField label="Effective to" type="date" value={definitionForm.effectiveTo}
                      onChange={(e) => setDefinitionForm((c) => ({ ...c, effectiveTo: e.target.value }))} />
                  </FieldGrid>

                  {/* Jurisdiction */}
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Jurisdiction</h4>
                  </div>
                  <FieldGrid>
                    <TextField label="Country" value={definitionForm.jurisdictionCountry} disabled={isEditingDefinition} maxLength={2}
                      onChange={(e) => setDefinitionForm((c) => ({ ...c, jurisdictionCountry: e.target.value.toUpperCase() }))} placeholder="KE" />
                    <TextField label="Region" value={definitionForm.jurisdictionRegion} disabled={isEditingDefinition}
                      onChange={(e) => setDefinitionForm((c) => ({ ...c, jurisdictionRegion: e.target.value }))} placeholder="Nairobi" />
                    <TextField label="Tax code" value={definitionForm.jurisdictionTaxCode} disabled={isEditingDefinition}
                      onChange={(e) => setDefinitionForm((c) => ({ ...c, jurisdictionTaxCode: e.target.value.toUpperCase() }))} placeholder="VAT" />
                  </FieldGrid>

                  <TextareaField label="Description" rows={2} value={definitionForm.description}
                    onChange={(e) => setDefinitionForm((c) => ({ ...c, description: e.target.value }))} placeholder="Describe when this charge applies." />

                  {/* Flags */}
                  <div className="grid gap-4 xl:grid-cols-2">
                    <SwitchField label="Taxable" description="Charge is tax-bearing." checked={definitionForm.isTaxable}
                      onCheckedChange={(v) => setDefinitionForm((c) => ({ ...c, isTaxable: v }))} disabled={isEditingDefinition} />
                    <SwitchField label="Recoverable" description="Can be recovered later." checked={definitionForm.isRecoverable}
                      onCheckedChange={(v) => setDefinitionForm((c) => ({ ...c, isRecoverable: v }))} disabled={isEditingDefinition} />
                    <SwitchField label="Needs approval" description="Changes require approval." checked={definitionForm.requiresApproval}
                      onCheckedChange={(v) => setDefinitionForm((c) => ({ ...c, requiresApproval: v }))} />
                    <SwitchField label="Enabled" description="Participate in charge calculations." checked={definitionForm.isEnabled}
                      onCheckedChange={(v) => setDefinitionForm((c) => ({ ...c, isEnabled: v }))} />
                  </div>

                  {isEditingDefinition && (
                    <InfoGrid>
                      <InfoCard label="Created" value={formatDate(selectedDefinition!.createdAt)} />
                      <InfoCard label="Updated" value={formatDate(selectedDefinition!.updatedAt)} />
                    </InfoGrid>
                  )}
                </div>
              </SectionCard>
            }
          />
        </TabsContent>

        {/* ═══════════════ TAB 2: Rule Sets & Rules ═══════════════ */}
        <TabsContent value="rules">
          {!selectedDefinition ? (
            <EmptyBlock title="Select a definition first" description="Select a definition from the Definitions tab first." />
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              {/* Rule Sets */}
              <SectionCard
                title="Rule sets"
                description={`Scoping selectors for ${selectedDefinition.code}`}
                action={<Badge variant="info">{selectedDefinition.code}</Badge>}
              >
                <div className="space-y-5">
                  {ruleSets.length === 0 ? (
                    <EmptyBlock title="No rule sets" description="Create the first rule set for this definition." />
                  ) : (
                    <div className="space-y-3">
                      {ruleSets.map((rs: any) => (
                        <button key={rs.id} type="button"
                          className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${rs.id === selectedRuleSetId ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-background hover:bg-muted/35'}`}
                          onClick={() => setSelectedRuleSetId(rs.id)}>
                          <div className="text-sm font-semibold text-foreground">{rs.name}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {rs.jurisdictionCountry ?? 'Any country'} / {rs.providerId ? 'Provider-specific' : 'Global'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1 pt-2">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Add Rule Set</h4>
                  </div>
                  <FieldGrid>
                    <TextField label="Name" className="md:col-span-2" value={ruleSetForm.name}
                      onChange={(e) => setRuleSetForm((c) => ({ ...c, name: e.target.value }))} placeholder="Default Kenya marketplace" />
                    <TextField label="Country" value={ruleSetForm.jurisdictionCountry} maxLength={2}
                      onChange={(e) => setRuleSetForm((c) => ({ ...c, jurisdictionCountry: e.target.value.toUpperCase() }))} placeholder="KE" />
                    <TextField label="Region" value={ruleSetForm.jurisdictionRegion}
                      onChange={(e) => setRuleSetForm((c) => ({ ...c, jurisdictionRegion: e.target.value }))} placeholder="Nairobi" />
                    <Field label="Provider">
                      <Select value={ruleSetForm.providerId || '__any'} onValueChange={(v) => setRuleSetForm((c) => ({ ...c, providerId: v === '__any' ? '' : v }))}>
                        <SelectTrigger><SelectValue placeholder="Any provider" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__any">Any provider</SelectItem>
                          {providers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <TextField label="Listing category" value={ruleSetForm.listingCategory}
                      onChange={(e) => setRuleSetForm((c) => ({ ...c, listingCategory: e.target.value }))} placeholder="flight" />
                    <TextField label="Min booking amount" type="number" value={ruleSetForm.minBookingAmount}
                      onChange={(e) => setRuleSetForm((c) => ({ ...c, minBookingAmount: e.target.value }))} />
                    <TextField label="Max booking amount" type="number" value={ruleSetForm.maxBookingAmount}
                      onChange={(e) => setRuleSetForm((c) => ({ ...c, maxBookingAmount: e.target.value }))} />
                    <TextField label="Priority" type="number" value={ruleSetForm.priority}
                      onChange={(e) => setRuleSetForm((c) => ({ ...c, priority: e.target.value }))} />
                  </FieldGrid>
                  <Button variant="outline" onClick={() => void ruleSetMutation.mutateAsync()} loading={ruleSetMutation.isPending}>
                    Add rule set
                  </Button>
                </div>
              </SectionCard>

              {/* Rules */}
              <SectionCard
                title="Rules"
                description={selectedRuleSet ? `Rules for ${selectedRuleSet.name}` : 'Select a rule set.'}
                action={selectedRuleSet ? <Badge variant="info">{selectedRuleSet.name}</Badge> : null}
              >
                {!selectedRuleSet ? (
                  <EmptyBlock title="Select a rule set" description="Choose from the rule sets on the left." />
                ) : (
                  <div className="space-y-5">
                    {rules.length === 0 ? (
                      <EmptyBlock title="No rules" description="Add the first rule for this set." />
                    ) : (
                      <div className="space-y-3">
                        {rules.map((r: any) => (
                          <button key={r.id} type="button"
                            className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${r.id === selectedRuleId ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-background hover:bg-muted/35'}`}
                            onClick={() => setSelectedRuleId(r.id)}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-foreground">{titleizeToken(r.calcMethod)}</div>
                              <Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              v{r.version}{r.rateBps != null ? ` · ${r.rateBps} bps` : ''}{r.fixedAmount != null ? ` · ${r.fixedAmount} fixed` : ''}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* New rule form */}
                    <div className="space-y-1 pt-2">
                      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Add Rule</h4>
                    </div>
                    <FieldGrid>
                      <Field label="Method">
                        <Select value={ruleForm.calcMethod} onValueChange={(v) => setRuleForm((c) => ({ ...c, calcMethod: v as RuleFormState['calcMethod'] }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{calcMethodSchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                        </Select>
                      </Field>
                      <TextField label="Rate bps" type="number" value={ruleForm.rateBps}
                        onChange={(e) => setRuleForm((c) => ({ ...c, rateBps: e.target.value }))} placeholder="1000" />
                      <TextField label="Fixed amount" type="number" value={ruleForm.fixedAmount}
                        onChange={(e) => setRuleForm((c) => ({ ...c, fixedAmount: e.target.value }))} placeholder="5000" />
                      <TextField label="Currency" value={ruleForm.currencyCode} maxLength={3}
                        onChange={(e) => setRuleForm((c) => ({ ...c, currencyCode: e.target.value.toUpperCase() }))} />
                      <TextField label="Min amount" type="number" value={ruleForm.minAmount}
                        onChange={(e) => setRuleForm((c) => ({ ...c, minAmount: e.target.value }))} />
                      <TextField label="Max amount" type="number" value={ruleForm.maxAmount}
                        onChange={(e) => setRuleForm((c) => ({ ...c, maxAmount: e.target.value }))} />
                      <TextField label="Effective from" type="date" value={ruleForm.effectiveFrom}
                        onChange={(e) => setRuleForm((c) => ({ ...c, effectiveFrom: e.target.value }))} />
                      <TextField label="Effective to" type="date" value={ruleForm.effectiveTo}
                        onChange={(e) => setRuleForm((c) => ({ ...c, effectiveTo: e.target.value }))} />
                      <TextField label="Formula" className="md:col-span-2" value={ruleForm.formula}
                        onChange={(e) => setRuleForm((c) => ({ ...c, formula: e.target.value }))} placeholder="base_amount * 0.015" />
                    </FieldGrid>

                    {/* Tiered config */}
                    {ruleForm.calcMethod === 'tiered_percentage' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-foreground">Tiers</div>
                          <Button variant="outline" size="sm" onClick={() => setRuleForm((c) => ({ ...c, tiers: [...c.tiers, { ...EMPTY_TIER_ROW }] }))}>
                            <Plus className="h-4 w-4" /> Add tier
                          </Button>
                        </div>
                        {ruleForm.tiers.map((tier, idx) => (
                          <div key={idx} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                            <FieldGrid>
                              <TextField label="From" type="number" value={tier.from}
                                onChange={(e) => setRuleForm((c) => ({ ...c, tiers: c.tiers.map((t, i) => i === idx ? { ...t, from: e.target.value } : t) }))} />
                              <TextField label="To" type="number" value={tier.to}
                                onChange={(e) => setRuleForm((c) => ({ ...c, tiers: c.tiers.map((t, i) => i === idx ? { ...t, to: e.target.value } : t) }))} placeholder="Open-ended" />
                              <TextField label="Rate bps" type="number" value={tier.rateBps}
                                onChange={(e) => setRuleForm((c) => ({ ...c, tiers: c.tiers.map((t, i) => i === idx ? { ...t, rateBps: e.target.value } : t) }))} />
                            </FieldGrid>
                            {ruleForm.tiers.length > 1 && (
                              <Button variant="ghost" size="sm" className="mt-3"
                                onClick={() => setRuleForm((c) => ({ ...c, tiers: c.tiers.filter((_, i) => i !== idx) }))}>
                                Remove tier
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Conditions */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-foreground">Conditions</div>
                        <Button variant="outline" size="sm" onClick={() => setRuleForm((c) => ({ ...c, conditions: [...c.conditions, { ...EMPTY_CONDITION_ROW }] }))}>
                          <Plus className="h-4 w-4" /> Add condition
                        </Button>
                      </div>
                      {ruleForm.conditions.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                          No conditions — rule applies whenever the rule set matches.
                        </div>
                      )}
                      {ruleForm.conditions.map((cond, idx) => (
                        <div key={idx} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                          <FieldGrid>
                            <Field label="Field">
                              <Select value={cond.field} onValueChange={(v) => setRuleForm((c) => ({
                                ...c, conditions: c.conditions.map((cc, i) => i === idx ? { ...cc, field: v as ConditionRowState['field'] } : cc),
                              }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{CONDITION_FIELD_OPTIONS.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                              </Select>
                            </Field>
                            <Field label="Operator">
                              <Select value={cond.op} onValueChange={(v) => setRuleForm((c) => ({
                                ...c, conditions: c.conditions.map((cc, i) => i === idx ? { ...cc, op: v as ConditionRowState['op'] } : cc),
                              }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{CONDITION_OPERATOR_OPTIONS.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                              </Select>
                            </Field>
                            <TextField label={cond.op === 'in' || cond.op === 'not_in' ? 'Values (comma separated)' : 'Value'}
                              className="md:col-span-2" value={cond.value}
                              onChange={(e) => setRuleForm((c) => ({
                                ...c, conditions: c.conditions.map((cc, i) => i === idx ? { ...cc, value: e.target.value } : cc),
                              }))} placeholder={isNumericConditionField(cond.field) ? '10000' : 'KE or safari,flight'} />
                          </FieldGrid>
                          <Button variant="ghost" size="sm" className="mt-3"
                            onClick={() => setRuleForm((c) => ({ ...c, conditions: c.conditions.filter((_, i) => i !== idx) }))}>
                            Remove condition
                          </Button>
                        </div>
                      ))}
                    </div>

                    <SwitchField label="Inclusive" description="Amount is already included in the base amount."
                      checked={ruleForm.isInclusive} onCheckedChange={(v) => setRuleForm((c) => ({ ...c, isInclusive: v }))} />

                    <Button variant="outline" onClick={() => void ruleMutation.mutateAsync()} loading={ruleMutation.isPending}>
                      Add rule
                    </Button>

                    {/* Selected rule maintenance */}
                    {selectedRule && (
                      <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/25 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">Edit Rule v{selectedRule.version}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{titleizeToken(selectedRule.calcMethod)}</div>
                          </div>
                          <Badge variant={selectedRule.isActive ? 'success' : 'secondary'}>{selectedRule.isActive ? 'Active' : 'Inactive'}</Badge>
                        </div>
                        <FieldGrid>
                          <TextField label="Rate bps" type="number" value={ruleUpdateForm.rateBps}
                            onChange={(e) => setRuleUpdateForm((c) => ({ ...c, rateBps: e.target.value }))} />
                          <TextField label="Fixed amount" type="number" value={ruleUpdateForm.fixedAmount}
                            onChange={(e) => setRuleUpdateForm((c) => ({ ...c, fixedAmount: e.target.value }))} />
                          <TextField label="Min amount" type="number" value={ruleUpdateForm.minAmount}
                            onChange={(e) => setRuleUpdateForm((c) => ({ ...c, minAmount: e.target.value }))} />
                          <TextField label="Max amount" type="number" value={ruleUpdateForm.maxAmount}
                            onChange={(e) => setRuleUpdateForm((c) => ({ ...c, maxAmount: e.target.value }))} />
                          <TextField label="Effective to" type="date" value={ruleUpdateForm.effectiveTo}
                            onChange={(e) => setRuleUpdateForm((c) => ({ ...c, effectiveTo: e.target.value }))} />
                          <SwitchField label="Active" description="Keep available for execution."
                            checked={ruleUpdateForm.isActive} onCheckedChange={(v) => setRuleUpdateForm((c) => ({ ...c, isActive: v }))} />
                          <TextareaField label="Change reason" className="md:col-span-2" rows={2} value={ruleUpdateForm.changeReason}
                            onChange={(e) => setRuleUpdateForm((c) => ({ ...c, changeReason: e.target.value }))} placeholder="Why is this changing?" />
                        </FieldGrid>
                        {(selectedRuleConditions.length > 0 || selectedRuleTierRows.length > 0) && (
                          <InfoGrid>
                            <InfoCard label="Conditions"
                              value={selectedRuleConditions.length > 0
                                ? selectedRuleConditions.map((c) => `${titleizeToken(c.field)} ${titleizeToken(c.op)} ${String(c.value)}`).join(' / ')
                                : 'None'} />
                            <InfoCard label="Tiering"
                              value={selectedRuleTierRows.length > 0
                                ? selectedRuleTierRows.map((t) => `${t.from}-${t.to ?? 'max'}: ${t.rateBps} bps`).join(' / ')
                                : 'Not tiered'} />
                          </InfoGrid>
                        )}
                        <Button onClick={() => void ruleUpdateMutation.mutateAsync()} loading={ruleUpdateMutation.isPending}>
                          Version rule
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            </div>
          )}
        </TabsContent>

        {/* ═══════════════ TAB 3: Dependencies ═══════════════ */}
        <TabsContent value="dependencies">
          {!selectedDefinition ? (
            <EmptyBlock title="Select a definition first" description="Select a definition from the Definitions tab." />
          ) : (
            <WorkspaceGrid
              main={
                <SectionCard title="Dependency graph" description={`Cross-charge relationships for ${selectedDefinition.code}`}>
                  {dependencies.length === 0 ? (
                    <EmptyBlock title="No dependencies" description="This definition has no upstream dependencies." />
                  ) : (
                    <DataTable headers={['Upstream Charge', 'Relationship', 'Added']}>
                      {dependencies.map((dep: any) => {
                        const upstream = definitions.find((d: any) => d.id === dep.dependsOnChargeId);
                        return (
                          <tr key={dep.id} className="border-b border-border/60">
                            <td className="p-4"><EntityCell title={upstream?.code ?? '—'} subtitle={upstream?.name ?? dep.dependsOnChargeId.slice(-8)} /></td>
                            <td className="p-4"><Badge variant="info">{titleizeToken(dep.dependencyType)}</Badge></td>
                            <td className="p-4 text-sm text-muted-foreground">{formatDate(dep.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </DataTable>
                  )}
                </SectionCard>
              }
              side={
                <SectionCard title="Add dependency" description={`Add an upstream dependency for ${selectedDefinition.code}`}>
                  <div className="space-y-5">
                    <Field label="Depends on">
                      <Select value={dependencyForm.dependsOnChargeId || '__none'}
                        onValueChange={(v) => setDependencyForm((c) => ({ ...c, dependsOnChargeId: v === '__none' ? '' : v }))}>
                        <SelectTrigger><SelectValue placeholder="Select definition" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Select definition</SelectItem>
                          {otherDefinitions.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Relationship type">
                      <Select value={dependencyForm.dependencyType}
                        onValueChange={(v) => setDependencyForm((c) => ({ ...c, dependencyType: v as DependencyFormState['dependencyType'] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="base_of">Base of</SelectItem>
                          <SelectItem value="after">After</SelectItem>
                          <SelectItem value="exclusive">Exclusive</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Button variant="outline" onClick={() => void dependencyMutation.mutateAsync()} loading={dependencyMutation.isPending}>
                      Add dependency
                    </Button>
                  </div>
                </SectionCard>
              }
            />
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
