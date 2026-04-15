import { useAuth } from '@clerk/clerk-react';
import { useMemo, useState } from 'react';
import { generateCases, type GenerateCasesResult } from '../../api/admin';
import { createApiClient } from '../../api/client';
import ActionFeedback from '../../components/ui/ActionFeedback';
import { useActionFeedback } from '../../hooks/useActionFeedback';

function summarizeResults(result: GenerateCasesResult) {
  return {
    created: result.results.filter((item) => item.status === 'created'),
    skipped: result.results.filter((item) => item.status === 'skipped'),
    failed: result.results.filter((item) => item.status === 'failed'),
  };
}

export default function GeneratePage() {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [count, setCount] = useState(10);
  const [track, setTrack] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateCasesResult | null>(null);
  const feedback = useActionFeedback();
  const summary = result ? summarizeResults(result) : null;

  async function handleGenerate() {
    try {
      setLoading(true);
      feedback.showPending('Generating cases. This may take a few moments.');
      const response = await generateCases(client, {
        count,
        track: track || undefined,
        difficulty: difficulty || undefined,
      });
      setResult(response);
      feedback.showSuccess(
        `Batch complete: ${response.created} created, ${response.skipped} skipped, ${response.failed} failed.`,
      );
    } catch (generateError) {
      feedback.showError(
        generateError instanceof Error
          ? generateError.message
          : 'Failed to generate cases',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <ActionFeedback
        feedback={feedback.feedback}
        onDismiss={loading ? undefined : feedback.clear}
      />

      <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Count</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Difficulty</span>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
          >
            <option value="">Default</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Track</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
            placeholder="Optional specialty track"
            value={track}
            onChange={(event) => setTrack(event.target.value)}
          />
        </label>

        <div className="md:col-span-2">
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleGenerate}
            disabled={loading}
            type="button"
          >
            {loading ? 'Generating...' : 'Generate Cases'}
          </button>
        </div>
      </div>

      {result && summary ? (
        <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Batch complete
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                Case generation summary
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Review the batch outcome before moving into the editorial queue.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Batch ID: <span className="font-semibold text-slate-900">{result.batchId}</span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Requested
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{result.requested}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Created
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{result.created}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                Skipped
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{result.skipped}</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">
                Failed
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{result.failed}</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Created cases</h3>
              {summary.created.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No cases were created in this batch.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {summary.created.map((item) => (
                    <div
                      key={`${item.caseId}-${item.index}`}
                      className="rounded-lg border border-white bg-white px-3 py-2 text-sm"
                    >
                      <p className="font-semibold text-slate-900">{item.answer}</p>
                      <p className="mt-1 text-xs text-slate-500">Case ID: {item.caseId}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Skipped entries</h3>
              {summary.skipped.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No cases were skipped in this batch.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {summary.skipped.map((item) => (
                    <div
                      key={`${item.answer}-${item.index}`}
                      className="rounded-lg border border-white bg-white px-3 py-2 text-sm"
                    >
                      <p className="font-semibold text-slate-900">{item.answer}</p>
                      <p className="mt-1 text-xs text-slate-500">Reason: duplicate answer</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Failed entries</h3>
              {summary.failed.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No failures were reported in this batch.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {summary.failed.map((item) => (
                    <div
                      key={`${item.index}-${item.error}`}
                      className="rounded-lg border border-white bg-white px-3 py-2 text-sm"
                    >
                      <p className="font-semibold text-slate-900">Item {item.index + 1}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.error}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
