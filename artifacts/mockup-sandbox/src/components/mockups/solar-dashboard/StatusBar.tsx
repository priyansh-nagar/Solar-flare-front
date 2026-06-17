import type { HealthStatus } from "./api";
import { format } from "date-fns";

interface Props {
  health: HealthStatus;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

function Indicator({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{
          backgroundColor: ok ? "#22c55e" : "#ef4444",
          boxShadow: ok ? "0 0 6px rgba(34,197,94,0.8)" : "0 0 6px rgba(239,68,68,0.8)",
        }}
      />
      <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">{label}</span>
      <span className="text-[10px] font-mono text-white/60">{value}</span>
    </div>
  );
}

export function StatusBar({ health, isLoading, error, lastUpdated }: Props) {
  const isOk = !error;
  const lastUpdatedStr = lastUpdated ? format(lastUpdated, "HH:mm:ss") + " UTC" : "—";

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] bg-black/20">
      <div className="flex items-center gap-6">
        <Indicator label="Backend" value={isOk ? "CONNECTED" : "OFFLINE"} ok={isOk} />
        <Indicator label="Model" value={health.model_status?.toUpperCase() ?? "—"} ok={health.model_status === "loaded"} />
        <Indicator label="Inference" value={health.inference_time_ms ? `${health.inference_time_ms}ms` : "—"} ok={true} />
        <Indicator label="System" value={health.system_health?.toUpperCase() ?? "NOMINAL"} ok={health.system_health !== "degraded"} />
      </div>

      <div className="flex items-center gap-4">
        {isLoading && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-yellow-400/60">
            <div className="w-1 h-1 rounded-full bg-yellow-400 animate-pulse" />
            POLLING...
          </div>
        )}
        <div className="text-[10px] font-mono text-white/25">
          LAST UPDATE: {lastUpdatedStr}
        </div>
        <div className="text-[10px] font-mono text-white/20">
          SOLAR WEATHER PREDICTION SYSTEM v2.1
        </div>
      </div>
    </div>
  );
}
