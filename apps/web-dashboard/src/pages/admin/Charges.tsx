import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { apiClient } from '../../lib/api-client.js';
import { formatDate, getErrorMessage, titleizeToken, toOptionalNumber, toOptionalTrimmed } from '../../lib/admin-utils.js';

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
  jurisdictionMetadata: string;
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

type RuleFormState = {
  calcMethod: (typeof calcMethodSchema.options)[number];
  rateBps: string;
  fixedAmount: string;
  currencyCode: string;
  minAmount: string;
  maxAmount: string;
  formula: string;
  tieredConfig: string;
  conditions: string;
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
  jurisdictionMetadata: '',
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
  tieredConfig: '',
  conditions: '',
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

const CATEGORY_CLASSES: Record<string, string> = {
  commission: 'badge-info',
  tax: 'badge-warning',
  duty: 'badge-warning',
  fee: 'badge-neutral',
  levy: 'badge-warning',
  surcharge: 'badge-neutral',
  discount: 'badge-success',
  withholding: 'badge-danger',
  fx: 'badge-info',
  adjustment: 'badge-neutral',
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="dashboard-stat-card">
      <span className="dashboard-stat-label">{label}</span>
      <strong className="dashboard-stat-value">{value}</strong>
      <span className="dashboard-stat-hint">{hint}</span>
    </div>
  );
}

function safeJsonParse<T>(value: string, fallbackLabel: string): T | undefined {
  if (!value.trim()) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`Invalid JSON for ${fallbackLabel}.`);
  }
}

function definitionFormFromRecord(definition: any): DefinitionFormState {
  const metadata = definition.jurisdictionMetadata ? JSON.stringify(JSON.parse(definition.jurisdictionMetadata), null, 2) : '';
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
    jurisdictionMetadata: metadata,
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
      setDependencyForm((current) => ({ ...current, dependsOnChargeId: current.dependsOnChargeId || '' }));
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
        jurisdictionMetadata: safeJsonParse<Record<string, unknown>>(definitionForm.jurisdictionMetadata, 'jurisdiction metadata'),
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
        tieredConfig: safeJsonParse<Record<string, unknown>>(ruleForm.tieredConfig, 'tiered config'),
        conditions: safeJsonParse<Record<string, unknown>[]>(ruleForm.conditions, 'conditions'),
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

  return (
    <div className="domain-page">
      <div className="domain-page-header">
        <div>
          <span className="eyebrow">Charge domain</span>
          <h1 className="page-title">Charge studio</h1>
          <p className="page-subtitle">
            Manage the charge engine in layers: definitions, rule sets, rate rules, and cross-charge dependencies. The forms mirror the validation schema used by the API.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn-secondary"
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
          </button>
          <Link to="/admin/charges/simulate">
            <button className="btn-primary">Open simulator</button>
          </Link>
        </div>
      </div>

      <div className="dashboard-stat-grid">
        <StatCard label="Definitions" value={definitions.length} hint={`${enabledDefinitions} currently enabled for new calculations`} />
        <StatCard label="Approval tracked" value={approvalDefinitions} hint="Definitions that require approval for material changes" />
        <StatCard label="Rule sets" value={ruleSets.length} hint={selectedDefinition ? `Attached to ${selectedDefinition.code}` : 'Select a definition to inspect coverage'} />
        <StatCard label="Scope coverage" value={scopeCoverage} hint="Distinct charge scopes configured in the engine" />
      </div>

      {(message || errorMessage) && (
        <div className={errorMessage ? 'alert-error' : 'alert-success'} style={{ marginBottom: '1rem' }}>
          {errorMessage ?? message}
        </div>
      )}

      <div className="domain-grid">
        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Definition catalog</h2>
              <p className="section-copy">Find a charge family quickly, then open its downstream rules and dependencies.</p>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search definitions"
              className="search-input"
            />
          </div>

          <div className="table-container domain-table">
            <table>
              <thead>
                <tr>
                  <th>Definition</th>
                  <th>Category</th>
                  <th>Scope</th>
                  <th>Payer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="table-empty">Loading definitions...</td>
                  </tr>
                )}
                {!isLoading && filteredDefinitions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-empty">No definitions match the current search.</td>
                  </tr>
                )}
                {filteredDefinitions.map((definition: any) => (
                  <tr
                    key={definition.id}
                    className={definition.id === selectedDefinitionId ? 'table-row-selected' : ''}
                    onClick={() => {
                      setIsCreatingDefinition(false);
                      setSelectedDefinitionId(definition.id);
                    }}
                  >
                    <td>
                      <div className="entity-cell">
                        <strong>{definition.code}</strong>
                        <span>{definition.name}</span>
                      </div>
                    </td>
                    <td><span className={`badge ${CATEGORY_CLASSES[definition.category] ?? 'badge-neutral'}`}>{titleizeToken(definition.category)}</span></td>
                    <td>{titleizeToken(definition.scope)}</td>
                    <td>{titleizeToken(definition.payer)}</td>
                    <td>
                      <div className="stack-inline">
                        <span className={`badge ${definition.isEnabled ? 'badge-success' : 'badge-danger'}`}>
                          {definition.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                        {definition.requiresApproval && <span className="badge badge-warning">Approval</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="workspace-panel workspace-panel-sticky">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">{selectedDefinition && !isCreatingDefinition ? 'Edit definition' : 'Create definition'}</h2>
              <p className="section-copy">
                Core calculation identity fields are locked once a definition exists; lifecycle settings remain editable.
              </p>
            </div>
            {selectedDefinition && !isCreatingDefinition && <span className="badge badge-neutral">ID {selectedDefinition.id.slice(-8)}</span>}
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Code</span>
              <input value={definitionForm.code} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="PLATFORM_COMMISSION" />
            </label>
            <label className="field">
              <span>Name</span>
              <input value={definitionForm.name} onChange={(event) => setDefinitionForm((current) => ({ ...current, name: event.target.value }))} placeholder="Platform commission" />
            </label>
            <label className="field">
              <span>Category</span>
              <select value={definitionForm.category} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, category: event.target.value as DefinitionFormState['category'] }))}>
                {chargeCategorySchema.options.map((option) => (
                  <option key={option} value={option}>{titleizeToken(option)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Scope</span>
              <select value={definitionForm.scope} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, scope: event.target.value as DefinitionFormState['scope'] }))}>
                {chargeScopeSchema.options.map((option) => (
                  <option key={option} value={option}>{titleizeToken(option)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Payer</span>
              <select value={definitionForm.payer} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, payer: event.target.value as DefinitionFormState['payer'] }))}>
                {chargePayerSchema.options.map((option) => (
                  <option key={option} value={option}>{titleizeToken(option)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Beneficiary</span>
              <select value={definitionForm.beneficiary} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, beneficiary: event.target.value as DefinitionFormState['beneficiary'] }))}>
                {chargeBeneficiarySchema.options.map((option) => (
                  <option key={option} value={option}>{titleizeToken(option)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Base type</span>
              <select value={definitionForm.baseType} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, baseType: event.target.value as DefinitionFormState['baseType'] }))}>
                {chargeBaseTypeSchema.options.map((option) => (
                  <option key={option} value={option}>{titleizeToken(option)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Calculation method</span>
              <select value={definitionForm.calcMethod} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, calcMethod: event.target.value as DefinitionFormState['calcMethod'] }))}>
                {calcMethodSchema.options.map((option) => (
                  <option key={option} value={option}>{titleizeToken(option)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Priority</span>
              <input value={definitionForm.calcPriority} onChange={(event) => setDefinitionForm((current) => ({ ...current, calcPriority: event.target.value }))} type="number" />
            </label>
            <label className="field">
              <span>Refund behavior</span>
              <select value={definitionForm.refundBehavior} onChange={(event) => setDefinitionForm((current) => ({ ...current, refundBehavior: event.target.value as DefinitionFormState['refundBehavior'] }))}>
                {refundBehaviorSchema.options.map((option) => (
                  <option key={option} value={option}>{titleizeToken(option)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Effective from</span>
              <input value={definitionForm.effectiveFrom} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, effectiveFrom: event.target.value }))} type="date" />
            </label>
            <label className="field">
              <span>Effective to</span>
              <input value={definitionForm.effectiveTo} onChange={(event) => setDefinitionForm((current) => ({ ...current, effectiveTo: event.target.value }))} type="date" />
            </label>
            <label className="field">
              <span>Debit account</span>
              <input value={definitionForm.ledgerDebitAccountCode} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, ledgerDebitAccountCode: event.target.value }))} placeholder="ACCOUNTS_RECEIVABLE" />
            </label>
            <label className="field">
              <span>Credit account</span>
              <input value={definitionForm.ledgerCreditAccountCode} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, ledgerCreditAccountCode: event.target.value }))} placeholder="COMMISSION_REVENUE" />
            </label>
            <label className="field field-span-2">
              <span>Description</span>
              <textarea value={definitionForm.description} rows={3} onChange={(event) => setDefinitionForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe when this charge applies and why it exists." />
            </label>
            <label className="field field-span-2">
              <span>Jurisdiction metadata JSON</span>
              <textarea
                value={definitionForm.jurisdictionMetadata}
                disabled={Boolean(selectedDefinition && !isCreatingDefinition)}
                rows={5}
                onChange={(event) => setDefinitionForm((current) => ({ ...current, jurisdictionMetadata: event.target.value }))}
                placeholder='{"country":"KE","taxCode":"VAT"}'
              />
            </label>
          </div>

          <div className="toggle-grid">
            <label className="toggle-card">
              <input type="checkbox" checked={definitionForm.isTaxable} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, isTaxable: event.target.checked }))} />
              <span>Taxable</span>
            </label>
            <label className="toggle-card">
              <input type="checkbox" checked={definitionForm.isRecoverable} disabled={Boolean(selectedDefinition && !isCreatingDefinition)} onChange={(event) => setDefinitionForm((current) => ({ ...current, isRecoverable: event.target.checked }))} />
              <span>Recoverable</span>
            </label>
            <label className="toggle-card">
              <input type="checkbox" checked={definitionForm.requiresApproval} onChange={(event) => setDefinitionForm((current) => ({ ...current, requiresApproval: event.target.checked }))} />
              <span>Needs approval</span>
            </label>
            <label className="toggle-card">
              <input type="checkbox" checked={definitionForm.isEnabled} onChange={(event) => setDefinitionForm((current) => ({ ...current, isEnabled: event.target.checked }))} />
              <span>Enabled</span>
            </label>
          </div>

          <div className="action-row">
            <button className="btn-primary" onClick={() => void definitionMutation.mutateAsync()} disabled={definitionMutation.isPending}>
              {definitionMutation.isPending ? 'Saving...' : selectedDefinition && !isCreatingDefinition ? 'Save definition' : 'Create definition'}
            </button>
          </div>

          {selectedDefinition && !isCreatingDefinition && (
            <div className="detail-grid">
              <div className="detail-card">
                <span className="detail-label">Created</span>
                <strong>{formatDate(selectedDefinition.createdAt)}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Updated</span>
                <strong>{formatDate(selectedDefinition.updatedAt)}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Scope</span>
                <strong>{titleizeToken(selectedDefinition.scope)}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Payer</span>
                <strong>{titleizeToken(selectedDefinition.payer)}</strong>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="workspace-triptych">
        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Rule sets</h2>
              <p className="section-copy">Jurisdiction, provider, and booking-window selectors for the active definition.</p>
            </div>
            {selectedDefinition && <span className="badge badge-info">{selectedDefinition.code}</span>}
          </div>

          {!selectedDefinition ? (
            <div className="empty-panel">Select a definition to manage its rule sets.</div>
          ) : (
            <>
              <div className="list-stack">
                {ruleSets.length === 0 && <div className="empty-panel">No rule sets yet for this definition.</div>}
                {ruleSets.map((ruleSet: any) => (
                  <button
                    key={ruleSet.id}
                    type="button"
                    className={`list-card${ruleSet.id === selectedRuleSetId ? ' selected' : ''}`}
                    onClick={() => setSelectedRuleSetId(ruleSet.id)}
                  >
                    <strong>{ruleSet.name}</strong>
                    <span>{ruleSet.jurisdictionCountry ?? 'Any country'} / {ruleSet.providerId ? 'Provider-specific' : 'Global'}</span>
                  </button>
                ))}
              </div>

              <div className="form-grid">
                <label className="field field-span-2">
                  <span>Name</span>
                  <input value={ruleSetForm.name} onChange={(event) => setRuleSetForm((current) => ({ ...current, name: event.target.value }))} placeholder="Default Kenya marketplace" />
                </label>
                <label className="field">
                  <span>Country</span>
                  <input value={ruleSetForm.jurisdictionCountry} maxLength={2} onChange={(event) => setRuleSetForm((current) => ({ ...current, jurisdictionCountry: event.target.value.toUpperCase() }))} placeholder="KE" />
                </label>
                <label className="field">
                  <span>Region</span>
                  <input value={ruleSetForm.jurisdictionRegion} onChange={(event) => setRuleSetForm((current) => ({ ...current, jurisdictionRegion: event.target.value }))} placeholder="Nairobi" />
                </label>
                <label className="field">
                  <span>Provider</span>
                  <select value={ruleSetForm.providerId} onChange={(event) => setRuleSetForm((current) => ({ ...current, providerId: event.target.value }))}>
                    <option value="">Any provider</option>
                    {providers.map((provider: any) => (
                      <option key={provider.id} value={provider.id}>{provider.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Listing category</span>
                  <input value={ruleSetForm.listingCategory} onChange={(event) => setRuleSetForm((current) => ({ ...current, listingCategory: event.target.value }))} placeholder="flight" />
                </label>
                <label className="field">
                  <span>Min booking amount</span>
                  <input value={ruleSetForm.minBookingAmount} type="number" onChange={(event) => setRuleSetForm((current) => ({ ...current, minBookingAmount: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Max booking amount</span>
                  <input value={ruleSetForm.maxBookingAmount} type="number" onChange={(event) => setRuleSetForm((current) => ({ ...current, maxBookingAmount: event.target.value }))} />
                </label>
                <label className="field field-span-2">
                  <span>Priority</span>
                  <input value={ruleSetForm.priority} type="number" onChange={(event) => setRuleSetForm((current) => ({ ...current, priority: event.target.value }))} />
                </label>
              </div>

              <button className="btn-secondary" onClick={() => void ruleSetMutation.mutateAsync()} disabled={ruleSetMutation.isPending}>
                {ruleSetMutation.isPending ? 'Creating...' : 'Add rule set'}
              </button>
            </>
          )}
        </section>

        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Rules</h2>
              <p className="section-copy">Attach executable rates to the selected rule set, then version them with change reasons.</p>
            </div>
            {selectedRuleSet && <span className="badge badge-info">{selectedRuleSet.name}</span>}
          </div>

          {!selectedRuleSet ? (
            <div className="empty-panel">Select a rule set to create or update rules.</div>
          ) : (
            <>
              <div className="list-stack">
                {rules.length === 0 && <div className="empty-panel">No rules attached to this rule set yet.</div>}
                {rules.map((rule: any) => (
                  <button
                    key={rule.id}
                    type="button"
                    className={`list-card${rule.id === selectedRuleId ? ' selected' : ''}`}
                    onClick={() => setSelectedRuleId(rule.id)}
                  >
                    <strong>{titleizeToken(rule.calcMethod)}</strong>
                    <span>Version {rule.version} / {rule.isActive ? 'Active' : 'Inactive'}</span>
                  </button>
                ))}
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Method</span>
                  <select value={ruleForm.calcMethod} onChange={(event) => setRuleForm((current) => ({ ...current, calcMethod: event.target.value as RuleFormState['calcMethod'] }))}>
                    {calcMethodSchema.options.map((option) => (
                      <option key={option} value={option}>{titleizeToken(option)}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Rate bps</span>
                  <input value={ruleForm.rateBps} type="number" onChange={(event) => setRuleForm((current) => ({ ...current, rateBps: event.target.value }))} placeholder="1000" />
                </label>
                <label className="field">
                  <span>Fixed amount</span>
                  <input value={ruleForm.fixedAmount} type="number" onChange={(event) => setRuleForm((current) => ({ ...current, fixedAmount: event.target.value }))} placeholder="5000" />
                </label>
                <label className="field">
                  <span>Currency</span>
                  <input value={ruleForm.currencyCode} onChange={(event) => setRuleForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} maxLength={3} />
                </label>
                <label className="field">
                  <span>Min amount</span>
                  <input value={ruleForm.minAmount} type="number" onChange={(event) => setRuleForm((current) => ({ ...current, minAmount: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Max amount</span>
                  <input value={ruleForm.maxAmount} type="number" onChange={(event) => setRuleForm((current) => ({ ...current, maxAmount: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Effective from</span>
                  <input value={ruleForm.effectiveFrom} type="date" onChange={(event) => setRuleForm((current) => ({ ...current, effectiveFrom: event.target.value }))} />
                </label>
                <label className="field">
                  <span>Effective to</span>
                  <input value={ruleForm.effectiveTo} type="date" onChange={(event) => setRuleForm((current) => ({ ...current, effectiveTo: event.target.value }))} />
                </label>
                <label className="field field-span-2">
                  <span>Formula</span>
                  <input value={ruleForm.formula} onChange={(event) => setRuleForm((current) => ({ ...current, formula: event.target.value }))} placeholder="base_amount * 0.015" />
                </label>
                <label className="field field-span-2">
                  <span>Tiered config JSON</span>
                  <textarea value={ruleForm.tieredConfig} rows={4} onChange={(event) => setRuleForm((current) => ({ ...current, tieredConfig: event.target.value }))} placeholder='{"tiers":[{"from":0,"to":100000,"rateBps":500}]}' />
                </label>
                <label className="field field-span-2">
                  <span>Conditions JSON</span>
                  <textarea value={ruleForm.conditions} rows={4} onChange={(event) => setRuleForm((current) => ({ ...current, conditions: event.target.value }))} placeholder='[{"field":"country","op":"eq","value":"KE"}]' />
                </label>
              </div>

              <label className="toggle-card">
                <input type="checkbox" checked={ruleForm.isInclusive} onChange={(event) => setRuleForm((current) => ({ ...current, isInclusive: event.target.checked }))} />
                <span>Inclusive charge</span>
              </label>

              <button className="btn-secondary" onClick={() => void ruleMutation.mutateAsync()} disabled={ruleMutation.isPending}>
                {ruleMutation.isPending ? 'Creating...' : 'Add rule'}
              </button>

              {selectedRule && (
                <div className="panel-block subtle-panel">
                  <div className="workspace-panel-header">
                    <div>
                      <h3 className="section-title">Selected rule maintenance</h3>
                      <p className="section-copy">Version this rule with a clear reason whenever the numeric behavior changes.</p>
                    </div>
                    <span className={`badge ${selectedRule.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {selectedRule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span>Rate bps</span>
                      <input value={ruleUpdateForm.rateBps} type="number" onChange={(event) => setRuleUpdateForm((current) => ({ ...current, rateBps: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Fixed amount</span>
                      <input value={ruleUpdateForm.fixedAmount} type="number" onChange={(event) => setRuleUpdateForm((current) => ({ ...current, fixedAmount: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Min amount</span>
                      <input value={ruleUpdateForm.minAmount} type="number" onChange={(event) => setRuleUpdateForm((current) => ({ ...current, minAmount: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Max amount</span>
                      <input value={ruleUpdateForm.maxAmount} type="number" onChange={(event) => setRuleUpdateForm((current) => ({ ...current, maxAmount: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Effective to</span>
                      <input value={ruleUpdateForm.effectiveTo} type="date" onChange={(event) => setRuleUpdateForm((current) => ({ ...current, effectiveTo: event.target.value }))} />
                    </label>
                    <label className="toggle-card">
                      <input type="checkbox" checked={ruleUpdateForm.isActive} onChange={(event) => setRuleUpdateForm((current) => ({ ...current, isActive: event.target.checked }))} />
                      <span>Rule active</span>
                    </label>
                    <label className="field field-span-2">
                      <span>Change reason</span>
                      <textarea value={ruleUpdateForm.changeReason} rows={3} onChange={(event) => setRuleUpdateForm((current) => ({ ...current, changeReason: event.target.value }))} placeholder="Explain why the rate is changing." />
                    </label>
                  </div>
                  <button className="btn-primary" onClick={() => void ruleUpdateMutation.mutateAsync()} disabled={ruleUpdateMutation.isPending}>
                    {ruleUpdateMutation.isPending ? 'Updating...' : 'Version rule'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Dependencies</h2>
              <p className="section-copy">Control sequencing and base relationships between charge definitions.</p>
            </div>
          </div>

          {!selectedDefinition ? (
            <div className="empty-panel">Select a definition to map its dependencies.</div>
          ) : (
            <>
              <div className="list-stack">
                {dependencies.length === 0 && <div className="empty-panel">No dependencies configured yet.</div>}
                {dependencies.map((dependency: any) => {
                  const target = definitions.find((definition: any) => definition.id === dependency.dependsOnChargeId);
                  return (
                    <div key={dependency.id} className="list-card static">
                      <strong>{selectedDefinition.code}</strong>
                      <span>{titleizeToken(dependency.dependencyType)} {'->'} {target?.code ?? dependency.dependsOnChargeId.slice(-8)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="form-grid">
                <label className="field field-span-2">
                  <span>Depends on</span>
                  <select value={dependencyForm.dependsOnChargeId} onChange={(event) => setDependencyForm((current) => ({ ...current, dependsOnChargeId: event.target.value }))}>
                    <option value="">Select another definition</option>
                    {otherDefinitions.map((definition: any) => (
                      <option key={definition.id} value={definition.id}>{definition.code} - {definition.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field field-span-2">
                  <span>Dependency type</span>
                  <select value={dependencyForm.dependencyType} onChange={(event) => setDependencyForm((current) => ({ ...current, dependencyType: event.target.value as DependencyFormState['dependencyType'] }))}>
                    <option value="after">After</option>
                    <option value="base_of">Base of</option>
                    <option value="exclusive">Exclusive</option>
                  </select>
                </label>
              </div>

              <button className="btn-secondary" onClick={() => void dependencyMutation.mutateAsync()} disabled={dependencyMutation.isPending}>
                {dependencyMutation.isPending ? 'Adding...' : 'Add dependency'}
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
