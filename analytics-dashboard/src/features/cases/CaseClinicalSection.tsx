import type { EditorialCaseDetail } from '../../api/admin';
import EmptyState from '../../components/ui/EmptyState';
import CaseDetailSection from './CaseDetailSection';
import StructuredDataView from './StructuredDataView';
import type { CaseClue } from './case.transforms';
import { formatLabel } from './cases.helpers';

type CaseClinicalSectionProps = {
  detail: EditorialCaseDetail;
  clues: CaseClue[];
  showLegacyFallback: boolean;
};

function LegacyFallback({ detail }: { detail: EditorialCaseDetail }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        Legacy fallback
      </p>
      <p className="mt-2 text-sm text-slate-600">
        History and symptoms are only shown here because structured clues were not available.
      </p>
      <div className="mt-4 grid gap-3">
        {detail.history ? (
          <div className="rounded-lg bg-white px-3 py-3">
            <p className="text-sm font-semibold text-slate-900">History</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
              {detail.history}
            </p>
          </div>
        ) : null}
        {detail.symptoms.length > 0 ? (
          <div className="rounded-lg bg-white px-3 py-3">
            <p className="text-sm font-semibold text-slate-900">Symptoms</p>
            <StructuredDataView
              data={detail.symptoms}
              emptyLabel="No symptoms recorded."
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function CaseClinicalSection({
  detail,
  clues,
  showLegacyFallback,
}: CaseClinicalSectionProps) {
  return (
    <>
      <CaseDetailSection
        title="Clinical clues"
        description="Clues are the canonical case body and stay in the order they are revealed."
      >
        <div className="space-y-3">
          {clues.length > 0 ? (
            <div className="space-y-2.5">
              {clues.map((clue) => (
                <div
                  key={`${clue.order}-${clue.type}-${clue.value}`}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                      {clue.order}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                          {formatLabel(clue.type)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                        {clue.value}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No playable clues recorded"
              description="This case does not currently expose clue content in the expected ordered structure."
            />
          )}

          {showLegacyFallback ? <LegacyFallback detail={detail} /> : null}
        </div>
      </CaseDetailSection>

      <CaseDetailSection
        title="Differentials and explanation"
        description="Use this section to compare the current diagnostic framing against the clue progression."
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-white px-3 py-3">
            <p className="text-sm font-semibold text-slate-900">Differentials</p>
            <div className="mt-2">
              <StructuredDataView
                data={detail.differentials}
                emptyLabel="No differentials recorded."
              />
            </div>
          </div>

          <CaseDetailSection
            title="Explanation and supporting data"
            description="Expanded only when reviewers need the deeper rationale or extra legacy context."
            collapsible
            defaultOpen={false}
          >
            <div className="space-y-3">
              <div className="rounded-lg bg-white px-3 py-3">
                <p className="text-sm font-semibold text-slate-900">Explanation</p>
                <div className="mt-2">
                  <StructuredDataView
                    data={detail.explanation}
                    emptyLabel="No explanation recorded."
                  />
                </div>
              </div>
              {detail.labs ? (
                <div className="rounded-lg bg-white px-3 py-3">
                  <p className="text-sm font-semibold text-slate-900">Labs</p>
                  <div className="mt-2">
                    <StructuredDataView
                      data={detail.labs}
                      emptyLabel="No labs recorded."
                    />
                  </div>
                </div>
              ) : null}
              {showLegacyFallback ? <LegacyFallback detail={detail} /> : null}
            </div>
          </CaseDetailSection>
        </div>
      </CaseDetailSection>
    </>
  );
}
