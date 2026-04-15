import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AttemptsPoint } from '../../api/admin';

type AttemptsChartProps = {
  data: AttemptsPoint[];
};

export default function AttemptsChart({ data }: AttemptsChartProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Attempts over time
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Trend context for overall activity. Use this after reviewing the editorial and
          validation queues.
        </p>
      </div>

      <div className="h-[240px] w-full rounded-xl border border-white bg-white p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="time" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="attempts"
              stroke="#0f172a"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
