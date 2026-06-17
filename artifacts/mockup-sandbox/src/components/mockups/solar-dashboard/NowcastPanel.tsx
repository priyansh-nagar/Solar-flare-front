import type { XRayPoint } from "./XRayLightCurves";

interface Props {
  series: XRayPoint[];
  alertActive: boolean;
}

type FlareClass = "A" | "B" | "C" | "M" | "X" | "—";

function classifyFlux(flux: number): FlareClass {
  if (flux >= 1e-4) return "X";
  if (flux >= 1e-5) return "M";
  if (flux >= 1e-6) return "C";
  if (flux >= 1e-7) return "B";
  if (flux >= 1e-8) return "A";
  return "—";
}

const classColor: Record<string, string> = {
  X: "#ef4444", M: "#f97316", C: "#eab308",
  B: "#38bdf8", A: "#94a3b8", "—": "#4b5563",
};

function FluxMeter({ value, label, color }: { value: number; label: string; color: string }) {
  const log = value > 0 ? Math.log10(value) : -9;
  const pct = Math.max(0, Math.min(100, ((log + 9) / 6) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] font-mono">
        <span className="text-white/40 uppercase tracking-wider">{label}</span>
        <span style={{ color }}>{value.toExponential(2)} W/m²</span>
      </div>
      <div className="h-2 bg-white/[0.05] rounded overflow-hidden relative">
        <div
          className="h-full rounded transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, rgba(56,189,248,0.6), ${color})`,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
        {[1e-7, 1e-6, 1e-5, 1e-4].map((thresh, i) => {
          const tp = ((Math.log10(thresh) + 9) / 6) * 100;
          return (
            <div
              key={i}
              className="absolute top-0 w-px h-full bg-white/20"
              style={{ left: `${tp}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function NowcastPanel({ series, alertActive }: Props) {
  const last = series[series.length - 1];
  const prev = series[series.length - 6] ?? last;
  const soft = last?.soft ?? 0;
  const hard = last?.hard ?? 0;

  const softClass = classifyFlux(soft);
  const hardClass = classifyFlux(hard);
  const combined = soft > hard ? softClass : hardClass;
  const combinedColor = classColor[combined];

  const softTrend = soft > prev?.soft * 1.5 ? "▲ RISING" : soft < prev?.soft * 0.7 ? "▼ FALLING" : "● STABLE";
  const trendColor = softTrend.startsWith("▲") ? "#f97316" : softTrend.startsWith("▼") ? "#38bdf8" : "#94a3b8";

  const nowcastDetected = soft >= 1e-6 || hard >= 1e-7;
  const flareDetected = soft >= 1e-5;

  return (
    <div className="h-full flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-white/35 uppercase tracking-widest">Nowcast</span>
        <div className="flex items-center gap-1.5">
          {alertActive || flareDetected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-[9px] font-mono font-bold text-red-400 animate-pulse">FLARE DETECTED</span>
            </>
          ) : nowcastDetected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
              </span>
              <span className="text-[9px] font-mono font-bold text-orange-400">PRECURSOR</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500" style={{ boxShadow: "0 0 6px rgba(16,185,129,0.8)" }} />
              <span className="text-[9px] font-mono text-emerald-400">QUIET</span>
            </>
          )}
        </div>
      </div>

      <div
        className="rounded border p-2.5 text-center"
        style={{
          backgroundColor: combinedColor + "12",
          borderColor: combinedColor + "40",
          boxShadow: `0 0 16px ${combinedColor}20`,
        }}
      >
        <div className="text-[9px] font-mono text-white/30 mb-0.5">CURRENT CLASS</div>
        <div className="text-3xl font-bold font-mono" style={{ color: combinedColor, textShadow: `0 0 20px ${combinedColor}` }}>
          {combined}
        </div>
        <div className="text-[9px] font-mono mt-0.5" style={{ color: trendColor }}>{softTrend}</div>
      </div>

      <div className="space-y-2">
        <FluxMeter value={soft} label="Soft X-ray 1–8Å" color={classColor[softClass]} />
        <FluxMeter value={hard} label="Hard X-ray 0.5–4Å" color={classColor[hardClass]} />
      </div>

      <div className="mt-auto border-t border-white/[0.05] pt-2 space-y-1">
        <div className="flex justify-between text-[9px] font-mono">
          <span className="text-white/30">Soft class</span>
          <span style={{ color: classColor[softClass] }}>{softClass}-class</span>
        </div>
        <div className="flex justify-between text-[9px] font-mono">
          <span className="text-white/30">Hard class</span>
          <span style={{ color: classColor[hardClass] }}>{hardClass}-class</span>
        </div>
      </div>
    </div>
  );
}
