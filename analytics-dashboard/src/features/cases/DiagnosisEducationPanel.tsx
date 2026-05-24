import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createDiagnosisEducationForAdmin,
  generateDiagnosisEducationDraft,
  getDiagnosisEducationForAdmin,
  reviewDiagnosisEducationForAdmin,
  updateDiagnosisEducationForAdmin,
  type DiagnosisEducationDifferential,
  type DiagnosisEducationPearl,
  type DiagnosisEducationRecord,
  type DiagnosisEducationStatus,
  type JsonValue,
  type UpsertDiagnosisEducationPayload,
} from '../../api/admin';
import { ApiError, type ApiClient } from '../../api/client';
import ActionFeedback from '../../components/ui/ActionFeedback';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import { useActionFeedback } from '../../hooks/useActionFeedback';
import CaseDetailSection from './CaseDetailSection';
import { formatDateLabel } from './cases.helpers';

type DiagnosisEducationPanelProps = {
  client: ApiClient;
  diagnosisRegistryId: string | null;
  diagnosisLabel: string;
};

type EducationFormState = {
  title: string;
  definition: string;
  highYieldTakeaway: string;
  clinicalPatternText: string;
  examPearls: DiagnosisEducationPearl[];
  differentials: DiagnosisEducationDifferential[];
  pitfallsText: string;
  referencesText: string;
  scoringSystemsJson: string;
  investigationsJson: string;
  managementJson: string;
  complicationsJson: string;
  recallPromptsJson: string;
};

const emptyForm: EducationFormState = {
  title: '',
  definition: '',
  highYieldTakeaway: '',
  clinicalPatternText: '',
  examPearls: [{ label: '', explanation: '' }],
  differentials: [{ diagnosis: '', distinguishingPoint: '' }],
  pitfallsText: '',
  referencesText: '',
  scoringSystemsJson: '',
  investigationsJson: '',
  managementJson: '',
  complicationsJson: '',
  recallPromptsJson: '',
};

const reviewableStatuses = new Set<DiagnosisEducationStatus>([
  'DRAFT',
  'GENERATED',
  'NEEDS_REVIEW',
  'NEEDS_EDIT',
  'APPROVED',
]);

export default function DiagnosisEducationPanel({
  client,
  diagnosisRegistryId,
  diagnosisLabel,
}: DiagnosisEducationPanelProps) {
  const [education, setEducation] = useState<DiagnosisEducationRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [form, setForm] = useState<EducationFormState>(emptyForm);
  const generateInFlightRef = useRef(false);
  const { feedback, clear, showError, showPending, showSuccess } =
    useActionFeedback();

  const isPublished = education?.editorialStatus === 'PUBLISHED';
  const canEdit = !isPublished;
  const canGenerate = Boolean(diagnosisRegistryId && !isPublished);

  useEffect(() => {
    if (!diagnosisRegistryId) {
      setEducation(null);
      setLoadError(null);
      setLoading(false);
      setForm({ ...emptyForm, title: diagnosisLabel });
      setEditorOpen(false);
      return;
    }

    let active = true;
    const registryId = diagnosisRegistryId;

    async function loadEducation() {
      try {
        setLoading(true);
        setLoadError(null);
        const response = await getDiagnosisEducationForAdmin(
          client,
          registryId,
        );
        if (!active) {
          return;
        }

        setEducation(response.education);
        setForm(toFormState(response.education, response.diagnosisRegistry.canonicalName));
        setEditorOpen(!response.education);
      } catch (error) {
        if (!active) {
          return;
        }

        if (
          error instanceof ApiError &&
          error.status === 404 &&
          !error.message.toLowerCase().includes('not available')
        ) {
          setEducation(null);
          setForm({ ...emptyForm, title: diagnosisLabel });
          setEditorOpen(true);
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Failed to load diagnosis education.',
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadEducation();

    return () => {
      active = false;
    };
  }, [client, diagnosisLabel, diagnosisRegistryId]);

  const preview = useMemo(() => toPreview(form, education), [education, form]);

  async function refreshEducation() {
    if (!diagnosisRegistryId) {
      return;
    }

    const response = await getDiagnosisEducationForAdmin(
      client,
      diagnosisRegistryId,
    );
    setEducation(response.education);
    setForm(toFormState(response.education, response.diagnosisRegistry.canonicalName));
    setEditorOpen(!response.education);
  }

  async function runAction(config: {
    id: string;
    pending: string;
    success: string;
    action: () => Promise<unknown>;
  }) {
    try {
      setPendingAction(config.id);
      showPending(config.pending);
      await config.action();
      await refreshEducation();
      showSuccess(config.success);
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Action failed.');
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  async function handleGenerate() {
    if (
      generateInFlightRef.current ||
      pendingAction !== null ||
      !diagnosisRegistryId ||
      !canGenerate
    ) {
      return;
    }

    generateInFlightRef.current = true;
    setPendingAction('generate');
    const confirmed = window.confirm(
      `Generate an AI-assisted education draft for ${diagnosisLabel}? The draft will require review before learners can see it.`,
    );
    if (!confirmed) {
      generateInFlightRef.current = false;
      setPendingAction(null);
      return;
    }

    try {
      await runAction({
        id: 'generate',
        pending: 'Generating education draft...',
        success: 'Education draft generated for review.',
        action: () => generateDiagnosisEducationDraft(client, diagnosisRegistryId),
      });
    } finally {
      generateInFlightRef.current = false;
    }
  }

  async function handleSave() {
    if (!diagnosisRegistryId) {
      return;
    }

    const payload = buildPayload(form);
    if (!payload) {
      return;
    }

    await runAction({
      id: 'save',
      pending: 'Saving education content...',
      success: 'Education content saved.',
      action: () =>
        education
          ? updateDiagnosisEducationForAdmin(client, education.id, payload)
          : createDiagnosisEducationForAdmin(client, diagnosisRegistryId, payload),
    });
  }

  async function handleReview(status: DiagnosisEducationStatus) {
    if (!education) {
      return;
    }

    await runAction({
      id: `review-${status}`,
      pending: 'Updating education review status...',
      success:
        status === 'PUBLISHED'
          ? 'Education published for eligible learners.'
          : 'Education review status updated.',
      action: () =>
        reviewDiagnosisEducationForAdmin(client, education.id, { status }),
    });
  }

  function buildPayload(state: EducationFormState): UpsertDiagnosisEducationPayload | null {
    try {
      return {
        title: state.title.trim() || diagnosisLabel,
        summary: {
          definition: state.definition.trim(),
          highYieldTakeaway: state.highYieldTakeaway.trim() || undefined,
        },
        clinicalPattern: parseLines(state.clinicalPatternText),
        examPearls: state.examPearls
          .map((pearl) => ({
            label: pearl.label.trim(),
            explanation: pearl.explanation.trim(),
          }))
          .filter((pearl) => pearl.label && pearl.explanation),
        differentials: state.differentials
          .map((item) => ({
            diagnosis: item.diagnosis.trim(),
            distinguishingPoint: item.distinguishingPoint.trim(),
          }))
          .filter((item) => item.diagnosis && item.distinguishingPoint),
        pitfalls: parseLines(state.pitfallsText),
        references: parseLines(state.referencesText),
        scoringSystems: parseJsonField(state.scoringSystemsJson, 'Scoring systems'),
        investigations: parseJsonField(state.investigationsJson, 'Investigations'),
        management: parseJsonField(state.managementJson, 'Management'),
        complications: parseJsonField(state.complicationsJson, 'Complications'),
        recallPrompts: parseJsonField(state.recallPromptsJson, 'Recall prompts'),
      };
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Invalid education payload.');
      return null;
    }
  }

  if (!diagnosisRegistryId) {
    return (
      <CaseDetailSection
        title="Learn Pearls"
        description="Link the case to a diagnosis registry entry before creating reusable diagnosis education."
      >
        <p className="text-sm text-slate-500">
          Diagnosis-level education needs a registry ID so it can be reused across cases.
        </p>
      </CaseDetailSection>
    );
  }

  return (
    <CaseDetailSection
      title="Learn Pearls"
      description="Diagnosis-level education that powers reusable learner notes. TODO: move this to a diagnosis registry detail page when that workspace exists."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {education ? (
            <>
              <StatusBadge status={education.editorialStatus} />
              <StatusBadge status={education.source} tone="info" />
            </>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <ActionFeedback
          feedback={feedback}
          onDismiss={pendingAction ? undefined : clear}
        />

        {loading ? (
          <LoadingState
            title="Loading Learn Pearls"
            description="Fetching diagnosis education content."
          />
        ) : loadError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {loadError}
          </div>
        ) : (
          <>
            <HeaderState
              education={education}
              diagnosisLabel={diagnosisLabel}
              onCreateManually={() => setEditorOpen(true)}
              onGenerate={() => void handleGenerate()}
              generateDisabled={!canGenerate || pendingAction !== null}
              pendingAction={pendingAction}
            />

            {isPublished ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                Published education cannot be overwritten by AI generation.
                Archive or edit manually first.
              </div>
            ) : null}

            <EducationPreview preview={preview} />

            {canEdit && editorOpen ? (
              <EducationEditor
                form={form}
                advancedOpen={advancedOpen}
                disabled={pendingAction !== null}
                onAdvancedOpenChange={setAdvancedOpen}
                onFormChange={setForm}
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {canEdit ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditorOpen((value) => !value)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    {editorOpen ? 'Hide editor' : 'Edit content'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={pendingAction !== null}
                    className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingAction === 'save' ? 'Saving...' : 'Save changes'}
                  </button>
                </>
              ) : null}

              {education && reviewableStatuses.has(education.editorialStatus) ? (
                <>
                  {education.editorialStatus !== 'APPROVED' ? (
                    <button
                      type="button"
                      onClick={() => void handleReview('APPROVED')}
                      disabled={pendingAction !== null}
                      className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Approve
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleReview('PUBLISHED')}
                    disabled={pendingAction !== null}
                    className="rounded-xl border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Publish
                  </button>
                </>
              ) : null}

              {education ? (
                <button
                  type="button"
                  onClick={() => void handleReview('ARCHIVED')}
                  disabled={pendingAction !== null}
                  className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Archive
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </CaseDetailSection>
  );
}

function HeaderState({
  education,
  diagnosisLabel,
  generateDisabled,
  pendingAction,
  onCreateManually,
  onGenerate,
}: {
  education: DiagnosisEducationRecord | null;
  diagnosisLabel: string;
  generateDisabled: boolean;
  pendingAction: string | null;
  onCreateManually: () => void;
  onGenerate: () => void;
}) {
  if (!education) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">
          No education content yet
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Create reviewed Learn Pearls for {diagnosisLabel}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={generateDisabled}
            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === 'generate' ? 'Generating...' : 'Generate Draft'}
          </button>
          <button
            type="button"
            onClick={onCreateManually}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Create Manually
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <MetaTile label="Version" value={`v${education.version}`} />
      <MetaTile label="Generated" value={formatDateLabel(education.generatedAt)} />
      <MetaTile label="Reviewed" value={formatDateLabel(education.reviewedAt)} />
      <MetaTile label="Published" value={formatDateLabel(education.publishedAt)} />
      <MetaTile label="Updated" value={formatDateLabel(education.updatedAt)} />
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function EducationEditor({
  form,
  advancedOpen,
  disabled,
  onAdvancedOpenChange,
  onFormChange,
}: {
  form: EducationFormState;
  advancedOpen: boolean;
  disabled: boolean;
  onAdvancedOpenChange: (value: boolean) => void;
  onFormChange: (form: EducationFormState) => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <TextInput
        label="Title"
        value={form.title}
        disabled={disabled}
        onChange={(title) => onFormChange({ ...form, title })}
      />
      <TextArea
        label="Summary definition"
        value={form.definition}
        disabled={disabled}
        onChange={(definition) => onFormChange({ ...form, definition })}
      />
      <TextArea
        label="High-yield takeaway"
        value={form.highYieldTakeaway}
        disabled={disabled}
        onChange={(highYieldTakeaway) =>
          onFormChange({ ...form, highYieldTakeaway })
        }
      />
      <TextArea
        label="Recognition pattern"
        hint="One bullet per line"
        value={form.clinicalPatternText}
        disabled={disabled}
        onChange={(clinicalPatternText) =>
          onFormChange({ ...form, clinicalPatternText })
        }
      />
      <PearlRows
        rows={form.examPearls}
        disabled={disabled}
        onChange={(examPearls) => onFormChange({ ...form, examPearls })}
      />
      <DifferentialRows
        rows={form.differentials}
        disabled={disabled}
        onChange={(differentials) => onFormChange({ ...form, differentials })}
      />
      <TextArea
        label="Pitfalls"
        hint="One bullet per line"
        value={form.pitfallsText}
        disabled={disabled}
        onChange={(pitfallsText) => onFormChange({ ...form, pitfallsText })}
      />
      <TextArea
        label="References"
        hint="One reference per line"
        value={form.referencesText}
        disabled={disabled}
        onChange={(referencesText) =>
          onFormChange({ ...form, referencesText })
        }
      />

      <details
        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
        open={advancedOpen}
        onToggle={(event) =>
          onAdvancedOpenChange(event.currentTarget.open)
        }
      >
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Advanced JSON sections
        </summary>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <TextArea
            label="Scoring systems JSON"
            value={form.scoringSystemsJson}
            disabled={disabled}
            onChange={(scoringSystemsJson) =>
              onFormChange({ ...form, scoringSystemsJson })
            }
          />
          <TextArea
            label="Investigations JSON"
            value={form.investigationsJson}
            disabled={disabled}
            onChange={(investigationsJson) =>
              onFormChange({ ...form, investigationsJson })
            }
          />
          <TextArea
            label="Management JSON"
            value={form.managementJson}
            disabled={disabled}
            onChange={(managementJson) =>
              onFormChange({ ...form, managementJson })
            }
          />
          <TextArea
            label="Complications JSON"
            value={form.complicationsJson}
            disabled={disabled}
            onChange={(complicationsJson) =>
              onFormChange({ ...form, complicationsJson })
            }
          />
          <TextArea
            label="Recall prompts JSON"
            value={form.recallPromptsJson}
            disabled={disabled}
            onChange={(recallPromptsJson) =>
              onFormChange({ ...form, recallPromptsJson })
            }
          />
        </div>
      </details>
    </div>
  );
}

function TextInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      <input
        type="text"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      <textarea
        className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <span className="block text-sm text-slate-500">{hint}</span> : null}
    </label>
  );
}

function PearlRows({
  rows,
  disabled,
  onChange,
}: {
  rows: DiagnosisEducationPearl[];
  disabled: boolean;
  onChange: (rows: DiagnosisEducationPearl[]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Exam pearls
      </p>
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
          <input
            type="text"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Label"
            value={row.label}
            disabled={disabled}
            onChange={(event) =>
              onChange(replaceAt(rows, index, { ...row, label: event.target.value }))
            }
          />
          <input
            type="text"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Explanation"
            value={row.explanation}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                replaceAt(rows, index, {
                  ...row,
                  explanation: event.target.value,
                }),
              )
            }
          />
          <button
            type="button"
            disabled={disabled || rows.length === 1}
            onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...rows, { label: '', explanation: '' }])}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
      >
        Add pearl
      </button>
    </div>
  );
}

function DifferentialRows({
  rows,
  disabled,
  onChange,
}: {
  rows: DiagnosisEducationDifferential[];
  disabled: boolean;
  onChange: (rows: DiagnosisEducationDifferential[]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Differential distinguishers
      </p>
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
          <input
            type="text"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Diagnosis"
            value={row.diagnosis}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                replaceAt(rows, index, {
                  ...row,
                  diagnosis: event.target.value,
                }),
              )
            }
          />
          <input
            type="text"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Distinguishing point"
            value={row.distinguishingPoint}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                replaceAt(rows, index, {
                  ...row,
                  distinguishingPoint: event.target.value,
                }),
              )
            }
          />
          <button
            type="button"
            disabled={disabled || rows.length === 1}
            onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onChange([...rows, { diagnosis: '', distinguishingPoint: '' }])
        }
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
      >
        Add distinguisher
      </button>
    </div>
  );
}

function EducationPreview({
  preview,
}: {
  preview: {
    takeaway: string;
    recognition: string[];
    pearls: DiagnosisEducationPearl[];
    differentials: DiagnosisEducationDifferential[];
    pitfalls: string[];
  };
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Learner preview</p>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <PreviewBlock title="High-yield takeaway" items={[preview.takeaway]} />
        <PreviewBlock title="Recognition pattern" items={preview.recognition} />
        <PreviewBlock
          title="Exam pearls"
          items={preview.pearls.map(
            (pearl) => `${pearl.label}: ${pearl.explanation}`,
          )}
        />
        <PreviewBlock
          title="Differential distinguishers"
          items={preview.differentials.map(
            (item) => `${item.diagnosis}: ${item.distinguishingPoint}`,
          )}
        />
        <PreviewBlock title="Pitfalls" items={preview.pitfalls} />
      </div>
    </div>
  );
}

function PreviewBlock({ title, items }: { title: string; items: string[] }) {
  const visibleItems = items.filter((item) => item.trim().length > 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>
      {visibleItems.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
          {visibleItems.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No reviewed notes yet.</p>
      )}
    </div>
  );
}

function toFormState(
  education: DiagnosisEducationRecord | null,
  fallbackTitle: string,
): EducationFormState {
  if (!education) {
    return { ...emptyForm, title: fallbackTitle };
  }

  const summary = asRecord(education.summary);
  return {
    title: education.title,
    definition: typeof summary.definition === 'string' ? summary.definition : '',
    highYieldTakeaway:
      typeof summary.highYieldTakeaway === 'string'
        ? summary.highYieldTakeaway
        : '',
    clinicalPatternText: stringifyLines(education.clinicalPattern),
    examPearls: parsePearls(education.examPearls),
    differentials: parseDifferentials(education.differentials),
    pitfallsText: stringifyLines(education.pitfalls),
    referencesText: stringifyLines(education.references),
    scoringSystemsJson: stringifyJson(education.scoringSystems),
    investigationsJson: stringifyJson(education.investigations),
    managementJson: stringifyJson(education.management),
    complicationsJson: stringifyJson(education.complications),
    recallPromptsJson: stringifyJson(education.recallPrompts),
  };
}

function toPreview(
  form: EducationFormState,
  education: DiagnosisEducationRecord | null,
) {
  const hydrated = education ? toFormState(education, form.title) : form;
  return {
    takeaway: hydrated.highYieldTakeaway || hydrated.definition,
    recognition: parseLines(hydrated.clinicalPatternText),
    pearls: hydrated.examPearls.filter((pearl) => pearl.label && pearl.explanation),
    differentials: hydrated.differentials.filter(
      (item) => item.diagnosis && item.distinguishingPoint,
    ),
    pitfalls: parseLines(hydrated.pitfallsText),
  };
}

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function stringifyLines(value: JsonValue | null): string {
  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .join('\n');
}

function stringifyJson(value: JsonValue | null): string {
  return value === null ? '' : JSON.stringify(value, null, 2);
}

function parseJsonField(value: string, label: string): JsonValue | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

function parsePearls(value: JsonValue | null): DiagnosisEducationPearl[] {
  if (!Array.isArray(value)) {
    return [{ label: '', explanation: '' }];
  }

  const rows = value
    .map((item) => asRecord(item))
    .map((item) => ({
      label: typeof item.label === 'string' ? item.label : '',
      explanation:
        typeof item.explanation === 'string' ? item.explanation : '',
    }))
    .filter((item) => item.label || item.explanation);

  return rows.length > 0 ? rows : [{ label: '', explanation: '' }];
}

function parseDifferentials(
  value: JsonValue | null,
): DiagnosisEducationDifferential[] {
  if (!Array.isArray(value)) {
    return [{ diagnosis: '', distinguishingPoint: '' }];
  }

  const rows = value
    .map((item) => asRecord(item))
    .map((item) => ({
      diagnosis: typeof item.diagnosis === 'string' ? item.diagnosis : '',
      distinguishingPoint:
        typeof item.distinguishingPoint === 'string'
          ? item.distinguishingPoint
          : '',
    }))
    .filter((item) => item.diagnosis || item.distinguishingPoint);

  return rows.length > 0 ? rows : [{ diagnosis: '', distinguishingPoint: '' }];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function replaceAt<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, itemIndex) => (itemIndex === index ? value : item));
}
