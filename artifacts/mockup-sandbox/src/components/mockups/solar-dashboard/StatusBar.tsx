import type { HealthStatus } from "./api";
import { format } from "date-fns";

interface Props {
  health: HealthStatus;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  nowcastAlert: boolean;
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{
        backgroundColor: ok ? "#22c55e" : "#ef4444",
        boxShadow: ok ? "0 0 5px rgba(34,197,94,0.9)" : "0 0 5px rgba(239,68,68,0.9)",
      }}
    />
  );
}

function Seg({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <Dot ok={ok} />
      <span className="text-[9px] font-mono text-white/25 uppercase tracking-wider">{label}</span>
      <span className="text-[9px] font-mono text-white/55">{value}</span>
    </div>
  );
}

export function StatusBar({ health, isLoading, error, lastUpdated, nowcastAlert }: Props) {
  const isOk = !error;
  const lastUpdatedStr = lastUpdated ? format(lastUpdated, "HH:mm:ss") + " UTC" : "—";

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-white/[0.05] bg-black/25 flex-shrink-0">
      <div className="flex items-center gap-5">
        <Seg label="Backend" value={isOk ? "CONNECTED" : "OFFLINE"} ok={isOk} />
        <Seg label="Model" value={health.model_status?.toUpperCase() ?? "—"} ok={health.model_status === "loaded"} />
        <Seg label="Inference" value={health.inference_time_ms ? `${health.inference_time_ms}ms` : "—"} ok={true} />
        <Seg label="System" value={health.system_health?.toUpperCase() ?? "NOMINAL"} ok={health.system_health !== "degraded"} />
        <Seg label="Data source" value="GOES-16 XRSB/XRSA" ok={isOk} />
      </div>

      <div className="flex items-center gap-5">
        {nowcastAlert && (
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-red-400 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            FLARE ALERT ACTIVE
          </div>
        )}
        {isLoading && (
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-yellow-400/50">
            <div className="w-1 h-1 rounded-full bg-yellow-400 animate-pulse" />
            POLLING BACKEND
          </div>
        )}
        <div className="text-[9px] font-mono text-white/20">LAST UPDATE: {lastUpdatedStr}</div>
        <div className="text-[9px] font-mono text-white/15">SWPC SOLAR WEATHER PREDICTION SYSTEM v2.1</div>
      </div>
    </div>
  );
}
