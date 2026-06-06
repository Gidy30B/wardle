import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  DiagnosisTeachingRule,
  DiagnosisTeachingRuleCategory,
  DiagnosisTeachingRuleImportance,
  DiagnosisTeachingRuleReviewAction,
  DiagnosisTeachingRulesResponse,
  DiagnosisTeachingRuleSource,
  DiagnosisTeachingRuleStatus,
  DiagnosisTeachingRuleWritePayload,
  JsonValue,
  ReasoningDraftValidationRun,
} from '../../../api/admin';

type Props = {
  rules: DiagnosisTeachingRulesResponse | null;
  loading: boolean;
  error: string | null;
  pendingAction: string | null;
  onGenerateCandidates: () => void;
  onSeedLegacy: () => void;
  onCreateRule: (payload: DiagnosisTeachingRuleWritePayload) => Promise<boolean>;
  onUpdateRule: (
    ruleId: string,
    payload: DiagnosisTeachingRuleWritePayload,
  ) => Promise<boolean>;
  onReviewRule: (
    ruleId: string,
    action: DiagnosisTeachingRuleReviewAction,
  ) => void;
  canReviewRules?: boolean;
  reviewDisabledReason?: string;
  validationRuns?: ReasoningDraftValidationRun[];
};

type RuleFormState = {
  stableKey: string;
  title: string;
  category: DiagnosisTeachingRuleCategory;
  importance: DiagnosisTeachingRuleImportance;
  status: DiagnosisTeachingRuleStatus;
  source: DiagnosisTeachingRuleSource;
  rationale: string;
  acceptableManifestationsText: string;
  requiredDifferentialsText: string;
  avoidTooEarly: boolean;
  appliesToEducation: boolean;
  appliesToCaseGeneration: boolean;
  appliesToGraph: boolean;
};

const categories: DiagnosisTeachingRuleCategory[] = [
  'differential_concept',
  'finding_concept',
  'exam_mechanism',
  'investigation_concept',
  'pitfall_concept',
  'management_concept',
  'recall_concept',
];

const importances: DiagnosisTeachingRuleImportance[] = [
  'critical',
  'high',
  'supporting',
];

const statuses: DiagnosisTeachingRuleStatus[] = [
  'CANDIDATE',
  'NEEDS_REVIEW',
  'APPROVED',
  'ACTIVE',
  'DEPRECATED',
  'REJECTED',
];

const sources: DiagnosisTeachingRuleSource[] = [
  'LEGACY_SEED',
  'EDITOR_CREATED',
  'LEARNED_FROM_REVISION',
  'GENERATED',
  'GRAPH_DERIVED',
];

const emptyForm: RuleFormState = {
  stableKey: '',
  title: '',
  category: 'finding_concept',
  importance: 'high',
  status: 'NEEDS_REVIEW',
  source: 'EDITOR_CREATED',
  rationale: '',
  acceptableManifestationsText: '',
  requiredDifferentialsText: '',
  avoidTooEarly: false,
  appliesToEducation: true,
  appliesToCaseGeneration: true,
  appliesToGraph: false,
};

export default function TeachingRulesCard({
  rules,
  loading,
  error,
  pendingAction,
  onGenerateCandidates,
  onSeedLegacy,
  onCreateRule,
  onUpdateRule,
  onReviewRule,
  canReviewRules = true,
  reviewDisabledReason = 'Requires senior editor',
  validationRuns = [],
}: Props) {
  const [statusFilter, setStatusFilter] = useState<'all' | DiagnosisTeachingRuleStatus>(
    'all',
  );
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | DiagnosisTeachingRuleCategory
  >('all');
  const [importanceFilter, setImportanceFilter] = useState<
    'all' | DiagnosisTeachingRuleImportance
  >('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const visibleRules = useMemo(() => {
    const items = rules?.rules ?? [];
    return items.filter((rule) => {
      if (statusFilter !== 'all' && rule.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && rule.category !== categoryFilter) return false;
      if (importanceFilter !== 'all' && rule.importance !== importanceFilter) {
        return false;
      }
      return true;
    });
  }, [categoryFilter, importanceFilter, rules?.rules, statusFilter]);

  const usableCount =
    rules?.rules.filter(
      (rule) => rule.status === 'ACTIVE' || rule.status === 'APPROVED',
    ).length ?? 0;
  const candidateCount =
    rules?.rules.filter(
      (rule) => rule.status === 'CANDIDATE' || rule.status === 'NEEDS_REVIEW',
    ).length ?? 0;
  const isPending = pendingAction?.startsWith('teaching-rule') ?? false;

  function beginCreate() {
    setEditingRuleId(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function beginEdit(rule: DiagnosisTeachingRule) {
    setEditingRuleId(rule.id);
    setForm(toForm(rule));
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingRuleId(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(false);
  }

  async function submitForm() {
    const payload = toPayload(form);
    if (!payload) {
      setFormError('Title and stableKey are required.');
      return;
    }

    setFormError(null);
    const success = editingRuleId
      ? await onUpdateRule(editingRuleId, payload)
      : await onCreateRule(payload);
    if (success) {
      closeForm();
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Teaching Rules</p>
          <p className="mt-1 text-sm text-slate-500">
            ACTIVE and APPROVED rules drive education and case generation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGenerateCandidates}
            disabled={isPending}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === 'teaching-rule-generate'
              ? 'Generating...'
              : 'Generate candidates'}
          </button>
          <button
            type="button"
            onClick={onSeedLegacy}
            disabled={isPending}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === 'teaching-rule-seed'
              ? 'Seeding...'
              : 'Seed legacy'}
          </button>
          <button
            type="button"
            onClick={beginCreate}
            disabled={isPending}
            className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Create rule
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <Metric label="Generation-ready" value={usableCount} />
        <Metric label="Needs review" value={candidateCount} />
        <Metric label="Total rules" value={rules?.rules.length ?? 0} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <FilterSelect
          label="Status"
          value={statusFilter}
          options={statuses}
          onChange={(value) =>
            setStatusFilter(value as 'all' | DiagnosisTeachingRuleStatus)
          }
        />
        <FilterSelect
          label="Category"
          value={categoryFilter}
          options={categories}
          onChange={(value) =>
            setCategoryFilter(value as 'all' | DiagnosisTeachingRuleCategory)
          }
        />
        <FilterSelect
          label="Importance"
          value={importanceFilter}
          options={importances}
          onChange={(value) =>
            setImportanceFilter(value as 'all' | DiagnosisTeachingRuleImportance)
          }
        />
      </div>

      {formOpen ? (
        <RuleForm
          form={form}
          editing={Boolean(editingRuleId)}
          error={formError}
          onChange={setForm}
          onCancel={closeForm}
          onSubmit={submitForm}
        />
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading teaching rules...</p>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : !rules || rules.rules.length === 0 ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
          No persisted teaching rules yet. Seed legacy rules or generate candidates
          to start review.
        </p>
      ) : visibleRules.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No rules match the selected filters.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {visibleRules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              disabled={isPending}
              canReview={canReviewRules}
              reviewDisabledReason={reviewDisabledReason}
              validationRun={latestValidationRun(validationRuns, rule.id)}
              onEdit={() => beginEdit(rule)}
              onReview={(action) => onReviewRule(rule.id, action)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RuleRow({
  rule,
  disabled,
  canReview,
  reviewDisabledReason,
  validationRun,
  onEdit,
  onReview,
}: {
  rule: DiagnosisTeachingRule;
  disabled: boolean;
  canReview: boolean;
  reviewDisabledReason: string;
  validationRun: ReasoningDraftValidationRun | null;
  onEdit: () => void;
  onReview: (action: DiagnosisTeachingRuleReviewAction) => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{rule.title}</p>
            <Pill tone={statusTone(rule.status)}>{formatLabel(rule.status)}</Pill>
            <Pill tone={importanceTone(rule.importance)}>
              {formatLabel(rule.importance)}
            </Pill>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {formatLabel(rule.category)} · {formatLabel(rule.source)} ·{' '}
            {rule.stableKey}
          </p>
          {rule.rationale ? (
            <p className="mt-2 text-sm text-slate-700">{rule.rationale}</p>
          ) : null}
          <GeneratedBecauseBlock metadata={rule.generationMetadata} />
          <ValidationTrustBlock validationRun={validationRun} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Edit
          </button>
          <ReviewButton
            label="Approve"
            action="approve"
            disabled={disabled || !canReview || rule.status === 'APPROVED'}
            title={!canReview ? reviewDisabledReason : undefined}
            onReview={onReview}
          />
          <ReviewButton
            label="Activate"
            action="activate"
            disabled={disabled || !canReview || rule.status === 'ACTIVE'}
            title={!canReview ? reviewDisabledReason : undefined}
            onReview={onReview}
          />
          <ReviewButton
            label="Needs review"
            action="needs_review"
            disabled={disabled || !canReview || rule.status === 'NEEDS_REVIEW'}
            title={!canReview ? reviewDisabledReason : undefined}
            onReview={onReview}
          />
          <ReviewButton
            label="Reject"
            action="reject"
            disabled={disabled || !canReview || rule.status === 'REJECTED'}
            title={!canReview ? reviewDisabledReason : undefined}
            onReview={onReview}
          />
          <ReviewButton
            label="Deprecate"
            action="deprecate"
            disabled={disabled || !canReview || rule.status === 'DEPRECATED'}
            title={!canReview ? reviewDisabledReason : undefined}
            onReview={onReview}
          />
        </div>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-500">
          Details
        </summary>
        <div className="mt-2 grid gap-3 text-sm md:grid-cols-2">
          <DetailList
            label="Acceptable manifestations"
            values={jsonList(rule.acceptableManifestations)}
          />
          <DetailList
            label="Required differentials"
            values={jsonList(rule.requiredDifferentials)}
          />
          <div className="md:col-span-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <Pill tone={rule.appliesToEducation ? 'green' : 'muted'}>
              Education {rule.appliesToEducation ? 'on' : 'off'}
            </Pill>
            <Pill tone={rule.appliesToCaseGeneration ? 'green' : 'muted'}>
              Case generation {rule.appliesToCaseGeneration ? 'on' : 'off'}
            </Pill>
            <Pill tone={rule.appliesToGraph ? 'green' : 'muted'}>
              Graph {rule.appliesToGraph ? 'on' : 'off'}
            </Pill>
            <Pill tone={rule.avoidTooEarly ? 'amber' : 'muted'}>
              {rule.avoidTooEarly ? 'Avoid early reveal' : 'No reveal limit'}
            </Pill>
          </div>
        </div>
      </details>
    </article>
  );
}

function RuleForm({
  form,
  editing,
  error,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: RuleFormState;
  editing: boolean;
  error: string | null;
  onChange: (form: RuleFormState) => void;
  onCancel: () => void;
  onSubmit: () => Promise<void>;
}) {
  function patch(next: Partial<RuleFormState>) {
    onChange({ ...form, ...next });
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">
          {editing ? 'Edit teaching rule' : 'Create manual teaching rule'}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-semibold text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Title
          <input
            value={form.title}
            onChange={(event) => {
              const title = event.target.value;
              patch({
                title,
                stableKey: form.stableKey || stableKeyFromTitle(title),
              });
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Stable key
          <input
            value={form.stableKey}
            onChange={(event) => patch({ stableKey: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <SelectField
          label="Category"
          value={form.category}
          options={categories}
          onChange={(value) =>
            patch({ category: value as DiagnosisTeachingRuleCategory })
          }
        />
        <SelectField
          label="Importance"
          value={form.importance}
          options={importances}
          onChange={(value) =>
            patch({ importance: value as DiagnosisTeachingRuleImportance })
          }
        />
        <SelectField
          label="Status"
          value={form.status}
          options={statuses}
          onChange={(value) =>
            patch({ status: value as DiagnosisTeachingRuleStatus })
          }
        />
        <SelectField
          label="Source"
          value={form.source}
          options={sources}
          onChange={(value) =>
            patch({ source: value as DiagnosisTeachingRuleSource })
          }
        />
      </div>

      <label className="mt-3 block text-sm font-medium text-slate-700">
        Rationale
        <textarea
          value={form.rationale}
          onChange={(event) => patch({ rationale: event.target.value })}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </label>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Acceptable manifestations
          <textarea
            value={form.acceptableManifestationsText}
            onChange={(event) =>
              patch({ acceptableManifestationsText: event.target.value })
            }
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="One manifestation per line"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Required differentials
          <textarea
            value={form.requiredDifferentialsText}
            onChange={(event) =>
              patch({ requiredDifferentialsText: event.target.value })
            }
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="One differential per line"
          />
        </label>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
        <CheckboxField
          label="Applies to education"
          checked={form.appliesToEducation}
          onChange={(value) => patch({ appliesToEducation: value })}
        />
        <CheckboxField
          label="Applies to case generation"
          checked={form.appliesToCaseGeneration}
          onChange={(value) => patch({ appliesToCaseGeneration: value })}
        />
        <CheckboxField
          label="Applies to graph"
          checked={form.appliesToGraph}
          onChange={(value) => patch({ appliesToGraph: value })}
        />
        <CheckboxField
          label="Avoid revealing too early"
          checked={form.avoidTooEarly}
          onChange={(value) => patch({ avoidTooEarly: value })}
        />
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => void onSubmit()}
          className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {editing ? 'Save rule' : 'Create rule'}
        </button>
      </div>
    </div>
  );
}

function GeneratedBecauseBlock({ metadata }: { metadata?: JsonValue | null }) {
  const record = asRecord(metadata);
  if (!record) return null;
  const constrained = record.constrained === true;
  const warnings = jsonList(record.warnings);
  const evidence = jsonList(record.discriminatorEvidenceUsed);
  const gaps = jsonList(record.coverageGapsAddressed);
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-900">Generated because</span>
        <Pill tone={constrained ? 'green' : 'amber'}>
          {constrained ? 'Constrained' : 'Unconstrained'}
        </Pill>
        {typeof record.hallucinationRisk === 'string' ? (
          <Pill tone={record.hallucinationRisk === 'high' ? 'amber' : 'muted'}>
            Risk {record.hallucinationRisk}
          </Pill>
        ) : null}
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <CompactMeta label="Goal" value={stringValue(record.reasoningGoal)} />
        <CompactMeta
          label="Path"
          value={stringValue(record.reasoningPathId) ?? 'No active path'}
        />
      </div>
      {evidence.length ? (
        <p className="mt-2">Discriminator evidence: {evidence.slice(0, 4).join(', ')}</p>
      ) : null}
      {gaps.length ? <p className="mt-1">Coverage gaps: {gaps.join(', ')}</p> : null}
      {warnings.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-800">
          {warnings.slice(0, 4).map((warning) => (
            <li key={warning}>{formatLabel(warning)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ValidationTrustBlock({
  validationRun,
}: {
  validationRun: ReasoningDraftValidationRun | null;
}) {
  if (!validationRun) return null;
  const warnings = signalMessages(validationRun.warnings);
  const blockers = signalMessages(validationRun.blockers);
  const risks = [
    ...signalMessages(validationRun.hallucinationRiskSignals),
    ...signalMessages(validationRun.unsupportedClaimSignals),
  ];
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-900">Validated against</span>
        <Pill tone={validationTone(validationRun.trustTier)}>
          {formatLabel(validationRun.trustTier)}
        </Pill>
        <Pill tone="muted">Trust {validationRun.trustScore}</Pill>
        <Pill tone="muted">{formatLabel(validationRun.validationStatus)}</Pill>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <CompactMeta
          label="Path"
          value={validationRun.reasoningPathId ?? 'No active path'}
        />
        <CompactMeta label="Checked" value={new Date(validationRun.createdAt).toLocaleDateString()} />
      </div>
      {blockers.length ? <p className="mt-2 text-rose-700">Blockers: {blockers.slice(0, 3).join(', ')}</p> : null}
      {warnings.length ? <p className="mt-1 text-amber-800">Warnings: {warnings.slice(0, 3).join(', ')}</p> : null}
      {risks.length ? <p className="mt-1 text-amber-800">Risk signals: {risks.slice(0, 3).join(', ')}</p> : null}
    </div>
  );
}

function CompactMeta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="font-semibold text-slate-500">{label}: </span>
      <span>{value || 'None'}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function ReviewButton({
  label,
  action,
  disabled,
  title,
  onReview,
}: {
  label: string;
  action: DiagnosisTeachingRuleReviewAction;
  disabled: boolean;
  title?: string;
  onReview: (action: DiagnosisTeachingRuleReviewAction) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onReview(action)}
      disabled={disabled}
      title={title}
      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function DetailList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      {values.length ? (
        <ul className="mt-1 space-y-1 text-slate-700">
          {values.slice(0, 5).map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-slate-500">None listed</p>
      )}
    </div>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: 'green' | 'amber' | 'rose' | 'blue' | 'muted';
  children: ReactNode;
}) {
  const classes = {
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    blue: 'bg-sky-50 text-sky-700',
    muted: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${classes[tone]}`}>
      {children}
    </span>
  );
}

function statusTone(status: DiagnosisTeachingRuleStatus) {
  if (status === 'ACTIVE' || status === 'APPROVED') return 'green';
  if (status === 'CANDIDATE' || status === 'NEEDS_REVIEW') return 'amber';
  if (status === 'REJECTED' || status === 'DEPRECATED') return 'rose';
  return 'muted';
}

function importanceTone(importance: DiagnosisTeachingRuleImportance) {
  if (importance === 'critical') return 'rose';
  if (importance === 'high') return 'amber';
  return 'muted';
}

function toForm(rule: DiagnosisTeachingRule): RuleFormState {
  return {
    stableKey: rule.stableKey,
    title: rule.title,
    category: rule.category,
    importance: rule.importance,
    status: rule.status,
    source: rule.source,
    rationale: rule.rationale ?? '',
    acceptableManifestationsText: jsonList(rule.acceptableManifestations).join('\n'),
    requiredDifferentialsText: jsonList(rule.requiredDifferentials).join('\n'),
    avoidTooEarly: rule.avoidTooEarly,
    appliesToEducation: rule.appliesToEducation,
    appliesToCaseGeneration: rule.appliesToCaseGeneration,
    appliesToGraph: rule.appliesToGraph,
  };
}

function toPayload(form: RuleFormState): DiagnosisTeachingRuleWritePayload | null {
  const title = form.title.trim();
  const stableKey = form.stableKey.trim();
  if (!title || !stableKey) {
    return null;
  }

  return {
    stableKey,
    title,
    category: form.category,
    importance: form.importance,
    status: form.status,
    source: form.source,
    rationale: form.rationale.trim() || null,
    acceptableManifestations: parseLines(form.acceptableManifestationsText),
    requiredDifferentials: parseLines(form.requiredDifferentialsText),
    avoidTooEarly: form.avoidTooEarly,
    appliesToEducation: form.appliesToEducation,
    appliesToCaseGeneration: form.appliesToCaseGeneration,
    appliesToGraph: form.appliesToGraph,
  };
}

function jsonList(value: JsonValue | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const record = item as Record<string, JsonValue>;
        return firstString(record.title, record.label, record.content, record.name);
      }
      return null;
    })
    .filter((item): item is string => Boolean(item?.trim()));
}

function asRecord(value: JsonValue | null | undefined): Record<string, JsonValue> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : null;
}

function stringValue(value: JsonValue | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function signalMessages(value: JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      const record = asRecord(item);
      return stringValue(record?.message) ?? stringValue(record?.code);
    })
    .filter((item): item is string => Boolean(item));
}

function latestValidationRun(
  runs: ReasoningDraftValidationRun[],
  artifactId: string,
) {
  return runs.find((run) => run.artifactId === artifactId) ?? null;
}

function validationTone(tier: string): 'green' | 'amber' | 'rose' | 'muted' {
  if (tier === 'HIGH_TRUST') return 'green';
  if (tier === 'BLOCKED') return 'rose';
  if (tier === 'LOW_TRUST') return 'amber';
  return 'muted';
}

function firstString(...values: Array<JsonValue | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stableKeyFromTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
