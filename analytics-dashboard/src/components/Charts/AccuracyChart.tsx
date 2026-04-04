import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type AccuracyPoint = {
  caseId: string;
  accuracy: number;
};

type AccuracyChartProps = {
  data: AccuracyPoint[];
};

export default function AccuracyChart({ data }: AccuracyChartProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-3 text-base font-semibold text-slate-900">Accuracy Per Case</h3>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="caseId" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 1]} />
            <Tooltip />
            <Bar dataKey="accuracy" fill="#0ea5e9" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
