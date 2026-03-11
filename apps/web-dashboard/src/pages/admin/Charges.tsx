/**
 * Charge Studio — Action-oriented management page.
 *
 * Browse mode:  DataTable with row actions, bulk selection, filter chips
 * Quick actions: Enable/disable toggle (confirm dialogs)
 * Detail view:   Side panel for definition inspection
 * Edit view:     Side panel for moderate edits
 * Create flow:   Multi-step wizard for new charge definitions
 * Rule mgmt:     Side panel for rule sets, rules, and dependencies
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
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
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@felix-travel/ui';
import {
  Blocks,
  Edit,
  Eye,
  FileStack,
  GitBranch,
  Layers,
  Pause,
  Play,
  Plus,
  Scale,
  Workflow,
  Zap,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, getErrorMessage, titleizeToken, toOptionalNumber, toOptionalTrimmed } from '../../lib/admin-utils.js';
import {
  ActionButtonLink,
  EmptyBlock,
  EntityCell,
  Field,
  FieldGrid,
  FormSection,
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
} from '../../components/workspace-ui.js';
import {
  ActionMenu,
  BulkActionBar,
  ConfirmDialog,
  DetailHeader,
  FilterChips,
  ReviewSummary,
  SidePanel,
  StatusBadge,
  StepSection,
  TableSkeleton,
  Wizard,
  WizardFooter,
  WizardStepContent,
  WizardStepper,
  type ActionItem,
  type ReviewSection,
  type WizardStep,
} from '../../components/interaction-framework.js';

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

const STATUS_FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
  { label: 'Needs approval', value: 'approval' },
];

const CREATE_WIZARD_STEPS: WizardStep[] = [
  { id: 'basics', title: 'Basics', icon: Blocks },
  { id: 'calculation', title: 'Calculation', icon: Zap },
  { id: 'applicability', title: 'Applicability', icon: Layers },
  { id: 'review', title: 'Review', icon: Eye },
];

/* ─────────────────── Helpers ─── */

function parseJsonRecord(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; }
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

function buildReviewSections(f: DefinitionFormState): ReviewSection[] {
  return [
    {
      title: 'Identity',
      items: [
        { label: 'Code', value: f.code || '\u2014' },
        { label: 'Name', value: f.name || '\u2014' },
        { label: 'Category', value: titleizeToken(f.category) },
        { label: 'Scope', value: titleizeToken(f.scope) },
        { label: 'Description', value: f.description || '\u2014' },
      ],
    },
    {
      title: 'Calculation',
      items: [
        { label: 'Payer', value: titleizeToken(f.payer) },
        { label: 'Beneficiary', value: titleizeToken(f.beneficiary) },
        { label: 'Base type', value: titleizeToken(f.baseType) },
        { label: 'Method', value: titleizeToken(f.calcMethod) },
        { label: 'Priority', value: f.calcPriority },
        { label: 'Refund behavior', value: titleizeToken(f.refundBehavior) },
      ],
    },
    {
      title: 'Applicability',
      items: [
        { label: 'Ledger debit', value: f.ledgerDebitAccountCode || 'Not set' },
        { label: 'Ledger credit', value: f.ledgerCreditAccountCode || 'Not set' },
        { label: 'Effective from', value: f.effectiveFrom },
        { label: 'Effective to', value: f.effectiveTo || 'Open-ended' },
        { label: 'Jurisdiction', value: [f.jurisdictionCountry, f.jurisdictionRegion].filter(Boolean).join(' / ') || 'Global' },
      ],
    },
    {
      title: 'Flags',
      items: [
        { label: 'Taxable', value: f.isTaxable ? 'Yes' : 'No' },
        { label: 'Recoverable', value: f.isRecoverable ? 'Yes' : 'No' },
        { label: 'Requires approval', value: f.requiresApproval ? 'Yes' : 'No' },
        { label: 'Status', value: f.isEnabled ? 'Enabled' : 'Disabled' },
      ],
    },
  ];
}

function getReviewWarnings(f: DefinitionFormState): string[] {
  const warnings: string[] = [];
  if (!f.ledgerDebitAccountCode) warnings.push('No ledger debit account configured');
  if (!f.ledgerCreditAccountCode) warnings.push('No ledger credit account configured');
  if (!f.jurisdictionCountry) warnings.push('No jurisdiction country set \u2014 charge will apply globally');
  if (f.calcPriority === '0' || f.calcPriority === '') warnings.push('Calculation priority is 0 \u2014 may conflict with other charges');
  return warnings;
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
            {a.code} \u2014 {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 Main Component \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

export function AdminCharges() {
  const queryClient = useQueryClient();

  /* \u2500\u2500\u2500 Browse state \u2500\u2500\u2500 */
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* \u2500\u2500\u2500 Panel state \u2500\u2500\u2500 */
  const [detailPanelId, setDetailPanelId] = useState<string | null>(null);
  const [editPanelId, setEditPanelId] = useState<string | null>(null);
  const [rulesPanelId, setRulesPanelId] = useState<string | null>(null);

  /* \u2500\u2500\u2500 Wizard state \u2500\u2500\u2500 */
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardForm, setWizardForm] = useState<DefinitionFormState>(EMPTY_DEFINITION_FORM);
  const [wizardCompleted, setWizardCompleted] = useState<Set<string>>(new Set());

  /* \u2500\u2500\u2500 Edit form state \u2500\u2500\u2500 */
  const [editForm, setEditForm] = useState<DefinitionFormState>(EMPTY_DEFINITION_FORM);

  /* \u2500\u2500\u2500 Confirm state \u2500\u2500\u2500 */
  const [confirmToggle, setConfirmToggle] = useState<{ id: string; name: string; isEnabled: boolean } | null>(null);
  const [confirmBulk, setConfirmBulk] = useState<{ action: 'enable' | 'disable' } | null>(null);

  /* \u2500\u2500\u2500 Rules panel state \u2500\u2500\u2500 */
  const [selectedRuleSetId, setSelectedRuleSetId] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [ruleSetForm, setRuleSetForm] = useState<RuleSetFormState>(EMPTY_RULE_SET_FORM);
  const [ruleForm, setRuleForm] = useState<RuleFormState>(EMPTY_RULE_FORM);
  const [ruleUpdateForm, setRuleUpdateForm] = useState<RuleUpdateFormState>(EMPTY_RULE_UPDATE_FORM);
  const [dependencyForm, setDependencyForm] = useState<DependencyFormState>(EMPTY_DEPENDENCY_FORM);
  const [rulesActiveTab, setRulesActiveTab] = useState<'sets' | 'rules' | 'deps'>('sets');

  /* \u2500\u2500\u2500 Queries \u2500\u2500\u2500 */

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
    queryKey: ['charge-rule-sets', rulesPanelId],
    queryFn: () => apiClient.charges.listRuleSets(rulesPanelId ? { chargeDefinitionId: rulesPanelId } : undefined),
    enabled: Boolean(rulesPanelId),
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['charge-rules', selectedRuleSetId],
    queryFn: () => apiClient.charges.listRules(selectedRuleSetId ? { ruleSetId: selectedRuleSetId } : undefined),
    enabled: Boolean(selectedRuleSetId),
  });

  const { data: dependencies = [] } = useQuery({
    queryKey: ['charge-dependencies', rulesPanelId],
    queryFn: () => apiClient.charges.listDependencies(rulesPanelId ? { chargeDefinitionId: rulesPanelId } : undefined),
    enabled: Boolean(rulesPanelId),
  });

  /* \u2500\u2500\u2500 Derived state \u2500\u2500\u2500 */

  const selectedRule = rules.find((r: any) => r.id === selectedRuleId) ?? null;
  const detailDefinition = definitions.find((d: any) => d.id === detailPanelId) ?? null;
  const editDefinition = definitions.find((d: any) => d.id === editPanelId) ?? null;
  const rulesDefinition = definitions.find((d: any) => d.id === rulesPanelId) ?? null;
  const otherDefinitions = definitions.filter((d: any) => d.id !== rulesPanelId);

  useEffect(() => {
    if (editDefinition) setEditForm(definitionFormFromRecord(editDefinition));
  }, [editDefinition]);

  useEffect(() => {
    if (selectedRule) setRuleUpdateForm(ruleUpdateFormFromRecord(selectedRule));
  }, [selectedRule]);

  useEffect(() => {
    if (!ruleSets.length) { setSelectedRuleSetId(null); return; }
    if (!selectedRuleSetId || !ruleSets.some((r: any) => r.id === selectedRuleSetId))
      setSelectedRuleSetId(ruleSets[0].id);
  }, [ruleSets, selectedRuleSetId]);

  useEffect(() => {
    if (!rules.length) { setSelectedRuleId(null); return; }
    if (!selectedRuleId || !rules.some((r: any) => r.id === selectedRuleId))
      setSelectedRuleId(rules[0].id);
  }, [rules, selectedRuleId]);

  /* \u2500\u2500\u2500 Filtering \u2500\u2500\u2500 */

  const filteredDefinitions = useMemo(() => {
    let list = definitions;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((d: any) =>
        [d.code, d.name, d.category, d.scope, d.payer].some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    if (statusFilter === 'enabled') list = list.filter((d: any) => d.isEnabled);
    if (statusFilter === 'disabled') list = list.filter((d: any) => !d.isEnabled);
    if (statusFilter === 'approval') list = list.filter((d: any) => d.requiresApproval);
    return list;
  }, [definitions, search, statusFilter]);

  /* \u2500\u2500\u2500 Stats \u2500\u2500\u2500 */
  const enabledDefinitions = definitions.filter((d: any) => d.isEnabled).length;
  const approvalDefinitions = definitions.filter((d: any) => d.requiresApproval).length;
  const scopeCoverage = new Set(definitions.map((d: any) => d.scope)).size;

  /* \u2500\u2500\u2500 Selection helpers \u2500\u2500\u2500 */

  const allSelected = filteredDefinitions.length > 0 && filteredDefinitions.every((d: any) => selectedIds.has(d.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDefinitions.map((d: any) => d.id)));
    }
  }, [allSelected, filteredDefinitions]);

  /* \u2500\u2500\u2500 Row actions builder \u2500\u2500\u2500 */

  function rowActions(d: any): ActionItem[] {
    return [
      { label: 'View details', icon: Eye, onClick: () => setDetailPanelId(d.id) },
      { label: 'Edit definition', icon: Edit, onClick: () => setEditPanelId(d.id) },
      { label: 'Manage rules', icon: Layers, onClick: () => { setRulesPanelId(d.id); setRulesActiveTab('sets'); } },
      { label: 'Dependencies', icon: GitBranch, onClick: () => { setRulesPanelId(d.id); setRulesActiveTab('deps'); } },
      {
        label: d.isEnabled ? 'Disable' : 'Enable',
        icon: d.isEnabled ? Pause : Play,
        onClick: () => setConfirmToggle({ id: d.id, name: d.code, isEnabled: d.isEnabled }),
        separator: true,
      },
    ];
  }

  /* \u2500\u2500\u2500 Mutations \u2500\u2500\u2500 */

  const createDefinitionMutation = useMutation({
    mutationFn: async (form: DefinitionFormState) => {
      const payload = {
        code: form.code.trim(), name: form.name.trim(),
        description: toOptionalTrimmed(form.description),
        category: form.category, scope: form.scope,
        payer: form.payer, beneficiary: form.beneficiary,
        baseType: form.baseType as any, calcMethod: form.calcMethod,
        calcPriority: Number(form.calcPriority),
        isTaxable: form.isTaxable, isRecoverable: form.isRecoverable,
        refundBehavior: form.refundBehavior,
        ledgerDebitAccountCode: toOptionalTrimmed(form.ledgerDebitAccountCode),
        ledgerCreditAccountCode: toOptionalTrimmed(form.ledgerCreditAccountCode),
        effectiveFrom: form.effectiveFrom,
        effectiveTo: toOptionalTrimmed(form.effectiveTo),
        jurisdictionMetadata: buildJurisdictionMetadata(form),
        requiresApproval: form.requiresApproval,
      };
      const parsed = createChargeDefinitionSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid definition');
      return apiClient.charges.createDefinition(parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['charge-definitions'] });
      setWizardOpen(false);
      setWizardStep(0);
      setWizardForm(EMPTY_DEFINITION_FORM);
      setWizardCompleted(new Set());
      setMessage('Charge definition created.');
      setErrorMessage(null);
    },
    onError: (e) => setErrorMessage(getErrorMessage(e)),
  });

  const updateDefinitionMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: DefinitionFormState }) => {
      const payload = {
        name: form.name.trim(), description: toOptionalTrimmed(form.description),
        calcPriority: Number(form.calcPriority), refundBehavior: form.refundBehavior,
        effectiveTo: toOptionalTrimmed(form.effectiveTo),
        requiresApproval: form.requiresApproval, isEnabled: form.isEnabled,
      };
      const parsed = updateChargeDefinitionSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid definition update');
      return apiClient.charges.updateDefinition(id, parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['charge-definitions'] });
      setEditPanelId(null);
      setMessage('Definition updated.');
      setErrorMessage(null);
    },
    onError: (e) => setErrorMessage(getErrorMessage(e)),
  });

  const toggleDefinitionMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const parsed = updateChargeDefinitionSchema.safeParse({ isEnabled });
      if (!parsed.success) throw new Error('Invalid toggle');
      return apiClient.charges.updateDefinition(id, parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['charge-definitions'] });
      setConfirmToggle(null);
      setMessage('Definition status updated.');
    },
    onError: (e) => setErrorMessage(getErrorMessage(e)),
  });

  const bulkToggleMutation = useMutation({
    mutationFn: async (action: 'enable' | 'disable') => {
      const isEnabled = action === 'enable';
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => apiClient.charges.updateDefinition(id, { isEnabled })));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['charge-definitions'] });
      setSelectedIds(new Set());
      setConfirmBulk(null);
      setMessage(`Bulk update complete.`);
    },
    onError: (e) => setErrorMessage(getErrorMessage(e)),
  });

  const ruleSetMutation = useMutation({
    mutationFn: async () => {
      if (!rulesPanelId) throw new Error('Select a charge definition first.');
      const payload = {
        chargeDefinitionId: rulesPanelId, name: ruleSetForm.name.trim(),
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
      await queryClient.invalidateQueries({ queryKey: ['charge-rule-sets', rulesPanelId] });
      setSelectedRuleSetId(rs.id);
      setRuleSetForm(EMPTY_RULE_SET_FORM);
      setMessage('Rule set created.');
      setErrorMessage(null);
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
      setSelectedRuleId(r.id);
      setRuleForm(EMPTY_RULE_FORM);
      setMessage('Rule created.');
      setErrorMessage(null);
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
      setMessage('Rule versioned.');
      setErrorMessage(null);
      setRuleUpdateForm((c) => ({ ...c, changeReason: '' }));
    },
    onError: (e) => setErrorMessage(getErrorMessage(e)),
  });

  const dependencyMutation = useMutation({
    mutationFn: async () => {
      if (!rulesPanelId) throw new Error('Select a definition first.');
      const payload = {
        dependentChargeId: rulesPanelId,
        dependsOnChargeId: dependencyForm.dependsOnChargeId,
        dependencyType: dependencyForm.dependencyType,
      };
      const parsed = createChargeDependencySchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid dependency');
      return apiClient.charges.addDependency(parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['charge-dependencies', rulesPanelId] });
      setDependencyForm(EMPTY_DEPENDENCY_FORM);
      setMessage('Dependency added.');
      setErrorMessage(null);
    },
    onError: (e) => setErrorMessage(getErrorMessage(e)),
  });

  /* \u2500\u2500\u2500 Wizard helpers \u2500\u2500\u2500 */

  const openCreateWizard = () => {
    setWizardForm(EMPTY_DEFINITION_FORM);
    setWizardStep(0);
    setWizardCompleted(new Set());
    setWizardOpen(true);
    setMessage(null);
    setErrorMessage(null);
  };

  const handleWizardComplete = () => {
    createDefinitionMutation.mutate(wizardForm);
  };

  /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 Render \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

  return (
    <PageShell>
      <PageHeader
        eyebrow="Charge domain"
        title="Charge studio"
        description="Create, manage, and configure charge definitions, rules, and dependencies."
        actions={
          <>
            <ActionButtonLink to="/admin/charges/simulate" variant="outline">Open simulator</ActionButtonLink>
            <Button onClick={openCreateWizard}>
              <Plus className="mr-1.5 h-4 w-4" />
              New definition
            </Button>
          </>
        }
      />

      {(message || errorMessage) && (
        <Notice message={errorMessage ?? message ?? ''} variant={errorMessage ? 'destructive' : 'success'} />
      )}

      {/* \u2500\u2500\u2500 Stats \u2500\u2500\u2500 */}
      <StatGrid>
        <StatCard label="Definitions" value={definitions.length} hint={`${enabledDefinitions} currently enabled`} icon={Blocks} />
        <StatCard label="Approval tracked" value={approvalDefinitions} hint="Require approval for changes" icon={Scale} tone="warning" />
        <StatCard label="Scope coverage" value={scopeCoverage} hint="Distinct charge scopes" icon={Workflow} tone="info" />
        <StatCard label="Rule sets" value={ruleSets.length} hint="Across all definitions" icon={FileStack} />
      </StatGrid>

      {/* \u2500\u2500\u2500 Filter bar \u2500\u2500\u2500 */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchField value={search} onChange={setSearch} placeholder="Search by code, name, category..." />
        <FilterChips options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
      </div>

      {/* \u2500\u2500\u2500 Bulk actions \u2500\u2500\u2500 */}
      <BulkActionBar selectedCount={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
        <Button variant="outline" size="sm" onClick={() => setConfirmBulk({ action: 'enable' })}>
          <Play className="mr-1.5 h-3.5 w-3.5" /> Enable
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirmBulk({ action: 'disable' })}>
          <Pause className="mr-1.5 h-3.5 w-3.5" /> Disable
        </Button>
      </BulkActionBar>

      {/* \u2500\u2500\u2500 Data table \u2500\u2500\u2500 */}
      <SectionCard title="Definition catalog" description="All charge definitions and their current status.">
        {isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : filteredDefinitions.length === 0 ? (
          <EmptyBlock
            title={search || statusFilter !== 'all' ? 'No definitions match your filters' : 'No charge definitions yet'}
            description={search || statusFilter !== 'all' ? 'Try adjusting your search or filter criteria.' : 'Create your first charge definition to get started.'}
            action={!search && statusFilter === 'all' ? <Button size="sm" onClick={openCreateWizard}><Plus className="mr-1.5 h-3.5 w-3.5" /> Create definition</Button> : undefined}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/60">
            <table className="w-full">
              <thead className="bg-muted/40">
                <tr className="border-b border-border/60 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 p-4">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="p-4">Definition</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Scope</th>
                  <th className="p-4">Payer</th>
                  <th className="p-4">Ledger</th>
                  <th className="p-4">Status</th>
                  <th className="w-12 p-4"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredDefinitions.map((d: any) => (
                  <tr key={d.id}
                    className={cn(
                      'border-b border-border/60 transition-colors hover:bg-muted/40',
                      selectedIds.has(d.id) && 'bg-primary/5',
                    )}
                  >
                    <td className="p-4">
                      <Checkbox
                        checked={selectedIds.has(d.id)}
                        onCheckedChange={() => toggleSelect(d.id)}
                        aria-label={`Select ${d.code}`}
                      />
                    </td>
                    <td className="p-4">
                      <button type="button" onClick={() => setDetailPanelId(d.id)} className="text-left hover:underline">
                        <EntityCell title={d.code} subtitle={d.name} />
                      </button>
                    </td>
                    <td className="p-4"><Badge variant={categoryVariant(d.category)}>{titleizeToken(d.category)}</Badge></td>
                    <td className="p-4 text-sm text-muted-foreground">{titleizeToken(d.scope)}</td>
                    <td className="p-4 text-sm text-muted-foreground">{titleizeToken(d.payer)}</td>
                    <td className="p-4 font-mono text-xs text-muted-foreground">
                      {d.ledgerDebitAccountCode || '\u2014'} / {d.ledgerCreditAccountCode || '\u2014'}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge status={d.isEnabled ? 'active' : 'disabled'} />
                        {d.requiresApproval && <Badge variant="warning">Approval</Badge>}
                      </div>
                    </td>
                    <td className="p-4">
                      <ActionMenu items={rowActions(d)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 DETAIL PANEL \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
      <SidePanel
        open={Boolean(detailPanelId)}
        onOpenChange={(open) => { if (!open) setDetailPanelId(null); }}
        title={detailDefinition?.code ?? 'Definition'}
        description="Charge definition details"
        size="lg"
        footer={
          detailDefinition && (
            <>
              <Button variant="outline" onClick={() => { setEditPanelId(detailPanelId); setDetailPanelId(null); }}>
                <Edit className="mr-1.5 h-4 w-4" /> Edit
              </Button>
              <Button variant="outline" onClick={() => { setRulesPanelId(detailPanelId); setDetailPanelId(null); setRulesActiveTab('sets'); }}>
                <Layers className="mr-1.5 h-4 w-4" /> Manage rules
              </Button>
            </>
          )
        }
      >
        {detailDefinition && (
          <div className="space-y-6">
            <DetailHeader
              title={detailDefinition.name}
              subtitle={detailDefinition.code}
              status={detailDefinition.isEnabled ? 'active' : 'disabled'}
            />
            <InfoGrid>
              <InfoCard label="Category" value={<Badge variant={categoryVariant(detailDefinition.category)}>{titleizeToken(detailDefinition.category)}</Badge>} />
              <InfoCard label="Scope" value={titleizeToken(detailDefinition.scope)} />
              <InfoCard label="Payer" value={titleizeToken(detailDefinition.payer)} />
              <InfoCard label="Beneficiary" value={titleizeToken(detailDefinition.beneficiary)} />
              <InfoCard label="Base type" value={titleizeToken(detailDefinition.baseType)} />
              <InfoCard label="Method" value={titleizeToken(detailDefinition.calcMethod)} />
              <InfoCard label="Priority" value={detailDefinition.calcPriority} />
              <InfoCard label="Refund" value={titleizeToken(detailDefinition.refundBehavior)} />
              <InfoCard label="Ledger DR" value={detailDefinition.ledgerDebitAccountCode || '\u2014'} />
              <InfoCard label="Ledger CR" value={detailDefinition.ledgerCreditAccountCode || '\u2014'} />
              <InfoCard label="Effective from" value={formatDate(detailDefinition.effectiveFrom)} />
              <InfoCard label="Effective to" value={detailDefinition.effectiveTo ? formatDate(detailDefinition.effectiveTo) : 'Open-ended'} />
            </InfoGrid>
            <div className="grid gap-3 lg:grid-cols-4">
              {[
                { label: 'Taxable', value: detailDefinition.isTaxable ? 'Yes' : 'No' },
                { label: 'Recoverable', value: detailDefinition.isRecoverable ? 'Yes' : 'No' },
                { label: 'Approval', value: detailDefinition.requiresApproval ? 'Required' : 'No' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="mt-1 text-sm font-medium">{item.value}</div>
                </div>
              ))}
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="mt-1"><StatusBadge status={detailDefinition.isEnabled ? 'active' : 'disabled'} /></div>
              </div>
            </div>
            {detailDefinition.description && (
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</div>
                <p className="text-sm text-foreground">{detailDefinition.description}</p>
              </div>
            )}
            <InfoGrid>
              <InfoCard label="Created" value={formatDate(detailDefinition.createdAt)} />
              <InfoCard label="Updated" value={formatDate(detailDefinition.updatedAt)} />
            </InfoGrid>
          </div>
        )}
      </SidePanel>

      {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 EDIT PANEL \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
      <SidePanel
        open={Boolean(editPanelId)}
        onOpenChange={(open) => { if (!open) setEditPanelId(null); }}
        title={`Edit ${editDefinition?.code ?? 'definition'}`}
        description="Update mutable fields on this charge definition."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditPanelId(null)}>Cancel</Button>
            <Button loading={updateDefinitionMutation.isPending} onClick={() => {
              if (editPanelId) updateDefinitionMutation.mutate({ id: editPanelId, form: editForm });
            }}>
              Save changes
            </Button>
          </>
        }
      >
        {editDefinition && (
          <div className="space-y-6">
            <FormSection title="Identity" description="Immutable fields are shown but cannot be changed.">
              <FieldGrid>
                <TextField label="Code" value={editForm.code} disabled />
                <TextField label="Name" value={editForm.name} onChange={(e) => setEditForm((c) => ({ ...c, name: e.target.value }))} />
              </FieldGrid>
              <TextareaField label="Description" rows={2} value={editForm.description} onChange={(e) => setEditForm((c) => ({ ...c, description: e.target.value }))} />
            </FormSection>

            <FormSection title="Calculation" description="Adjust priority and refund behavior.">
              <FieldGrid>
                <TextField label="Priority" type="number" value={editForm.calcPriority} onChange={(e) => setEditForm((c) => ({ ...c, calcPriority: e.target.value }))} />
                <Field label="Refund behavior">
                  <Select value={editForm.refundBehavior} onValueChange={(v) => setEditForm((c) => ({ ...c, refundBehavior: v as DefinitionFormState['refundBehavior'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{refundBehaviorSchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </FieldGrid>
            </FormSection>

            <FormSection title="Effective period">
              <FieldGrid>
                <TextField label="Effective from" type="date" value={editForm.effectiveFrom} disabled />
                <TextField label="Effective to" type="date" value={editForm.effectiveTo} onChange={(e) => setEditForm((c) => ({ ...c, effectiveTo: e.target.value }))} />
              </FieldGrid>
            </FormSection>

            <FormSection title="Controls">
              <div className="grid gap-4 lg:grid-cols-2">
                <SwitchField label="Requires approval" description="Changes need approval." checked={editForm.requiresApproval}
                  onCheckedChange={(v) => setEditForm((c) => ({ ...c, requiresApproval: v }))} />
                <SwitchField label="Enabled" description="Part of charge calculations." checked={editForm.isEnabled}
                  onCheckedChange={(v) => setEditForm((c) => ({ ...c, isEnabled: v }))} />
              </div>
            </FormSection>

            <InfoGrid>
              <InfoCard label="Created" value={formatDate(editDefinition.createdAt)} />
              <InfoCard label="Updated" value={formatDate(editDefinition.updatedAt)} />
            </InfoGrid>
          </div>
        )}
      </SidePanel>

      {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 RULES PANEL \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
      <SidePanel
        open={Boolean(rulesPanelId)}
        onOpenChange={(open) => { if (!open) setRulesPanelId(null); }}
        title={`Rules: ${rulesDefinition?.code ?? '\u2014'}`}
        description="Manage rule sets, rules, and dependencies."
        size="xl"
      >
        {rulesDefinition && (
          <div className="space-y-5">
            <div className="flex gap-1.5">
              {(['sets', 'rules', 'deps'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRulesActiveTab(tab)}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-xs font-medium transition-colors',
                    rulesActiveTab === tab
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border/60 text-muted-foreground hover:bg-muted/40',
                  )}
                >
                  {tab === 'sets' ? 'Rule Sets' : tab === 'rules' ? 'Rules' : 'Dependencies'}
                </button>
              ))}
            </div>

            {/* \u2500\u2500 Rule Sets tab \u2500\u2500 */}
            {rulesActiveTab === 'sets' && (
              <div className="space-y-5">
                {ruleSets.length === 0 ? (
                  <EmptyBlock title="No rule sets" description="Create the first rule set for this definition." />
                ) : (
                  <div className="space-y-2">
                    {ruleSets.map((rs: any) => (
                      <button key={rs.id} type="button"
                        className={cn(
                          'w-full rounded-lg border px-4 py-3 text-left transition-colors',
                          rs.id === selectedRuleSetId ? 'border-primary/30 bg-primary/5' : 'border-border/60 hover:bg-muted/35',
                        )}
                        onClick={() => { setSelectedRuleSetId(rs.id); setRulesActiveTab('rules'); }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-foreground">{rs.name}</div>
                          <Badge variant="outline">P{rs.priority ?? 0}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {rs.jurisdictionCountry ?? 'Any country'} / {rs.providerId ? 'Provider-specific' : 'Global'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <FormSection title="Add rule set" description="Define a new scoping selector.">
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
                    <TextField label="Priority" type="number" value={ruleSetForm.priority}
                      onChange={(e) => setRuleSetForm((c) => ({ ...c, priority: e.target.value }))} />
                  </FieldGrid>
                  <Button variant="outline" onClick={() => void ruleSetMutation.mutateAsync()} loading={ruleSetMutation.isPending}>
                    Add rule set
                  </Button>
                </FormSection>
              </div>
            )}

            {/* \u2500\u2500 Rules tab \u2500\u2500 */}
            {rulesActiveTab === 'rules' && (
              <div className="space-y-5">
                {!selectedRuleSetId ? (
                  <EmptyBlock title="Select a rule set" description="Go to the Rule Sets tab and select one." />
                ) : (
                  <>
                    <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-2">
                      <div className="text-xs text-muted-foreground">Editing rules for</div>
                      <div className="text-sm font-semibold text-foreground">
                        {ruleSets.find((r: any) => r.id === selectedRuleSetId)?.name ?? selectedRuleSetId}
                      </div>
                    </div>

                    {rules.length > 0 && (
                      <div className="space-y-2">
                        {rules.map((r: any) => (
                          <button key={r.id} type="button"
                            className={cn(
                              'w-full rounded-lg border px-4 py-3 text-left transition-colors',
                              r.id === selectedRuleId ? 'border-primary/30 bg-primary/5' : 'border-border/60 hover:bg-muted/35',
                            )}
                            onClick={() => setSelectedRuleId(r.id)}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-semibold text-foreground">{titleizeToken(r.calcMethod)}</span>
                              <StatusBadge status={r.isActive ? 'active' : 'inactive'} />
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              v{r.version}{r.rateBps != null ? ` \u00b7 ${r.rateBps} bps` : ''}{r.fixedAmount != null ? ` \u00b7 ${r.fixedAmount} fixed` : ''}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Selected rule maintenance */}
                    {selectedRule && (
                      <div className="space-y-4 rounded-lg border border-border/60 bg-muted/25 p-4">
                        <DetailHeader
                          title={`Rule v${selectedRule.version}`}
                          subtitle={titleizeToken(selectedRule.calcMethod)}
                          status={selectedRule.isActive ? 'active' : 'inactive'}
                        />
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
                          <SwitchField label="Active" description="Keep available."
                            checked={ruleUpdateForm.isActive} onCheckedChange={(v) => setRuleUpdateForm((c) => ({ ...c, isActive: v }))} />
                          <TextareaField label="Change reason" className="md:col-span-2" rows={2} value={ruleUpdateForm.changeReason}
                            onChange={(e) => setRuleUpdateForm((c) => ({ ...c, changeReason: e.target.value }))} placeholder="Why is this changing?" />
                        </FieldGrid>
                        <Button onClick={() => void ruleUpdateMutation.mutateAsync()} loading={ruleUpdateMutation.isPending}>
                          Version rule
                        </Button>
                      </div>
                    )}

                    {/* New rule form */}
                    <FormSection title="Add rule" description="Create a new calculation rule.">
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
                        <TextField label="Min" type="number" value={ruleForm.minAmount}
                          onChange={(e) => setRuleForm((c) => ({ ...c, minAmount: e.target.value }))} />
                        <TextField label="Max" type="number" value={ruleForm.maxAmount}
                          onChange={(e) => setRuleForm((c) => ({ ...c, maxAmount: e.target.value }))} />
                        <TextField label="Effective from" type="date" value={ruleForm.effectiveFrom}
                          onChange={(e) => setRuleForm((c) => ({ ...c, effectiveFrom: e.target.value }))} />
                        <TextField label="Effective to" type="date" value={ruleForm.effectiveTo}
                          onChange={(e) => setRuleForm((c) => ({ ...c, effectiveTo: e.target.value }))} />
                      </FieldGrid>

                      {/* Tier config */}
                      {ruleForm.calcMethod === 'tiered_percentage' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold">Tiers</div>
                            <Button variant="outline" size="sm" onClick={() => setRuleForm((c) => ({ ...c, tiers: [...c.tiers, { ...EMPTY_TIER_ROW }] }))}>
                              <Plus className="mr-1 h-3.5 w-3.5" /> Add tier
                            </Button>
                          </div>
                          {ruleForm.tiers.map((tier, idx) => (
                            <div key={idx} className="rounded-lg border border-border/60 bg-muted/35 p-3">
                              <FieldGrid>
                                <TextField label="From" type="number" value={tier.from}
                                  onChange={(e) => setRuleForm((c) => ({ ...c, tiers: c.tiers.map((t, i) => i === idx ? { ...t, from: e.target.value } : t) }))} />
                                <TextField label="To" type="number" value={tier.to}
                                  onChange={(e) => setRuleForm((c) => ({ ...c, tiers: c.tiers.map((t, i) => i === idx ? { ...t, to: e.target.value } : t) }))} placeholder="Open-ended" />
                                <TextField label="Rate bps" type="number" value={tier.rateBps}
                                  onChange={(e) => setRuleForm((c) => ({ ...c, tiers: c.tiers.map((t, i) => i === idx ? { ...t, rateBps: e.target.value } : t) }))} />
                              </FieldGrid>
                              {ruleForm.tiers.length > 1 && (
                                <Button variant="ghost" size="sm" className="mt-2"
                                  onClick={() => setRuleForm((c) => ({ ...c, tiers: c.tiers.filter((_, i) => i !== idx) }))}>Remove</Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Conditions */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">Conditions</div>
                          <Button variant="outline" size="sm" onClick={() => setRuleForm((c) => ({ ...c, conditions: [...c.conditions, { ...EMPTY_CONDITION_ROW }] }))}>
                            <Plus className="mr-1 h-3.5 w-3.5" /> Add
                          </Button>
                        </div>
                        {ruleForm.conditions.length === 0 && (
                          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                            No conditions \u2014 rule applies whenever the rule set matches.
                          </div>
                        )}
                        {ruleForm.conditions.map((cond, idx) => (
                          <div key={idx} className="rounded-lg border border-border/60 bg-muted/35 p-3">
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
                            <Button variant="ghost" size="sm" className="mt-2"
                              onClick={() => setRuleForm((c) => ({ ...c, conditions: c.conditions.filter((_, i) => i !== idx) }))}>Remove</Button>
                          </div>
                        ))}
                      </div>

                      <SwitchField label="Inclusive" description="Amount already included in base."
                        checked={ruleForm.isInclusive} onCheckedChange={(v) => setRuleForm((c) => ({ ...c, isInclusive: v }))} />

                      <Button variant="outline" onClick={() => void ruleMutation.mutateAsync()} loading={ruleMutation.isPending}>
                        Add rule
                      </Button>
                    </FormSection>
                  </>
                )}
              </div>
            )}

            {/* \u2500\u2500 Dependencies tab \u2500\u2500 */}
            {rulesActiveTab === 'deps' && (
              <div className="space-y-5">
                {dependencies.length === 0 ? (
                  <EmptyBlock title="No dependencies" description="This definition has no upstream dependencies." />
                ) : (
                  <div className="space-y-2">
                    {dependencies.map((dep: any) => {
                      const upstream = definitions.find((d: any) => d.id === dep.dependsOnChargeId);
                      return (
                        <div key={dep.id} className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
                          <div>
                            <div className="text-sm font-medium text-foreground">{upstream?.code ?? dep.dependsOnChargeId.slice(-8)}</div>
                            <div className="text-xs text-muted-foreground">{upstream?.name}</div>
                          </div>
                          <Badge variant="info">{titleizeToken(dep.dependencyType)}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}

                <FormSection title="Add dependency" description={`Add upstream dependency for ${rulesDefinition.code}`}>
                  <Field label="Depends on">
                    <Select value={dependencyForm.dependsOnChargeId || '__none'}
                      onValueChange={(v) => setDependencyForm((c) => ({ ...c, dependsOnChargeId: v === '__none' ? '' : v }))}>
                      <SelectTrigger><SelectValue placeholder="Select definition" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Select definition</SelectItem>
                        {otherDefinitions.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.code} \u2014 {d.name}</SelectItem>)}
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
                </FormSection>
              </div>
            )}
          </div>
        )}
      </SidePanel>

      {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 CREATE WIZARD \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
      <SidePanel
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        title="Create charge definition"
        description="Configure a new charge in a guided workflow."
        size="xl"
      >
        <Wizard
          steps={CREATE_WIZARD_STEPS}
          currentStepIndex={wizardStep}
          onStepChange={setWizardStep}
          completedSteps={wizardCompleted}
          onComplete={handleWizardComplete}
        >
          <div className="space-y-6">
            <WizardStepper />

            {/* \u2500\u2500 Step 1: Basics \u2500\u2500 */}
            <WizardStepContent stepId="basics">
              <StepSection title="Basics" description="Define the identity and classification of this charge.">
                <FieldGrid>
                  <TextField label="Code" value={wizardForm.code}
                    onChange={(e) => setWizardForm((c) => ({ ...c, code: e.target.value.toUpperCase() }))} placeholder="PLATFORM_COMMISSION" />
                  <TextField label="Name" value={wizardForm.name}
                    onChange={(e) => setWizardForm((c) => ({ ...c, name: e.target.value }))} placeholder="Platform commission" />
                  <Field label="Category">
                    <Select value={wizardForm.category} onValueChange={(v) => setWizardForm((c) => ({ ...c, category: v as DefinitionFormState['category'] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{chargeCategorySchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Scope">
                    <Select value={wizardForm.scope} onValueChange={(v) => setWizardForm((c) => ({ ...c, scope: v as DefinitionFormState['scope'] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{chargeScopeSchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </FieldGrid>
                <TextareaField label="Description" rows={3} value={wizardForm.description}
                  onChange={(e) => setWizardForm((c) => ({ ...c, description: e.target.value }))} placeholder="Describe when this charge applies and its purpose." />
              </StepSection>
            </WizardStepContent>

            {/* \u2500\u2500 Step 2: Calculation \u2500\u2500 */}
            <WizardStepContent stepId="calculation">
              <StepSection title="Calculation" description="Define how this charge is computed.">
                <FieldGrid>
                  <Field label="Payer">
                    <Select value={wizardForm.payer} onValueChange={(v) => setWizardForm((c) => ({ ...c, payer: v as DefinitionFormState['payer'] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{chargePayerSchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Beneficiary">
                    <Select value={wizardForm.beneficiary} onValueChange={(v) => setWizardForm((c) => ({ ...c, beneficiary: v as DefinitionFormState['beneficiary'] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{chargeBeneficiarySchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Base type">
                    <Select value={wizardForm.baseType} onValueChange={(v) => setWizardForm((c) => ({ ...c, baseType: v as DefinitionFormState['baseType'] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{chargeBaseTypeSchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Calculation method">
                    <Select value={wizardForm.calcMethod} onValueChange={(v) => setWizardForm((c) => ({ ...c, calcMethod: v as DefinitionFormState['calcMethod'] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{calcMethodSchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <TextField label="Priority" type="number" value={wizardForm.calcPriority}
                    onChange={(e) => setWizardForm((c) => ({ ...c, calcPriority: e.target.value }))} />
                  <Field label="Refund behavior">
                    <Select value={wizardForm.refundBehavior} onValueChange={(v) => setWizardForm((c) => ({ ...c, refundBehavior: v as DefinitionFormState['refundBehavior'] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{refundBehaviorSchema.options.map((o) => <SelectItem key={o} value={o}>{titleizeToken(o)}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </FieldGrid>
                <div className="grid gap-4 lg:grid-cols-2">
                  <SwitchField label="Taxable" description="Charge is tax-bearing." checked={wizardForm.isTaxable}
                    onCheckedChange={(v) => setWizardForm((c) => ({ ...c, isTaxable: v }))} />
                  <SwitchField label="Recoverable" description="Can be recovered later." checked={wizardForm.isRecoverable}
                    onCheckedChange={(v) => setWizardForm((c) => ({ ...c, isRecoverable: v }))} />
                </div>
              </StepSection>
            </WizardStepContent>

            {/* \u2500\u2500 Step 3: Applicability \u2500\u2500 */}
            <WizardStepContent stepId="applicability">
              <StepSection title="Applicability" description="Configure ledger accounts, dates, and jurisdiction.">
                <FieldGrid>
                  <Field label="Ledger debit account">
                    <LedgerAccountSelect value={wizardForm.ledgerDebitAccountCode}
                      onValueChange={(v) => setWizardForm((c) => ({ ...c, ledgerDebitAccountCode: v }))} accounts={ledgerAccounts} />
                  </Field>
                  <Field label="Ledger credit account">
                    <LedgerAccountSelect value={wizardForm.ledgerCreditAccountCode}
                      onValueChange={(v) => setWizardForm((c) => ({ ...c, ledgerCreditAccountCode: v }))} accounts={ledgerAccounts} />
                  </Field>
                  <TextField label="Effective from" type="date" value={wizardForm.effectiveFrom}
                    onChange={(e) => setWizardForm((c) => ({ ...c, effectiveFrom: e.target.value }))} />
                  <TextField label="Effective to" type="date" value={wizardForm.effectiveTo}
                    onChange={(e) => setWizardForm((c) => ({ ...c, effectiveTo: e.target.value }))} />
                </FieldGrid>
                <div className="mt-4 space-y-3">
                  <div className="text-sm font-semibold">Jurisdiction</div>
                  <FieldGrid>
                    <TextField label="Country" value={wizardForm.jurisdictionCountry} maxLength={2}
                      onChange={(e) => setWizardForm((c) => ({ ...c, jurisdictionCountry: e.target.value.toUpperCase() }))} placeholder="KE" />
                    <TextField label="Region" value={wizardForm.jurisdictionRegion}
                      onChange={(e) => setWizardForm((c) => ({ ...c, jurisdictionRegion: e.target.value }))} placeholder="Nairobi" />
                    <TextField label="Tax code" value={wizardForm.jurisdictionTaxCode}
                      onChange={(e) => setWizardForm((c) => ({ ...c, jurisdictionTaxCode: e.target.value.toUpperCase() }))} placeholder="VAT" />
                  </FieldGrid>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <SwitchField label="Requires approval" description="Changes need approval." checked={wizardForm.requiresApproval}
                    onCheckedChange={(v) => setWizardForm((c) => ({ ...c, requiresApproval: v }))} />
                  <SwitchField label="Enabled" description="Active for charge calculations." checked={wizardForm.isEnabled}
                    onCheckedChange={(v) => setWizardForm((c) => ({ ...c, isEnabled: v }))} />
                </div>
              </StepSection>
            </WizardStepContent>

            {/* \u2500\u2500 Step 4: Review \u2500\u2500 */}
            <WizardStepContent stepId="review">
              <StepSection title="Review" description="Verify your configuration before creating the charge definition.">
                <ReviewSummary
                  sections={buildReviewSections(wizardForm)}
                  warnings={getReviewWarnings(wizardForm)}
                />
              </StepSection>
            </WizardStepContent>

            <WizardFooter
              loading={createDefinitionMutation.isPending}
              nextDisabled={wizardStep === 0 && (!wizardForm.code.trim() || !wizardForm.name.trim())}
              finishLabel="Create definition"
              extraActions={
                <Button variant="ghost" onClick={() => setWizardOpen(false)} disabled={createDefinitionMutation.isPending}>
                  Cancel
                </Button>
              }
            />
          </div>
        </Wizard>
      </SidePanel>

      {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 CONFIRM DIALOGS \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}

      {/* Single enable/disable */}
      <ConfirmDialog
        open={Boolean(confirmToggle)}
        onOpenChange={(open) => { if (!open) setConfirmToggle(null); }}
        title={confirmToggle?.isEnabled ? 'Disable charge definition?' : 'Enable charge definition?'}
        description={
          confirmToggle?.isEnabled
            ? `Disabling "${confirmToggle.name}" will exclude it from all future charge calculations.`
            : `Enabling "${confirmToggle?.name}" will include it in charge calculations.`
        }
        variant={confirmToggle?.isEnabled ? 'warning' : 'default'}
        confirmLabel={confirmToggle?.isEnabled ? 'Disable' : 'Enable'}
        loading={toggleDefinitionMutation.isPending}
        onConfirm={() => {
          if (confirmToggle) toggleDefinitionMutation.mutate({ id: confirmToggle.id, isEnabled: !confirmToggle.isEnabled });
        }}
      />

      {/* Bulk enable/disable */}
      <ConfirmDialog
        open={Boolean(confirmBulk)}
        onOpenChange={(open) => { if (!open) setConfirmBulk(null); }}
        title={`${confirmBulk?.action === 'enable' ? 'Enable' : 'Disable'} ${selectedIds.size} definitions?`}
        description={`This will ${confirmBulk?.action ?? 'update'} all ${selectedIds.size} selected charge definitions.`}
        variant={confirmBulk?.action === 'disable' ? 'warning' : 'default'}
        confirmLabel={`${confirmBulk?.action === 'enable' ? 'Enable' : 'Disable'} all`}
        loading={bulkToggleMutation.isPending}
        onConfirm={() => {
          if (confirmBulk) bulkToggleMutation.mutate(confirmBulk.action);
        }}
      />
    </PageShell>
  );
}
