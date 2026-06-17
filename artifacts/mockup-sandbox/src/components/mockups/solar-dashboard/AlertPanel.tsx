import type { SolarPrediction } from "./api";

interface Props {
  prediction: SolarPrediction;
}

type AlertLevel = "NORMAL" | "ELEVATED" | "HIGH" | "SEVERE";

function getAlertLevel(m: number, x: number): AlertLevel {
  if (x > 0.15) return "SEVERE";
  if (m > 0.35 || x > 0.05) return "HIGH";
  if (m > 0.15) return "ELEVATED";
  return "NORMAL";
}

const levelConfig = {
  NORMAL:   { color: "#22c55e", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.3)",  glow: "rgba(34,197,94,0.4)"  },
  ELEVATED: { color: "#eab308", bg: "rgba(234,179,8,0.08)",  border: "rgba(234,179,8,0.3)",  glow: "rgba(234,179,8,0.4)"  },
  HIGH:     { color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.3)", glow: "rgba(249,115,22,0.4)" },
  SEVERE:   { color: "#ef4444", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.3)",  glow: "rgba(239,68,68,0.4)"  },
};

function ProbabilityBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-mono text-white/50 uppercase tracking-wider">{label}-class</span>
        <span className="text-xs font-mono font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-[3px] w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
    </div>
  );
}

function GaugeMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const angle = -135 + (pct / 100) * 270;
  const color = pct > 60 ? "#ef4444" : pct > 35 ? "#f97316" : pct > 15 ? "#eab308" : "#22c55e";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-12 overflow-hidden">
        <svg viewBox="0 0 100 60" className="w-full h-full">
          <path d="M10 55 A45 45 0 0 1 90 55" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
          {[0, 1, 2, 3, 4].map(i => {
            const a = (-135 + i * 67.5) * (Math.PI / 180);
            const x1 = 50 + 38 * Math.cos(a);
            const y1 = 55 + 38 * Math.sin(a);
            const x2 = 50 + 43 * Math.cos(a);
            const y2 = 55 + 43 * Math.sin(a);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />;
          })}
          <g transform={`rotate(${angle}, 50, 55)`}>
            <line x1="50" y1="55" x2="50" y2="18" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="50" cy="55" r="3" fill={color} />
          </g>
        </svg>
      </div>
      <div className="text-center">
        <div className="text-xl font-mono font-bold" style={{ color }}>{pct}%</div>
        <div className="text-[9px] text-white/30 font-mono uppercase tracking-widest">Flare Risk</div>
      </div>
    </div>
  );
}

export function AlertPanel({ prediction }: Props) {
  const level = getAlertLevel(prediction.m_class, prediction.x_class);
  const cfg = levelConfig[level];

  return (
    <div className="h-full flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Alert Level</span>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: cfg.color }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: cfg.color }} />
          </span>
          <span className="text-xs font-mono font-bold tracking-widest" style={{ color: cfg.color }}>{level}</span>
        </div>
      </div>

      <div
        className="rounded border p-3 flex items-center justify-center"
        style={{ backgroundColor: cfg.bg, borderColor: cfg.border, boxShadow: `0 0 20px ${cfg.glow}` }}
      >
        <GaugeMeter value={prediction.m_class} />
      </div>

      <div className="space-y-2 mt-1">
        <ProbabilityBar label="M" value={prediction.m_class} color="#f97316" />
        <ProbabilityBar label="X" value={prediction.x_class} color="#ef4444" />
        <div className="flex justify-between items-center pt-1 border-t border-white/5">
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Confidence</span>
          <span className="text-xs font-mono font-bold text-sky-400">{Math.round(prediction.confidence * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
