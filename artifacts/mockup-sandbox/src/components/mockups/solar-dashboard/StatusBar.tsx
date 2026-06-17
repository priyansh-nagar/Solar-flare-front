import type { HealthStatus } from "./api";
import { format } from "date-fns";

const C = {
  bg:     "#060A0E",
  border: "#1E2D3D",
  textSec: "#5B7A8A",
  textDim: "#2E4558",
  green:  "#00FF88",
  red:    "#FF3B3B",
  amber:  "#FFB800",
};

interface Props {
  health: HealthStatus;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  nowcastAlert: boolean;
}

function LED({ color, blink = false }: { color: string; blink?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block", width: 6, height: 6,
        borderRadius: "50%", background: color, flexShrink: 0,
        animation: blink ? "blink-led 1s infinite" : undefined,
      }}
    />
  );
}

function Divider() {
  return <span style={{ width: 1, height: 14, background: C.border, flexShrink: 0, alignSelf: "center" }} />;
}

function Seg({ label, value, ok, blink }: { label: string; value: string; ok: boolean; blink?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "monospace", fontSize: 9 }}>
      <LED color={ok ? C.green : C.red} blink={blink} />
      <span style={{ color: C.textSec, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: ok ? C.green : C.red }}>{value}</span>
    </div>
  );
}

export function StatusBar({ health, isLoading, error, lastUpdated, nowcastAlert }: Props) {
  const isOk  = !error;
  const lastStr = lastUpdated ? format(lastUpdated, "HH:mm:ss") + " UTC" : "—";

  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: C.bg, borderTop: `1px solid ${C.border}`,
        padding: "5px 16px", flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Seg label="Backend"     value={isOk ? "CONNECTED" : "OFFLINE"}          ok={isOk} />
        <Divider />
        <Seg label="Model"       value={health.model_status?.toUpperCase() ?? "—"} ok={health.model_status === "loaded"} />
        <Divider />
        <Seg label="Inference"   value={health.inference_time_ms ? `${health.inference_time_ms}ms` : "—"} ok={true} />
        <Divider />
        <Seg label="System"      value={health.system_health?.toUpperCase() ?? "NOMINAL"} ok={health.system_health !== "degraded"} />
        <Divider />
        <Seg label="Data Source" value="GOES-16 XRSB/XRSA" ok={isOk} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {nowcastAlert && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, fontFamily: "monospace", color: C.red }}>
            <LED color={C.red} blink />
            FLARE ALERT ACTIVE
          </div>
        )}
        {nowcastAlert && <Divider />}
        {isLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, fontFamily: "monospace", color: C.amber }}>
            <LED color={C.amber} />
            POLLING
          </div>
        )}
        <div style={{ fontSize: 9, fontFamily: "monospace", color: C.textDim }}>LAST UPDATE: {lastStr}</div>
        <Divider />
        <div style={{ fontSize: 9, fontFamily: "monospace", color: C.textDim }}>SWPC SOLAR WEATHER PREDICTION SYSTEM v2.1</div>
      </div>
    </div>
  );
}
