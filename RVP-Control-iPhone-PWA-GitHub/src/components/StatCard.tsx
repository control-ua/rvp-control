interface Props {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: 'blue' | 'green' | 'amber' | 'violet' | 'red' | 'slate';
  trend?: { value: string; positive: boolean };
}

const accentMap: Record<string, string> = {
  blue: 'bg-blue-600/15 text-blue-400',
  green: 'bg-emerald-600/15 text-emerald-400',
  amber: 'bg-amber-600/15 text-amber-400',
  violet: 'bg-violet-600/15 text-violet-400',
  red: 'bg-red-600/15 text-red-400',
  slate: 'bg-slate-600/15 text-slate-400',
};

export default function StatCard({ title, value, sub, icon, accent = 'blue', trend }: Props) {
  return (
    <div className="bg-[#141720] border border-white/5 rounded-xl p-5 flex flex-col gap-3 hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accentMap[accent]}`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            trend.positive ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
          }`}>
            {trend.positive ? '+' : ''}{trend.value}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-slate-400 mt-0.5">{title}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}
