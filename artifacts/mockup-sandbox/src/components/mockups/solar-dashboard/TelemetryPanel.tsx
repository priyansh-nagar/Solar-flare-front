import type { Telemetry } from "./api";
import { format } from "date-fns";

interface Props {
  telemetry: Telemetry;
}

function formatFlux(val: number) {
  if (val < 1e-7) return `${(val * 1e9).toFixed(2)} nW/m²`;
  if (val < 1e-4) return `${(val * 1e6).toFixed(2)} μW/m²`;
  return val.toExponential(2);
}

function Row({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs font-mono font-bold" style={{ color: highlight ?? "rgba(255,255,255,0.85)" }}>{value}</span>
        {unit && <span className="text-[9px] font-mono text-white/25">{unit}</span>}
      </div>
    </div>
  );
}

export function TelemetryPanel({ telemetry }: Props) {
  const ts = telemetry.data_timestamp
    ? format(new Date(telemetry.data_timestamp), "yyyy-MM-dd HH:mm:ss") + " UTC"
    : "—";

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Solar Activity Telemetry</span>
      </div>

      <div className="flex-1">
        <Row
          label="Soft X-ray Flux"
          value={formatFlux(telemetry.soft_xray_flux)}
          highlight="#38bdf8"
        />
        <Row
          label="Hard X-ray Flux"
          value={formatFlux(telemetry.hard_xray_flux)}
          highlight="#818cf8"
        />
        <Row
          label="Active Region Count"
          value={String(telemetry.active_region_count)}
          unit="regions"
          highlight="#fb923c"
        />
        <Row
          label="Flare Index"
          value={telemetry.flare_index.toFixed(2)}
          unit="arb. units"
        />
        <Row
          label="Prediction Confidence"
          value={`${Math.round(telemetry.prediction_confidence * 100)}%`}
          highlight="#4ade80"
        />
        <Row
          label="Data Timestamp"
          value={ts}
        />
      </div>
    </div>
  );
}
