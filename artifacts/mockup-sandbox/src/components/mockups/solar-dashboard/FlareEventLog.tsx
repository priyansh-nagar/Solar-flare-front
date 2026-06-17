import { format } from "date-fns";

export interface FlareEvent {
  id: string;
  time: string;
  class: string;
  peak_flux: number;
  region: string;
  type: "nowcast" | "forecast";
  confidence: number;
  lead_time_min?: number;
}

interface Props {
  events: FlareEvent[];
}

const C = {
  border: "#1E2D3D",
  panel:  "#0E1620",
  bg2:    "#0C1219",
  textSec: "#5B7A8A",
  textDim: "#2E4558",
  textPri: "#C8D8E8",
  amber: "#FFB800",
  red:   "#FF3B3B",
  green: "#00FF88",
  cyan:  "#00D4FF",
  blue:  "#4DAAFF",
};

function clsColor(cls: string) {
  const ch = cls?.[0];
  if (ch === "X") return { color: C.red,   borderColor: C.red   };
  if (ch === "M") return { color: "#FF8C00", borderColor: "#FF8C00" };
  if (ch === "C") return { color: C.amber, borderColor: C.amber };
  return               { color: C.blue,  borderColor: C.blue  };
}

export function FlareEventLog({ events }: Props) {
  const sorted = [...events].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  if (sorted.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 9, fontFamily: "monospace", color: C.textDim, letterSpacing: "0.1em" }}>
        NO EVENTS RECORDED
      </div>
    );
  }

  return (
    <table style={{ width: "100%", fontSize: 9, fontFamily: "monospace", borderCollapse: "collapse" }}>
      <thead style={{ position: "sticky", top: 0, background: "#0A1218", zIndex: 1 }}>
        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
          {["Time (UTC)", "Class", "Peak Flux", "Region", "Type", "Lead", "Confidence"].map(h => (
            <th key={h} style={{ padding: "5px 12px", textAlign: "left", fontWeight: "normal", color: C.textSec, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((ev, i) => {
          const { color, borderColor } = clsColor(ev.class);
          const ts = (() => { try { return format(new Date(ev.time), "MM-dd HH:mm"); } catch { return ev.time; } })();
          const confColor = ev.confidence > 0.8 ? C.green : ev.confidence > 0.6 ? C.amber : "#FF8C00";

          return (
            <tr
              key={ev.id}
              style={{
                background: i % 2 === 0 ? C.panel : C.bg2,
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <td style={{ padding: "5px 12px", color: C.textSec }}>{ts}</td>
              <td style={{ padding: "5px 12px" }}>
                <span style={{
                  color, border: `1px solid ${borderColor}`,
                  borderRadius: 2, padding: "1px 6px", fontSize: 8,
                  fontWeight: "bold", background: "transparent",
                }}>
                  {ev.class}
                </span>
              </td>
              <td style={{ padding: "5px 12px", color: C.textSec }}>{ev.peak_flux.toExponential(1)}</td>
              <td style={{ padding: "5px 12px", color: C.textPri }}>{ev.region}</td>
              <td style={{ padding: "5px 12px" }}>
                <span style={{ color: ev.type === "forecast" ? "#A78BFA" : C.blue, letterSpacing: "0.08em" }}>
                  {ev.type === "forecast" ? "FCST" : "NOW"}
                </span>
              </td>
              <td style={{ padding: "5px 12px", color: ev.lead_time_min ? C.cyan : C.textDim }}>
                {ev.lead_time_min ? `+${ev.lead_time_min}m` : "—"}
              </td>
              <td style={{ padding: "5px 12px", color: confColor, fontWeight: "bold" }}>
                {Math.round(ev.confidence * 100)}%
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
