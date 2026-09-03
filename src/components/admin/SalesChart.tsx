'use client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { formatPrice } from '@/utils';

interface DayData {
  fecha: string;        // 'DD/MM'
  ventas: number;       // ARS
  pedidos: number;
}

interface Props {
  data:     DayData[];
  periodo:  '7d' | '30d';
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-xl text-sm">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-muted">
          {p.name === 'ventas'
            ? `💰 ${formatPrice(p.value)}`
            : `📦 ${p.value} pedidos`}
        </p>
      ))}
    </div>
  );
};

export function SalesChart({ data, periodo }: Props) {
  const hasData = data.some((d) => d.ventas > 0);

  if (!hasData) {
    return (
      <div className="flex h-48 items-center justify-center text-muted text-sm">
        <p>Sin ventas confirmadas en este período.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#2c4270" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#2c4270" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.2)" />
          <XAxis
            dataKey="fecha"
            tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.5 }}
            tickLine={false}
            axisLine={false}
            interval={periodo === '30d' ? 4 : 0}
          />
          <YAxis
            tickFormatter={(v: number) =>
              v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
            }
            tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.5 }}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="ventas"
            name="ventas"
            stroke="#2c4270"
            strokeWidth={2.5}
            fill="url(#colorVentas)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0, fill: '#2c4270' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
