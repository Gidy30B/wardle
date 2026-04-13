import type { WrongGuessPoint } from '../../api/admin';

type WrongGuessesPanelProps = {
  data: WrongGuessPoint[];
};

export default function WrongGuessesPanel({ data }: WrongGuessesPanelProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-3 text-base font-semibold text-slate-900">Top Wrong Guesses</h3>
      <div className="space-y-2">
        {data.length === 0 ? (
          <p className="text-sm text-slate-500">No wrong-guess data yet.</p>
        ) : (
          data.map((item) => (
            <div
              key={item.guess}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <span className="text-slate-700">{item.guess}</span>
              <span className="font-semibold text-slate-900">{item.count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
