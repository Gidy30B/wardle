import MetricCard from '../../components/MetricCard';

type DashboardStatsProps = {
  totalCases: number;
  averageAccuracy: number;
  totalAttempts: number;
};

export default function DashboardStats({
  totalCases,
  averageAccuracy,
  totalAttempts,
}: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <MetricCard title="Total Cases" value={totalCases} />
      <MetricCard title="Average Accuracy" value={`${averageAccuracy.toFixed(2)}%`} />
      <MetricCard title="Total Attempts" value={totalAttempts} />
    </div>
  );
}
