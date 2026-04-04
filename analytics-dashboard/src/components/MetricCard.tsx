type MetricCardProps = {
  title: string;
  value: string | number;
};

export default function MetricCard({ title, value }: MetricCardProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
