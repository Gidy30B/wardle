import { useState } from 'react';
import type {
  DiagnosisEditorialBrief,
  DiagnosisEditorialBriefResponse,
  DiagnosisEditorialBriefReviewAction,
  DiagnosisEditorialBriefStatus,
  DiagnosisEditorialBriefWritePayload,
  DiagnosisTeachingRulesResponse,
  JsonValue,
} from '../../../api/admin';
import {
  CompactMetricGrid,
  EmptyGuidance,
  InlineReviewBar,
  PrototypeSectionHeader,
} from '../../editorial/workspace/EditorialPrimitives';
import StatusBadge from '../../../components/ui/StatusBadge';

type Props = {
  briefResponse: DiagnosisEditorialBriefResponse | null;
  teachingRules: DiagnosisTeachingRulesResponse | null;
  loading: boolean;
  error: string | null;
  pendingAction: string | null;
  onGenerate: () => void;
  onCreate: (payload: DiagnosisEditorialBriefWritePayload) => Promise<boolean>;
  onUpdate: (payload: DiagnosisEditorialBriefWritePayload) => Promise<boolean>;
  onReview: (action: DiagnosisEditorialBriefReviewAction) => void;
  canReviewBrief?: boolean;
  reviewDisabledReason?: string;
};

type BriefFormState = {
  summary: string;
  status: DiagnosisEditorialBriefStatus;
  learningGoalsText: string;
  requiredTeachingRuleIds: string[];
  requiredMimicIdsText: string;
  requiredPitfallsText: string;
  keyInvestigationsText: string;
  managementAnchorsText: string;
  difficultyGuidanceText: string;
  educationGuidanceText: string;
  caseGenerationGuidanceText: string;
  graphGuidanceText: string;
};

const statuses: DiagnosisEditorialBriefStatus[] = [
  'DRAFT',
  'NEEDS_REVIEW',
  'APPROVED',
  'ACTIVE',
  'DEPRECATED',
];

const emptyForm: BriefFormState = {
  summary: '',
  status: 'DRAFT',
  learningGoalsText: '',
  requiredTeachingRuleIds: [],
  requiredMimicIdsText: '',
  requiredPitfallsText: '',
  keyInvestigationsText: '',
  managementAnchorsText: '',
  difficultyGuidanceText: '',
  educationGuidanceText: '',
  caseGenerationGuidanceText: '',
  graphGuidanceText: '',
};

export default function EditorialBriefCard({
  briefResponse,
  teachingRules,
  loading,
  error,
  pendingAction,
  onGenerate,
  onCreate,
  onUpdate,
  onReview,
  canReviewBrief = true,
  reviewDisabledReason = 'Requires senior editor',
}: Props) {
  const brief = briefResponse?.brief ?? null;
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<BriefFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const isPending = pendingAction?.startsWith('editorial-brief') ?? false;

  function beginEdit() {
    setForm(brief ? toForm(brief) : emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(false);
  }

  async function submitForm() {
    const payload = toPayload(form);
    if (!payload) {
      setFormError('Summary is required.');
      return;
    }

    setFormError(null);
    const success = brief ? await onUpdate(payload) : await onCreate(payload);
    if (success) {
      closeForm();
    }
  }

  return (
    <section className="editorial-panel rounded-lg p-4">
      <PrototypeSectionHeader
        eyebrow="Editorial intent"
        title="Editorial Brief"
        subtitle="Diagnosis-level teaching strategy across education, cases, graph, and difficulty."
        action={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={isPending}
            className="editorial-action disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === 'editorial-brief-generate'
              ? 'Generating...'
              : 'Generate draft brief'}
          </button>
          <button
            type="button"
            onClick={beginEdit}
            disabled={isPending}
            className="rounded-lg border border-[var(--color-teal)]/40 bg-[var(--color-teal)]/15 px-3 py-2 text-sm font-semibold text-[var(--color-teal)] transition hover:bg-[var(--color-teal)]/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {brief ? 'Edit brief' : 'Create brief'}
          </button>
        </div>
        }
      />

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading editorial brief...</p>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-[var(--color-rose)]/35 bg-[var(--color-rose)]/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      ) : !brief ? (
        <div className="mt-4">
          <EmptyGuidance
            title="No editorial brief yet"
            description="Generate a draft from approved teaching rules or create one manually so objectives, cases, and graph work share the same intent."
          />
        </div>
      ) : (
        <BriefSummary
          brief={brief}
          onReview={onReview}
          disabled={isPending}
          canReview={canReviewBrief}
          reviewDisabledReason={reviewDisabledReason}
        />
      )}

      {formOpen ? (
        <BriefForm
          form={form}
          error={formError}
          teachingRules={teachingRules}
          editing={Boolean(brief)}
          onChange={setForm}
          onCancel={closeForm}
          onSubmit={submitForm}
        />
      ) : null}
    </section>
  );
}

function BriefSummary({
  brief,
  disabled,
  canReview,
  reviewDisabledReason,
  onReview,
}: {
  brief: DiagnosisEditorialBrief;
  disabled: boolean;
  canReview: boolean;
  reviewDisabledReason: string;
  onReview: (action: DiagnosisEditorialBriefReviewAction) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          status={formatLabel(brief.status)}
          tone={statusTone(brief.status)}
        />
        <StatusBadge status={`v${brief.version}`} tone="neutral" />
        <StatusBadge
          status={
            isGenerationActive(brief.status)
              ? 'Drives generation'
              : 'Not used for generation'
          }
          tone={isGenerationActive(brief.status) ? 'success' : 'neutral'}
        />
      </div>

      <p className="rounded-lg border border-[var(--color-navy-border)] bg-white/4 px-3 py-2 text-sm leading-6 text-slate-300">
        {brief.summary}
      </p>

      <div className="grid gap-2 md:grid-cols-2">
        <ListBlock label="Learning goals" values={jsonList(brief.learningGoals)} />
        <ListBlock
          label="Difficulty guidance"
          values={jsonList(brief.difficultyGuidance)}
        />
        <ListBlock
          label="Education guidance"
          values={jsonList(brief.educationGuidance)}
        />
        <ListBlock
          label="Case generation guidance"
          values={jsonList(brief.caseGenerationGuidance)}
        />
      </div>

      <CompactMetricGrid
        items={[
          {
            label: 'Required teaching rules',
            value: jsonList(brief.requiredTeachingRuleIds).length,
            tone: jsonList(brief.requiredTeachingRuleIds).length
              ? 'success'
              : 'warning',
          },
          {
            label: 'Required mimics',
            value: jsonList(brief.requiredMimicIds).length,
            tone: jsonList(brief.requiredMimicIds).length ? 'info' : 'neutral',
          },
          {
            label: 'Pitfalls',
            value: jsonList(brief.requiredPitfalls).length,
            tone: jsonList(brief.requiredPitfalls).length
              ? 'warning'
              : 'neutral',
          },
          {
            label: 'Generation state',
            value: isGenerationActive(brief.status) ? 'Active' : 'Draft',
            tone: isGenerationActive(brief.status) ? 'success' : 'warning',
          },
        ]}
      />

      <InlineReviewBar note="Brief decisions shape draft generation only; publishing remains a separate editorial step.">
        <ReviewButton
          label="Approve"
          action="approve"
          disabled={disabled || !canReview || brief.status === 'APPROVED'}
          title={!canReview ? reviewDisabledReason : undefined}
          onReview={onReview}
        />
        <ReviewButton
          label="Activate"
          action="activate"
          disabled={disabled || !canReview || brief.status === 'ACTIVE'}
          title={!canReview ? reviewDisabledReason : undefined}
          onReview={onReview}
        />
        <ReviewButton
          label="Needs review"
          action="needs_review"
          disabled={disabled || !canReview || brief.status === 'NEEDS_REVIEW'}
          title={!canReview ? reviewDisabledReason : undefined}
          onReview={onReview}
        />
        <ReviewButton
          label="Deprecate"
          action="deprecate"
          disabled={disabled || !canReview || brief.status === 'DEPRECATED'}
          title={!canReview ? reviewDisabledReason : undefined}
          onReview={onReview}
        />
      </InlineReviewBar>
    </div>
  );
}

function BriefForm({
  form,
  error,
  teachingRules,
  editing,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: BriefFormState;
  error: string | null;
  teachingRules: DiagnosisTeachingRulesResponse | null;
  editing: boolean;
  onChange: (form: BriefFormState) => void;
  onCancel: () => void;
  onSubmit: () => Promise<void>;
}) {
  const generationRules =
    teachingRules?.rules.filter(
      (rule) => rule.status === 'ACTIVE' || rule.status === 'APPROVED',
    ) ?? [];

  function patch(next: Partial<BriefFormState>) {
    onChange({ ...form, ...next });
  }

  function toggleRule(ruleId: string) {
    patch({
      requiredTeachingRuleIds: form.requiredTeachingRuleIds.includes(ruleId)
        ? form.requiredTeachingRuleIds.filter((id) => id !== ruleId)
        : [...form.requiredTeachingRuleIds, ruleId],
    });
  }

  return (
    <div className="mt-4 rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-100">
          {editing ? 'Edit editorial brief' : 'Create editorial brief'}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-semibold text-slate-400 hover:text-slate-200"
        >
          Cancel
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-[var(--color-rose)]/35 bg-[var(--color-rose)]/10 p-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <label className="mt-3 block text-sm font-medium text-slate-300">
        Summary
        <textarea
          value={form.summary}
          onChange={(event) => patch({ summary: event.target.value })}
          rows={3}
          className="mt-1 w-full rounded-lg border border-[var(--color-navy-border)] bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[var(--color-teal)]"
        />
      </label>

      <label className="mt-3 block text-sm font-medium text-slate-300">
        Status
        <select
          value={form.status}
          onChange={(event) =>
            patch({ status: event.target.value as DiagnosisEditorialBriefStatus })
          }
          className="mt-1 w-full rounded-lg border border-[var(--color-navy-border)] bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[var(--color-teal)] md:w-64"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {formatLabel(status)}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <TextareaField
          label="Learning goals"
          value={form.learningGoalsText}
          onChange={(value) => patch({ learningGoalsText: value })}
        />
        <TextareaField
          label="Difficulty guidance"
          value={form.difficultyGuidanceText}
          onChange={(value) => patch({ difficultyGuidanceText: value })}
        />
        <TextareaField
          label="Education guidance"
          value={form.educationGuidanceText}
          onChange={(value) => patch({ educationGuidanceText: value })}
        />
        <TextareaField
          label="Case generation guidance"
          value={form.caseGenerationGuidanceText}
          onChange={(value) => patch({ caseGenerationGuidanceText: value })}
        />
        <TextareaField
          label="Graph guidance"
          value={form.graphGuidanceText}
          onChange={(value) => patch({ graphGuidanceText: value })}
        />
        <TextareaField
          label="Management anchors"
          value={form.managementAnchorsText}
          onChange={(value) => patch({ managementAnchorsText: value })}
        />
        <TextareaField
          label="Key investigations"
          value={form.keyInvestigationsText}
          onChange={(value) => patch({ keyInvestigationsText: value })}
        />
        <TextareaField
          label="Pitfalls"
          value={form.requiredPitfallsText}
          onChange={(value) => patch({ requiredPitfallsText: value })}
        />
      </div>

      <div className="mt-3">
        <p className="text-sm font-semibold text-slate-100">
          Required teaching rules
        </p>
        {generationRules.length ? (
          <div className="mt-2 max-h-48 space-y-2 overflow-auto rounded-lg border border-[var(--color-navy-border)] bg-slate-950/50 p-2">
            {generationRules.map((rule) => (
              <label
                key={rule.id}
                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm text-slate-300 hover:bg-white/6"
              >
                <input
                  type="checkbox"
                  checked={form.requiredTeachingRuleIds.includes(rule.id)}
                  onChange={() => toggleRule(rule.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-slate-100">
                    {rule.title}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {formatLabel(rule.category)} · {formatLabel(rule.status)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-lg border border-[var(--color-navy-border)] bg-white/4 p-3 text-sm text-slate-500">
            No ACTIVE or APPROVED teaching rules are available yet.
          </p>
        )}
      </div>

      <label className="mt-3 block text-sm font-medium text-slate-300">
        Required mimic IDs
        <textarea
          value={form.requiredMimicIdsText}
          onChange={(event) => patch({ requiredMimicIdsText: event.target.value })}
          rows={2}
          className="mt-1 w-full rounded-lg border border-[var(--color-navy-border)] bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[var(--color-teal)]"
          placeholder="One diagnosis registry ID per line"
        />
      </label>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => void onSubmit()}
          className="rounded-lg border border-[var(--color-teal)]/40 bg-[var(--color-teal)]/15 px-4 py-2 text-sm font-semibold text-[var(--color-teal)] transition hover:bg-[var(--color-teal)]/20"
        >
          {editing ? 'Save brief' : 'Create brief'}
        </button>
      </div>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-slate-300">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="mt-1 w-full rounded-lg border border-[var(--color-navy-border)] bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[var(--color-teal)]"
        placeholder="One item per line"
      />
    </label>
  );
}

function ListBlock({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/4 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      {values.length ? (
        <ul className="mt-2 space-y-1 text-sm leading-5 text-slate-300">
          {values.slice(0, 4).map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">None listed</p>
      )}
    </div>
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
  action: DiagnosisEditorialBriefReviewAction;
  disabled: boolean;
  title?: string;
  onReview: (action: DiagnosisEditorialBriefReviewAction) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onReview(action)}
      disabled={disabled}
      title={title}
      className="editorial-action px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function toForm(brief: DiagnosisEditorialBrief): BriefFormState {
  return {
    summary: brief.summary,
    status: brief.status,
    learningGoalsText: jsonList(brief.learningGoals).join('\n'),
    requiredTeachingRuleIds: jsonList(brief.requiredTeachingRuleIds),
    requiredMimicIdsText: jsonList(brief.requiredMimicIds).join('\n'),
    requiredPitfallsText: jsonList(brief.requiredPitfalls).join('\n'),
    keyInvestigationsText: jsonList(brief.keyInvestigations).join('\n'),
    managementAnchorsText: jsonList(brief.managementAnchors).join('\n'),
    difficultyGuidanceText: jsonList(brief.difficultyGuidance).join('\n'),
    educationGuidanceText: jsonList(brief.educationGuidance).join('\n'),
    caseGenerationGuidanceText: jsonList(brief.caseGenerationGuidance).join('\n'),
    graphGuidanceText: jsonList(brief.graphGuidance).join('\n'),
  };
}

function toPayload(
  form: BriefFormState,
): DiagnosisEditorialBriefWritePayload | null {
  if (!form.summary.trim()) {
    return null;
  }

  return {
    summary: form.summary.trim(),
    status: form.status,
    learningGoals: parseLines(form.learningGoalsText),
    requiredTeachingRuleIds: form.requiredTeachingRuleIds,
    requiredMimicIds: parseLines(form.requiredMimicIdsText),
    requiredPitfalls: parseLines(form.requiredPitfallsText),
    keyInvestigations: parseLines(form.keyInvestigationsText),
    managementAnchors: parseLines(form.managementAnchorsText),
    difficultyGuidance: parseLines(form.difficultyGuidanceText),
    educationGuidance: parseLines(form.educationGuidanceText),
    caseGenerationGuidance: parseLines(form.caseGenerationGuidanceText),
    graphGuidance: parseLines(form.graphGuidanceText),
  };
}

function jsonList(value: JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
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

function firstString(...values: Array<JsonValue | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isGenerationActive(status: DiagnosisEditorialBriefStatus) {
  return status === 'APPROVED' || status === 'ACTIVE';
}

function statusTone(status: DiagnosisEditorialBriefStatus) {
  if (status === 'ACTIVE' || status === 'APPROVED') return 'success';
  if (status === 'NEEDS_REVIEW' || status === 'DRAFT') return 'warning';
  return 'danger';
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
