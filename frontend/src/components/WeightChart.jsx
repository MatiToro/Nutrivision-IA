import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dayMonth, fmtLongDate } from '../utils/dates';

/** Evolución de peso con la fecha real de cada registro. `logs`: [{ weightKg, loggedAt }]. */
export default function WeightChart({ logs, height = 220 }) {
  const data = logs.map((w) => ({ label: dayMonth(new Date(w.loggedAt)), date: w.loggedAt, peso: w.weightKg }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="weightFillShared" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#189B4E" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#189B4E" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#E4E6EA" />
        <XAxis dataKey="label" stroke="#9AA0A8" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#9AA0A8" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={{ fontFamily: 'var(--font-body)', borderRadius: 12, border: 'none', boxShadow: '0 6px 16px rgba(23,25,28,0.12)' }}
          formatter={(v) => [`${String(v).replace('.', ',')} kg`, 'Peso']}
          labelFormatter={(_, items) => (items?.[0]?.payload?.date ? fmtLongDate(items[0].payload.date) : '')}
        />
        <Area
          type="monotone"
          dataKey="peso"
          stroke="#189B4E"
          strokeWidth={3}
          fill="url(#weightFillShared)"
          dot={{ r: 4, fill: '#fff', stroke: '#189B4E', strokeWidth: 2.5 }}
          activeDot={{ r: 6 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
