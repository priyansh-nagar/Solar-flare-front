import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

interface ForecastWindow {
  lead_min: number;
  prob_m: number;
  prob_x: number;
  prob_c: number;
}

interface Props {
  windows: ForecastWindow[];
  confidence: number;
  leadTimePeak: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#060a0e]/96 border border-white/10 rounded px-2.5 py-2 text-[9px] font-mono shadow-xl">
      <div className="text-white/30 mb-1.5">T+{label} min</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span className="font-bold">{(p.value * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export function ForecastPanel({ windows, confidence, leadTimePeak }: Props) {
  return (
    <div className="h-full flex flex-col p-3 gap-2">
      <div className="flex items-center justify-between flex-shrink-0">
        <span className="text-[9px] font-mono text-white/35 uppercase tracking-widest">Predictive Forecast</span>
        <div className="flex items-center gap-3 text-[9px] font-mono">
          <span className="text-white/25">Lead peak</span>
          <span className="text-violet-400 font-bold">T+{leadTimePeak}min</span>
          <span className="text-white/25">Conf.</span>
          <span className="text-emerald-400 font-bold">{Math.round(confidence * 100)}%</span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={windows} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />
            <XAxis
              dataKey="lead_min"
              tickFormatter={(v) => `T+${v}`}
              tick={{ fill: "rgba(255,255,255,0.22)", fontSize: 8, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: "rgba(255,255,255,0.22)", fontSize: 8, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={false}
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
            />
            <ReferenceLine y={0.5} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 4" />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="prob_c" name="C-class" stroke="#eab308" strokeWidth={1.2} fill="#eab308" fillOpacity={0.06} dot={false} />
            <Area type="monotone" dataKey="prob_m" name="M-class" stroke="#f97316" strokeWidth={1.5} fill="#f97316" fillOpacity={0.10} dot={false} />
            <Area type="monotone" dataKey="prob_x" name="X-class" stroke="#ef4444" strokeWidth={1.5} fill="#ef4444" fillOpacity={0.12} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-4 flex-shrink-0 border-t border-white/[0.04] pt-2">
        {[
          { label: "C-class", prob: windows[windows.length - 1]?.prob_c ?? 0, color: "#eab308" },
          { label: "M-class", prob: windows[windows.length - 1]?.prob_m ?? 0, color: "#f97316" },
          { label: "X-class", prob: windows[windows.length - 1]?.prob_x ?? 0, color: "#ef4444" },
        ].map(({ label, prob, color }) => (
          <div key={label} className="flex-1 text-center">
            <div className="text-[8px] font-mono text-white/25 uppercase mb-0.5">{label}</div>
            <div className="text-sm font-bold font-mono" style={{ color }}>{Math.round(prob * 100)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
