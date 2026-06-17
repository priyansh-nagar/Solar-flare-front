import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { format } from "date-fns";

interface ForecastPoint {
  time: string;
  b: number;
  c: number;
  m: number;
  x: number;
}

interface Props {
  series: ForecastPoint[];
}

const LINES = [
  { key: "b", label: "B-class", color: "#38bdf8" },
  { key: "c", label: "C-class", color: "#a78bfa" },
  { key: "m", label: "M-class", color: "#fb923c" },
  { key: "x", label: "X-class", color: "#f87171" },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const time = label ? format(new Date(label), "HH:mm") + " UTC" : "";
  return (
    <div className="bg-[#0a0c0f] border border-white/10 rounded px-3 py-2 shadow-xl text-xs font-mono">
      <div className="text-white/40 mb-2">{time}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span className="font-bold">{(p.value * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export function ForecastChart({ series }: Props) {
  const formatted = series.map((d) => ({
    ...d,
    label: format(new Date(d.time), "HH:mm"),
  }));

  return (
    <div className="h-full flex flex-col p-3 gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Flare Probability Forecast</span>
        <span className="text-[10px] font-mono text-white/20">24h · UTC</span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formatted} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={false}
              interval={3}
            />
            <YAxis
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={false}
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0.5} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
            {LINES.map((l) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                name={l.label}
                stroke={l.color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: l.color, strokeWidth: 0 }}
              />
            ))}
            <Legend
              wrapperStyle={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.4)", paddingTop: 4 }}
              iconType="plainline"
              iconSize={12}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
