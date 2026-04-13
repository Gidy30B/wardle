import { useAuth } from '@clerk/clerk-react';
import { useMemo, useState } from 'react';
import { generateCases, type GenerateCasesResult } from '../../api/admin';
import { createApiClient } from '../../api/client';

export default function GeneratePage() {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [count, setCount] = useState(10);
  const [track, setTrack] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateCasesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    try {
      setLoading(true);
      setError(null);
      const response = await generateCases(client, {
        count,
        track: track || undefined,
        difficulty: difficulty || undefined,
      });
      setResult(response);
    } catch (generateError) {
      setError(
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

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="rounded-2xl bg-slate-950 p-4 shadow-sm">
          <pre className="overflow-x-auto text-sm text-slate-100">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
