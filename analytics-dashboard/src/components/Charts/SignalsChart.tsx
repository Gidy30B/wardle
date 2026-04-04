import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer } from 'recharts';

type SignalData = {
  embeddingAvg: number;
  fuzzyAvg: number;
  ontologyAvg: number;
};

type SignalsChartProps = {
  data: SignalData;
};

const colors = ['#6366f1', '#22c55e', '#f59e0b'];

export default function SignalsChart({ data }: SignalsChartProps) {
  const formatted = [
    { name: 'Embedding', value: data.embeddingAvg },
    { name: 'Fuzzy', value: data.fuzzyAvg },
    { name: 'Ontology', value: data.ontologyAvg },
  ];

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-3 text-base font-semibold text-slate-900">Signal Distribution</h3>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={formatted} dataKey="value" nameKey="name" outerRadius={90}>
              {formatted.map((entry, index) => (
                <Cell key={entry.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
