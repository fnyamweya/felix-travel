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
import { Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@felix-travel/ui';
import { Blocks, FileStack, GitBranchPlus, Plus, Scale, Workflow } from 'lucide-react';
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

type TierRowState = {
  from: string;
  to: string;
  rateBps: string;
};

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

const CONDITION_FIELD_OPTIONS: ConditionRowState['field'][] = [
  'booking_amount',
  'provider_id',
  'listing_category',
  'country',
  'region',
  'service_date_day_of_week',
  'guest_count',
];

const CONDITION_OPERATOR_OPTIONS: ConditionRowState['op'][] = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'not_in',
];

const EMPTY_TIER_ROW: TierRowState = {
  from: '0',
  to: '',
  rateBps: '',
};

const EMPTY_CONDITION_ROW: ConditionRowState = {
  field: 'country',
  op: 'eq',
  value: '',
};

const EMPTY_DEFINITION_FORM: DefinitionFormState = {
  code: '',
  name: '',
  description: '',
  category: 'commission',
  scope: 'booking_level',
  payer: 'provider',
  beneficiary: 'platform',
  baseType: 'booking_subtotal',
  calcMethod: 'percentage',
  calcPriority: '100',
  isTaxable: false,
  isRecoverable: false,
  refundBehavior: 'fully_refundable',
  ledgerDebitAccountCode: '',
  ledgerCreditAccountCode: '',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: '',
  jurisdictionCountry: '',
  jurisdictionRegion: '',
  jurisdictionTaxCode: '',
  jurisdictionNotes: '',
  requiresApproval: false,
  isEnabled: true,
};

const EMPTY_RULE_SET_FORM: RuleSetFormState = {
  name: '',
  jurisdictionCountry: '',
  jurisdictionRegion: '',
  providerId: '',
  listingCategory: '',
  minBookingAmount: '',
  maxBookingAmount: '',
  priority: '0',
};

const EMPTY_RULE_FORM: RuleFormState = {
  calcMethod: 'percentage',
  rateBps: '',
  fixedAmount: '',
  currencyCode: 'KES',
  minAmount: '',
  maxAmount: '',
  formula: '',
  tiers: [{ ...EMPTY_TIER_ROW }],
  conditions: [],
  isInclusive: false,
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: '',
};

const EMPTY_RULE_UPDATE_FORM: RuleUpdateFormState = {
  rateBps: '',
  fixedAmount: '',
  minAmount: '',
  maxAmount: '',
  effectiveTo: '',
  isActive: true,
  changeReason: '',
};

const EMPTY_DEPENDENCY_FORM: DependencyFormState = {
  dependsOnChargeId: '',
  dependencyType: 'after',
};

function parseJsonRecord(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function definitionFormFromRecord(definition: any): DefinitionFormState {
  const metadata = parseJsonRecord(definition.jurisdictionMetadata);
  return {
    code: definition.code,
    name: definition.name,
    description: definition.description ?? '',
    category: definition.category,
    scope: definition.scope,
    payer: definition.payer,
    beneficiary: definition.beneficiary,
    baseType: definition.baseType,
    calcMethod: definition.calcMethod,
    calcPriority: String(definition.calcPriority ?? 100),
    isTaxable: Boolean(definition.isTaxable),
    isRecoverable: Boolean(definition.isRecoverable),
    refundBehavior: definition.refundBehavior,
    ledgerDebitAccountCode: definition.ledgerDebitAccountCode ?? '',
    ledgerCreditAccountCode: definition.ledgerCreditAccountCode ?? '',
    effectiveFrom: definition.effectiveFrom,
    effectiveTo: definition.effectiveTo ?? '',
    jurisdictionCountry: String(metadata.country ?? ''),
    jurisdictionRegion: String(metadata.region ?? ''),
    jurisdictionTaxCode: String(metadata.taxCode ?? ''),
    jurisdictionNotes: String(metadata.notes ?? ''),
    requiresApproval: Boolean(definition.requiresApproval),
    isEnabled: Boolean(definition.isEnabled),
  };
}

function ruleUpdateFormFromRecord(rule: any): RuleUpdateFormState {
  return {
    rateBps: rule.rateBps != null ? String(rule.rateBps) : '',
    fixedAmount: rule.fixedAmount != null ? String(rule.fixedAmount) : '',
    minAmount: rule.minAmount != null ? String(rule.minAmount) : '',
    maxAmount: rule.maxAmount != null ? String(rule.maxAmount) : '',
    effectiveTo: rule.effectiveTo ?? '',
    isActive: Boolean(rule.isActive),
    changeReason: '',
  };
}

function buildJurisdictionMetadata(form: DefinitionFormState) {
  const metadata: Record<string, unknown> = {};
  if (form.jurisdictionCountry.trim()) metadata.country = form.jurisdictionCountry.trim().toUpperCase();
  if (form.jurisdictionRegion.trim()) metadata.region = form.jurisdictionRegion.trim();
  if (form.jurisdictionTaxCode.trim()) metadata.taxCode = form.jurisdictionTaxCode.trim().toUpperCase();
  if (form.jurisdictionNotes.trim()) metadata.notes = form.jurisdictionNotes.trim();
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function isNumericConditionField(field: ConditionRowState['field']) {
  return field === 'booking_amount' || field === 'guest_count';
}

function buildConditionValue(condition: ConditionRowState) {
  if (condition.op === 'in' || condition.op === 'not_in') {
    return condition.value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (isNumericConditionField(condition.field)) {
    return Number(condition.value);
  }

  return condition.value.trim();
}

function buildTierConfig(tiers: TierRowState[]) {
  const cleaned = tiers.filter((tier) => tier.rateBps.trim() || tier.to.trim() || tier.from.trim());
  if (!cleaned.length) return undefined;
  return {
    tiers: cleaned.map((tier) => ({
      from: Number(tier.from || '0'),
      to: tier.to.trim() ? Number(tier.to) : null,
      rateBps: Number(tier.rateBps),
    })),
  };
}

function categoryVariant(category: string): 'info' | 'warning' | 'secondary' | 'success' | 'destructive' {
  if (['commission', 'fx'].includes(category)) return 'info';
  if (['tax', 'duty', 'levy'].includes(category)) return 'warning';
  if (category === 'discount') return 'success';
  if (category === 'withholding') return 'destructive';
  return 'secondary';
}

export function AdminCharges() {
  const queryClient = useQueryClient();
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

  const { data: definitions = [], isLoading } = useQuery({
    queryKey: ['charge-definitions'],
    queryFn: () => apiClient.charges.listDefinitions(),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['admin-providers'],
    queryFn: () => apiClient.providers.list(),
  });

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

  const selectedDefinition = definitions.find((definition: any) => definition.id === selectedDefinitionId) ?? null;
  const selectedRuleSet = ruleSets.find((ruleSet: any) => ruleSet.id === selectedRuleSetId) ?? null;
  const selectedRule = rules.find((rule: any) => rule.id === selectedRuleId) ?? null;

  useEffect(() => {
    if (!definitions.length || selectedDefinitionId || isCreatingDefinition) return;
    setSelectedDefinitionId(definitions[0].id);
  }, [definitions, selectedDefinitionId, isCreatingDefinition]);

  useEffect(() => {
    if (selectedDefinition) {
      setDefinitionForm(definitionFormFromRecord(selectedDefinition));
      return;
    }
    setDefinitionForm(EMPTY_DEFINITION_FORM);
  }, [selectedDefinition, isCreatingDefinition]);

  useEffect(() => {
    if (!ruleSets.length) {
      setSelectedRuleSetId(null);
      return;
    }

    if (!selectedRuleSetId || !ruleSets.some((ruleSet: any) => ruleSet.id === selectedRuleSetId)) {
      setSelectedRuleSetId(ruleSets[0].id);
    }
  }, [ruleSets, selectedRuleSetId]);

  useEffect(() => {
    if (!rules.length) {
      setSelectedRuleId(null);
      setRuleUpdateForm(EMPTY_RULE_UPDATE_FORM);
      return;
    }

    if (!selectedRuleId || !rules.some((rule: any) => rule.id === selectedRuleId)) {
      setSelectedRuleId(rules[0].id);
    }
  }, [rules, selectedRuleId]);

  useEffect(() => {
    if (!selectedRule) return;
    setRuleUpdateForm(ruleUpdateFormFromRecord(selectedRule));
  }, [selectedRule]);

  const filteredDefinitions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return definitions;
    return definitions.filter((definition: any) =>
      [definition.code, definition.name, definition.category, definition.scope, definition.payer]
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [definitions, search]);

  const enabledDefinitions = definitions.filter((definition: any) => definition.isEnabled).length;
  const approvalDefinitions = definitions.filter((definition: any) => definition.requiresApproval).length;
  const scopeCoverage = new Set(definitions.map((definition: any) => definition.scope)).size;

  const definitionMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: definitionForm.code.trim(),
        name: definitionForm.name.trim(),
        description: toOptionalTrimmed(definitionForm.description),
        category: definitionForm.category,
        scope: definitionForm.scope,
        payer: definitionForm.payer,
        beneficiary: definitionForm.beneficiary,
        baseType: definitionForm.baseType as any,
        calcMethod: definitionForm.calcMethod,
        calcPriority: Number(definitionForm.calcPriority),
        isTaxable: definitionForm.isTaxable,
        isRecoverable: definitionForm.isRecoverable,
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
        name: payload.name,
        description: payload.description,
        calcPriority: payload.calcPriority,
        refundBehavior: payload.refundBehavior,
        effectiveTo: payload.effectiveTo,
        requiresApproval: payload.requiresApproval,
        isEnabled: definitionForm.isEnabled,
      };
      const parsed = updateChargeDefinitionSchema.safeParse(updatePayload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid definition update');
      return apiClient.charges.updateDefinition(selectedDefinition.id, parsed.data);
    },
    onSuccess: async (definition: any) => {
      await queryClient.invalidateQueries({ queryKey: ['charge-definitions'] });
      if (definition?.id) setSelectedDefinitionId(definition.id);
      setIsCreatingDefinition(false);
      setMessage(selectedDefinition && !isCreatingDefinition ? 'Definition updated.' : 'Definition created.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const ruleSetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDefinitionId) throw new Error('Select a charge definition first.');
      const payload = {
        chargeDefinitionId: selectedDefinitionId,
        name: ruleSetForm.name.trim(),
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
    onSuccess: async (ruleSet: any) => {
      await queryClient.invalidateQueries({ queryKey: ['charge-rule-sets', selectedDefinitionId] });
      setSelectedRuleSetId(ruleSet.id);
      setRuleSetForm(EMPTY_RULE_SET_FORM);
      setMessage('Rule set created.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const ruleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRuleSetId) throw new Error('Select a rule set first.');
      const payload = {
        ruleSetId: selectedRuleSetId,
        calcMethod: ruleForm.calcMethod,
        rateBps: toOptionalNumber(ruleForm.rateBps),
        fixedAmount: toOptionalNumber(ruleForm.fixedAmount),
        currencyCode: toOptionalTrimmed(ruleForm.currencyCode)?.toUpperCase(),
        minAmount: toOptionalNumber(ruleForm.minAmount),
        maxAmount: toOptionalNumber(ruleForm.maxAmount),
        formula: toOptionalTrimmed(ruleForm.formula),
        tieredConfig: buildTierConfig(ruleForm.tiers),
        conditions: ruleForm.conditions
          .filter((condition) => condition.value.trim())
          .map((condition) => ({
            field: condition.field,
            op: condition.op,
            value: buildConditionValue(condition),
          })),
        isInclusive: ruleForm.isInclusive,
        effectiveFrom: ruleForm.effectiveFrom,
        effectiveTo: toOptionalTrimmed(ruleForm.effectiveTo),
      };
      const parsed = createChargeRuleSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid rule');
      return apiClient.charges.createRule(parsed.data);
    },
    onSuccess: async (rule: any) => {
      await queryClient.invalidateQueries({ queryKey: ['charge-rules', selectedRuleSetId] });
      setSelectedRuleId(rule.id);
      setRuleForm(EMPTY_RULE_FORM);
      setMessage('Rule created.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const ruleUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRuleId) throw new Error('Select a rule first.');
      const payload = {
        rateBps: toOptionalNumber(ruleUpdateForm.rateBps),
        fixedAmount: toOptionalNumber(ruleUpdateForm.fixedAmount),
        minAmount: toOptionalNumber(ruleUpdateForm.minAmount),
        maxAmount: toOptionalNumber(ruleUpdateForm.maxAmount),
        effectiveTo: toOptionalTrimmed(ruleUpdateForm.effectiveTo),
        isActive: ruleUpdateForm.isActive,
        changeReason: ruleUpdateForm.changeReason.trim(),
      };
      const parsed = updateChargeRuleSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid rule update');
      return apiClient.charges.updateRule(selectedRuleId, parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['charge-rules', selectedRuleSetId] });
      setMessage('Rule updated.');
      setErrorMessage(null);
      setRuleUpdateForm((current) => ({ ...current, changeReason: '' }));
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
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
      setMessage('Dependency added.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const otherDefinitions = definitions.filter((definition: any) => definition.id !== selectedDefinitionId);
  const selectedRuleConditions = selectedRule ? parseJsonArray<ConditionRowState>(selectedRule.conditions) : [];
  const selectedRuleTiers = selectedRule ? parseJsonRecord(selectedRule.tieredConfig) : {};
  const selectedRuleTierRows = Array.isArray((selectedRuleTiers as any).tiers) ? (selectedRuleTiers as any).tiers as Array<{ from: number; to: number | null; rateBps: number }> : [];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Charge domain"
        title="Charge studio"
        description="Manage the charge engine in structured layers: definitions, rule sets, executable rules, and cross-charge dependencies. The controls below mirror the validation schema without exposing raw JSON inputs."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreatingDefinition(true);
                setSelectedDefinitionId(null);
                setSelectedRuleSetId(null);
                setSelectedRuleId(null);
                setDefinitionForm(EMPTY_DEFINITION_FORM);
                setRuleSetForm(EMPTY_RULE_SET_FORM);
                setRuleForm(EMPTY_RULE_FORM);
                setRuleUpdateForm(EMPTY_RULE_UPDATE_FORM);
                setDependencyForm(EMPTY_DEPENDENCY_FORM);
                setMessage('Ready to create a new charge definition.');
                setErrorMessage(null);
              }}
            >
              New definition
            </Button>
            <ActionButtonLink to="/admin/charges/simulate">Open simulator</ActionButtonLink>
          </>
        }
      />

      {(message || errorMessage) ? (
        <Notice message={errorMessage ?? message ?? ''} variant={errorMessage ? 'destructive' : 'success'} />
      ) : null}

      <StatGrid>
        <StatCard label="Definitions" value={definitions.length} hint={`${enabledDefinitions} currently enabled for new calculations`} icon={Blocks} />
        <StatCard label="Approval tracked" value={approvalDefinitions} hint="Definitions that require approval for material changes" icon={Scale} tone="warning" />
        <StatCard label="Rule sets" value={ruleSets.length} hint={selectedDefinition ? `Attached to ${selectedDefinition.code}` : 'Select a definition to inspect coverage'} icon={FileStack} tone="info" />
        <StatCard label="Scope coverage" value={scopeCoverage} hint="Distinct charge scopes configured in the engine" icon={Workflow} />
      </StatGrid>

      <WorkspaceGrid
        main={
          <SectionCard
            title="Definition catalog"
            description="Find a charge family quickly, then inspect its rules and dependencies."
            action={<SearchField value={search} onChange={setSearch} placeholder="Search definitions" />}
          >
            <DataTable headers={['Definition', 'Category', 'Scope', 'Payer', 'Status']}>
              {isLoading && <DataTableEmpty colSpan={5} label="Loading definitions..." />}
              {!isLoading && filteredDefinitions.length === 0 && <DataTableEmpty colSpan={5} label="No definitions match the current search." />}
              {filteredDefinitions.map((definition: any) => (
                <tr
                  key={definition.id}
                  className={definition.id === selectedDefinitionId ? 'border-b border-border/60 bg-primary/5' : 'border-b border-border/60'}
                  onClick={() => {
                    setIsCreatingDefinition(false);
                    setSelectedDefinitionId(definition.id);
                  }}
                >
                  <td className="cursor-pointer p-4">
                    <EntityCell title={definition.code} subtitle={definition.name} />
                  </td>
                  <td className="p-4"><Badge variant={categoryVariant(definition.category)}>{titleizeToken(definition.category)}</Badge></td>
                  <td className="p-4 text-sm text-muted-foreground">{titleizeToken(definition.scope)}</td>
                  <td className="p-4 text-sm text-muted-foreground">{titleizeToken(definition.payer)}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={definition.isEnabled ? 'success' : 'destructive'}>{definition.isEnabled ? 'Enabled' : 'Disabled'}</Badge>
                      {definition.requiresApproval ? <Badge variant="warning">Approval</Badge> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </SectionCard>
        }
        side={
          <SectionCard
            title={selectedDefinition && !isCreatingDefinition ? 'Edit definition' : 'Create definition'}
            description="Core identity fields are fixed after creation; lifecycle controls stay editable."
            action={
              <Button onClick={() => void definitionMutation.mutateAsync()} loading={definitionMutation.isPending}>
                {selectedDefinition && !isCreatingDefinition ? 'Save definition' : 'Create definition'}
              </Button>
            }
          >
            <div className="space-y-6">
              <FieldGrid>
                <TextField label="Code" value={definitionForm.code} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="PLATFORM_COMMISSION" />
                <TextField label="Name" value={definitionForm.name} onChange={(event) => setDefinitionForm((current) => ({ ...current, name: event.target.value }))} placeholder="Platform commission" />
                <Field label="Category">
                  <Select value={definitionForm.category} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onValueChange={(value) => setDefinitionForm((current) => ({ ...current, category: value as DefinitionFormState['category'] }))}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {chargeCategorySchema.options.map((option) => (
                        <SelectItem key={option} value={option}>{titleizeToken(option)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Scope">
                  <Select value={definitionForm.scope} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onValueChange={(value) => setDefinitionForm((current) => ({ ...current, scope: value as DefinitionFormState['scope'] }))}>
                    <SelectTrigger><SelectValue placeholder="Select scope" /></SelectTrigger>
                    <SelectContent>
                      {chargeScopeSchema.options.map((option) => (
                        <SelectItem key={option} value={option}>{titleizeToken(option)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Payer">
                  <Select value={definitionForm.payer} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onValueChange={(value) => setDefinitionForm((current) => ({ ...current, payer: value as DefinitionFormState['payer'] }))}>
                    <SelectTrigger><SelectValue placeholder="Select payer" /></SelectTrigger>
                    <SelectContent>
                      {chargePayerSchema.options.map((option) => (
                        <SelectItem key={option} value={option}>{titleizeToken(option)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Beneficiary">
                  <Select value={definitionForm.beneficiary} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onValueChange={(value) => setDefinitionForm((current) => ({ ...current, beneficiary: value as DefinitionFormState['beneficiary'] }))}>
                    <SelectTrigger><SelectValue placeholder="Select beneficiary" /></SelectTrigger>
                    <SelectContent>
                      {chargeBeneficiarySchema.options.map((option) => (
                        <SelectItem key={option} value={option}>{titleizeToken(option)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Base type">
                  <Select value={definitionForm.baseType} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onValueChange={(value) => setDefinitionForm((current) => ({ ...current, baseType: value as DefinitionFormState['baseType'] }))}>
                    <SelectTrigger><SelectValue placeholder="Select base type" /></SelectTrigger>
                    <SelectContent>
                      {chargeBaseTypeSchema.options.map((option) => (
                        <SelectItem key={option} value={option}>{titleizeToken(option)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Calculation method">
                  <Select value={definitionForm.calcMethod} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onValueChange={(value) => setDefinitionForm((current) => ({ ...current, calcMethod: value as DefinitionFormState['calcMethod'] }))}>
                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent>
                      {calcMethodSchema.options.map((option) => (
                        <SelectItem key={option} value={option}>{titleizeToken(option)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <TextField label="Priority" type="number" value={definitionForm.calcPriority} onChange={(event) => setDefinitionForm((current) => ({ ...current, calcPriority: event.target.value }))} />
                <Field label="Refund behavior">
                  <Select value={definitionForm.refundBehavior} onValueChange={(value) => setDefinitionForm((current) => ({ ...current, refundBehavior: value as DefinitionFormState['refundBehavior'] }))}>
                    <SelectTrigger><SelectValue placeholder="Select behavior" /></SelectTrigger>
                    <SelectContent>
                      {refundBehaviorSchema.options.map((option) => (
                        <SelectItem key={option} value={option}>{titleizeToken(option)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <TextField label="Effective from" type="date" value={definitionForm.effectiveFrom} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, effectiveFrom: event.target.value }))} />
                <TextField label="Effective to" type="date" value={definitionForm.effectiveTo} onChange={(event) => setDefinitionForm((current) => ({ ...current, effectiveTo: event.target.value }))} />
                <TextField label="Debit account" value={definitionForm.ledgerDebitAccountCode} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, ledgerDebitAccountCode: event.target.value }))} placeholder="ACCOUNTS_RECEIVABLE" />
                <TextField label="Credit account" value={definitionForm.ledgerCreditAccountCode} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, ledgerCreditAccountCode: event.target.value }))} placeholder="COMMISSION_REVENUE" />
                <TextareaField label="Description" className="md:col-span-2" rows={3} value={definitionForm.description} onChange={(event) => setDefinitionForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe when this charge applies and why it exists." />
              </FieldGrid>

              <FieldGrid>
                <TextField label="Jurisdiction country" value={definitionForm.jurisdictionCountry} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} maxLength={2} onChange={(event) => setDefinitionForm((current) => ({ ...current, jurisdictionCountry: event.target.value.toUpperCase() }))} placeholder="KE" />
                <TextField label="Region" value={definitionForm.jurisdictionRegion} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, jurisdictionRegion: event.target.value }))} placeholder="Nairobi" />
                <TextField label="Tax code" value={definitionForm.jurisdictionTaxCode} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, jurisdictionTaxCode: event.target.value.toUpperCase() }))} placeholder="VAT" />
                <TextareaField label="Notes" className="md:col-span-2" rows={3} value={definitionForm.jurisdictionNotes} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, jurisdictionNotes: event.target.value }))} placeholder="Describe jurisdiction-specific handling or policy notes." />
              </FieldGrid>

              <div className="grid gap-4 xl:grid-cols-2">
                <SwitchField label="Taxable" description="Flag the charge as tax-bearing for downstream calculations." checked={definitionForm.isTaxable} onCheckedChange={(value) => setDefinitionForm((current) => ({ ...current, isTaxable: value }))} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} />
                <SwitchField label="Recoverable" description="Allow the charge to be recovered through later finance workflows." checked={definitionForm.isRecoverable} onCheckedChange={(value) => setDefinitionForm((current) => ({ ...current, isRecoverable: value }))} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} />
                <SwitchField label="Needs approval" description="Track definition changes through an approval-aware workflow." checked={definitionForm.requiresApproval} onCheckedChange={(value) => setDefinitionForm((current) => ({ ...current, requiresApproval: value }))} />
                <SwitchField label="Enabled" description="Allow the definition to participate in new charge calculations." checked={definitionForm.isEnabled} onCheckedChange={(value) => setDefinitionForm((current) => ({ ...current, isEnabled: value }))} />
              </div>

              {selectedDefinition && !isCreatingDefinition ? (
                <InfoGrid>
                  <InfoCard label="Created" value={formatDate(selectedDefinition.createdAt)} />
                  <InfoCard label="Updated" value={formatDate(selectedDefinition.updatedAt)} />
                  <InfoCard label="Scope" value={titleizeToken(selectedDefinition.scope)} />
                  <InfoCard label="Payer" value={titleizeToken(selectedDefinition.payer)} />
                </InfoGrid>
              ) : null}
            </div>
          </SectionCard>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Rule sets"
          description="Attach jurisdiction, provider, and booking-window selectors to the active definition."
          action={selectedDefinition ? <Badge variant="info">{selectedDefinition.code}</Badge> : null}
        >
          {!selectedDefinition ? (
            <EmptyBlock title="Select a definition" description="Choose a definition from the catalog before creating rule sets." />
          ) : (
            <div className="space-y-5">
              <div className="space-y-3">
                {ruleSets.length === 0 && <EmptyBlock title="No rule sets yet" description="Create the first rule set for this charge definition." />}
                {ruleSets.map((ruleSet: any) => (
                  <button
                    key={ruleSet.id}
                    type="button"
                    className={ruleSet.id === selectedRuleSetId ? 'rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4 text-left' : 'rounded-2xl border border-border/60 bg-background px-4 py-4 text-left hover:bg-muted/35'}
                    onClick={() => setSelectedRuleSetId(ruleSet.id)}
                  >
                    <div className="text-sm font-semibold text-foreground">{ruleSet.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {ruleSet.jurisdictionCountry ?? 'Any country'} / {ruleSet.providerId ? 'Provider-specific' : 'Global'}
                    </div>
                  </button>
                ))}
              </div>

              <FieldGrid>
                <TextField label="Name" className="md:col-span-2" value={ruleSetForm.name} onChange={(event) => setRuleSetForm((current) => ({ ...current, name: event.target.value }))} placeholder="Default Kenya marketplace" />
                <TextField label="Country" value={ruleSetForm.jurisdictionCountry} maxLength={2} onChange={(event) => setRuleSetForm((current) => ({ ...current, jurisdictionCountry: event.target.value.toUpperCase() }))} placeholder="KE" />
                <TextField label="Region" value={ruleSetForm.jurisdictionRegion} onChange={(event) => setRuleSetForm((current) => ({ ...current, jurisdictionRegion: event.target.value }))} placeholder="Nairobi" />
                <Field label="Provider">
                  <Select value={ruleSetForm.providerId || '__any'} onValueChange={(value) => setRuleSetForm((current) => ({ ...current, providerId: value === '__any' ? '' : value }))}>
                    <SelectTrigger><SelectValue placeholder="Any provider" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">Any provider</SelectItem>
                      {providers.map((provider: any) => (
                        <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <TextField label="Listing category" value={ruleSetForm.listingCategory} onChange={(event) => setRuleSetForm((current) => ({ ...current, listingCategory: event.target.value }))} placeholder="flight" />
                <TextField label="Min booking amount" type="number" value={ruleSetForm.minBookingAmount} onChange={(event) => setRuleSetForm((current) => ({ ...current, minBookingAmount: event.target.value }))} />
                <TextField label="Max booking amount" type="number" value={ruleSetForm.maxBookingAmount} onChange={(event) => setRuleSetForm((current) => ({ ...current, maxBookingAmount: event.target.value }))} />
                <TextField label="Priority" className="md:col-span-2" type="number" value={ruleSetForm.priority} onChange={(event) => setRuleSetForm((current) => ({ ...current, priority: event.target.value }))} />
              </FieldGrid>

              <Button variant="outline" onClick={() => void ruleSetMutation.mutateAsync()} loading={ruleSetMutation.isPending}>
                Add rule set
              </Button>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Rules"
          description="Create executable rates for the selected rule set and version them with change reasons."
          action={selectedRuleSet ? <Badge variant="info">{selectedRuleSet.name}</Badge> : null}
        >
          {!selectedRuleSet ? (
            <EmptyBlock title="Select a rule set" description="Choose a rule set before creating or versioning charge rules." />
          ) : (
            <div className="space-y-5">
              <div className="space-y-3">
                {rules.length === 0 && <EmptyBlock title="No rules attached" description="Add the first executable rule for this rule set." />}
                {rules.map((rule: any) => (
                  <button
                    key={rule.id}
                    type="button"
                    className={rule.id === selectedRuleId ? 'rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4 text-left' : 'rounded-2xl border border-border/60 bg-background px-4 py-4 text-left hover:bg-muted/35'}
                    onClick={() => setSelectedRuleId(rule.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-foreground">{titleizeToken(rule.calcMethod)}</div>
                      <Badge variant={rule.isActive ? 'success' : 'secondary'}>{rule.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">Version {rule.version}</div>
                  </button>
                ))}
              </div>

              <FieldGrid>
                <Field label="Method">
                  <Select value={ruleForm.calcMethod} onValueChange={(value) => setRuleForm((current) => ({ ...current, calcMethod: value as RuleFormState['calcMethod'] }))}>
                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent>
                      {calcMethodSchema.options.map((option) => (
                        <SelectItem key={option} value={option}>{titleizeToken(option)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <TextField label="Rate bps" type="number" value={ruleForm.rateBps} onChange={(event) => setRuleForm((current) => ({ ...current, rateBps: event.target.value }))} placeholder="1000" />
                <TextField label="Fixed amount" type="number" value={ruleForm.fixedAmount} onChange={(event) => setRuleForm((current) => ({ ...current, fixedAmount: event.target.value }))} placeholder="5000" />
                <TextField label="Currency" value={ruleForm.currencyCode} maxLength={3} onChange={(event) => setRuleForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} />
                <TextField label="Min amount" type="number" value={ruleForm.minAmount} onChange={(event) => setRuleForm((current) => ({ ...current, minAmount: event.target.value }))} />
                <TextField label="Max amount" type="number" value={ruleForm.maxAmount} onChange={(event) => setRuleForm((current) => ({ ...current, maxAmount: event.target.value }))} />
                <TextField label="Effective from" type="date" value={ruleForm.effectiveFrom} onChange={(event) => setRuleForm((current) => ({ ...current, effectiveFrom: event.target.value }))} />
                <TextField label="Effective to" type="date" value={ruleForm.effectiveTo} onChange={(event) => setRuleForm((current) => ({ ...current, effectiveTo: event.target.value }))} />
                <TextField label="Formula" className="md:col-span-2" value={ruleForm.formula} onChange={(event) => setRuleForm((current) => ({ ...current, formula: event.target.value }))} placeholder="base_amount * 0.015" />
              </FieldGrid>

              {ruleForm.calcMethod === 'tiered_percentage' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">Tiered configuration</div>
                    <Button variant="outline" size="sm" onClick={() => setRuleForm((current) => ({ ...current, tiers: [...current.tiers, { ...EMPTY_TIER_ROW }] }))}>
                      <Plus className="h-4 w-4" />
                      Add tier
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {ruleForm.tiers.map((tier, index) => (
                      <div key={`${tier.from}-${index}`} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                        <FieldGrid>
                          <TextField label="From" type="number" value={tier.from} onChange={(event) => setRuleForm((current) => ({
                            ...current,
                            tiers: current.tiers.map((item, itemIndex) => itemIndex === index ? { ...item, from: event.target.value } : item),
                          }))} />
                          <TextField label="To" type="number" value={tier.to} onChange={(event) => setRuleForm((current) => ({
                            ...current,
                            tiers: current.tiers.map((item, itemIndex) => itemIndex === index ? { ...item, to: event.target.value } : item),
                          }))} placeholder="Leave blank for open-ended" />
                          <TextField label="Rate bps" type="number" value={tier.rateBps} onChange={(event) => setRuleForm((current) => ({
                            ...current,
                            tiers: current.tiers.map((item, itemIndex) => itemIndex === index ? { ...item, rateBps: event.target.value } : item),
                          }))} />
                        </FieldGrid>
                        {ruleForm.tiers.length > 1 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-3"
                            onClick={() => setRuleForm((current) => ({ ...current, tiers: current.tiers.filter((_, itemIndex) => itemIndex !== index) }))}
                          >
                            Remove tier
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-foreground">Rule conditions</div>
                  <Button variant="outline" size="sm" onClick={() => setRuleForm((current) => ({ ...current, conditions: [...current.conditions, { ...EMPTY_CONDITION_ROW }] }))}>
                    <Plus className="h-4 w-4" />
                    Add condition
                  </Button>
                </div>
                {ruleForm.conditions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                    No conditions. The rule will apply whenever the rule set matches.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ruleForm.conditions.map((condition, index) => (
                      <div key={`${condition.field}-${condition.op}-${index}`} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                        <FieldGrid>
                          <Field label="Field">
                            <Select value={condition.field} onValueChange={(value) => setRuleForm((current) => ({
                              ...current,
                              conditions: current.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, field: value as ConditionRowState['field'] } : item),
                            }))}>
                              <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
                              <SelectContent>
                                {CONDITION_FIELD_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>{titleizeToken(option)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field label="Operator">
                            <Select value={condition.op} onValueChange={(value) => setRuleForm((current) => ({
                              ...current,
                              conditions: current.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, op: value as ConditionRowState['op'] } : item),
                            }))}>
                              <SelectTrigger><SelectValue placeholder="Select operator" /></SelectTrigger>
                              <SelectContent>
                                {CONDITION_OPERATOR_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>{titleizeToken(option)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <TextField
                            label={condition.op === 'in' || condition.op === 'not_in' ? 'Value list (comma separated)' : 'Value'}
                            className="md:col-span-2"
                            value={condition.value}
                            onChange={(event) => setRuleForm((current) => ({
                              ...current,
                              conditions: current.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item),
                            }))}
                            placeholder={isNumericConditionField(condition.field) ? '10000' : 'KE or safari,flight'}
                          />
                        </FieldGrid>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-3"
                          onClick={() => setRuleForm((current) => ({ ...current, conditions: current.conditions.filter((_, itemIndex) => itemIndex !== index) }))}
                        >
                          Remove condition
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <SwitchField label="Inclusive charge" description="Treat the rule amount as already included in the base amount." checked={ruleForm.isInclusive} onCheckedChange={(value) => setRuleForm((current) => ({ ...current, isInclusive: value }))} />

              <Button variant="outline" onClick={() => void ruleMutation.mutateAsync()} loading={ruleMutation.isPending}>
                Add rule
              </Button>

              {selectedRule ? (
                <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/25 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Selected rule maintenance</div>
                      <div className="mt-1 text-sm text-muted-foreground">Version the active rule with a clear change reason.</div>
                    </div>
                    <Badge variant={selectedRule.isActive ? 'success' : 'secondary'}>{selectedRule.isActive ? 'Active' : 'Inactive'}</Badge>
                  </div>

                  <FieldGrid>
                    <TextField label="Rate bps" type="number" value={ruleUpdateForm.rateBps} onChange={(event) => setRuleUpdateForm((current) => ({ ...current, rateBps: event.target.value }))} />
                    <TextField label="Fixed amount" type="number" value={ruleUpdateForm.fixedAmount} onChange={(event) => setRuleUpdateForm((current) => ({ ...current, fixedAmount: event.target.value }))} />
                    <TextField label="Min amount" type="number" value={ruleUpdateForm.minAmount} onChange={(event) => setRuleUpdateForm((current) => ({ ...current, minAmount: event.target.value }))} />
                    <TextField label="Max amount" type="number" value={ruleUpdateForm.maxAmount} onChange={(event) => setRuleUpdateForm((current) => ({ ...current, maxAmount: event.target.value }))} />
                    <TextField label="Effective to" type="date" value={ruleUpdateForm.effectiveTo} onChange={(event) => setRuleUpdateForm((current) => ({ ...current, effectiveTo: event.target.value }))} />
                    <SwitchField label="Rule active" description="Keep this version available for the engine to execute." checked={ruleUpdateForm.isActive} onCheckedChange={(value) => setRuleUpdateForm((current) => ({ ...current, isActive: value }))} />
                    <TextareaField label="Change reason" className="md:col-span-2" rows={3} value={ruleUpdateForm.changeReason} onChange={(event) => setRuleUpdateForm((current) => ({ ...current, changeReason: event.target.value }))} placeholder="Explain why the rate is changing." />
                  </FieldGrid>

                  {(selectedRuleConditions.length > 0 || selectedRuleTierRows.length > 0) ? (
                    <InfoGrid>
                      <InfoCard
                        label="Conditions"
                        value={selectedRuleConditions.length > 0 ? selectedRuleConditions.map((condition) => `${titleizeToken(condition.field)} ${titleizeToken(condition.op)} ${String(condition.value)}`).join(' / ') : 'None'}
                      />
                      <InfoCard
                        label="Tiering"
                        value={selectedRuleTierRows.length > 0 ? selectedRuleTierRows.map((tier) => `${tier.from}-${tier.to ?? 'max'}: ${tier.rateBps} bps`).join(' / ') : 'Not tiered'}
                      />
                    </InfoGrid>
                  ) : null}

                  <Button onClick={() => void ruleUpdateMutation.mutateAsync()} loading={ruleUpdateMutation.isPending}>
                    Version rule
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Dependencies"
          description="Control sequencing and base relationships between charge definitions."
          action={selectedDefinition ? <Badge variant="info">{selectedDefinition.code}</Badge> : null}
        >
          {!selectedDefinition ? (
            <EmptyBlock title="Select a definition" description="Choose a definition before managing downstream dependencies." />
          ) : (
            <div className="space-y-5">
              <div className="space-y-3">
                {dependencies.length === 0 && <EmptyBlock title="No dependencies recorded" description="This definition currently has no upstream charge dependencies." />}
                {dependencies.map((dependency: any) => {
                  const upstream = definitions.find((definition: any) => definition.id === dependency.dependsOnChargeId);
                  return (
                    <div key={dependency.id} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{upstream?.code ?? dependency.dependsOnChargeId.slice(-8)}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{titleizeToken(dependency.dependencyType)}</div>
                        </div>
                        <GitBranchPlus className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <Field label="Depends on definition">
                <Select value={dependencyForm.dependsOnChargeId || '__none'} onValueChange={(value) => setDependencyForm((current) => ({ ...current, dependsOnChargeId: value === '__none' ? '' : value }))}>
                  <SelectTrigger><SelectValue placeholder="Select definition" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Select definition</SelectItem>
                    {otherDefinitions.map((definition: any) => (
                      <SelectItem key={definition.id} value={definition.id}>{definition.code} - {definition.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Dependency type">
                <Select value={dependencyForm.dependencyType} onValueChange={(value) => setDependencyForm((current) => ({ ...current, dependencyType: value as DependencyFormState['dependencyType'] }))}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
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
          )}
        </SectionCard>
      </div>
    </PageShell>
  );
}
