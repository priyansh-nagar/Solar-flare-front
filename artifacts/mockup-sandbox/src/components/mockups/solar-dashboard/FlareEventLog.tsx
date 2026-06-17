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

const CLS_COLOR: Record<string, string> = {
  X: "#ef4444", M: "#f97316", C: "#eab308", B: "#38bdf8", A: "#6b7280",
};

function clsColor(cls: string) { return CLS_COLOR[cls?.[0]] ?? "#6b7280"; }

export function FlareEventLog({ events }: Props) {
  const sorted = [...events].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  if (sorted.length === 0) {
    return <div className="flex items-center justify-center h-full text-[9px] font-mono text-white/18">NO EVENTS RECORDED</div>;
  }

  return (
    <table className="w-full text-[9px] font-mono">
      <thead className="sticky top-0 bg-[#060a0e]">
        <tr className="text-white/22 uppercase tracking-wider border-b border-white/[0.04]">
          <th className="px-3 py-1 text-left font-normal">Time (UTC)</th>
          <th className="px-3 py-1 text-left font-normal">Class</th>
          <th className="px-3 py-1 text-left font-normal">Peak Flux</th>
          <th className="px-3 py-1 text-left font-normal">Region</th>
          <th className="px-3 py-1 text-left font-normal">Type</th>
          <th className="px-3 py-1 text-left font-normal">Lead</th>
          <th className="px-3 py-1 text-left font-normal">Confidence</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(ev => {
          const col = clsColor(ev.class);
          const ts = (() => { try { return format(new Date(ev.time), "MM-dd HH:mm"); } catch { return ev.time; } })();
          return (
            <tr key={ev.id} className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors">
              <td className="px-3 py-1.5 text-white/40">{ts}</td>
              <td className="px-3 py-1.5">
                <span className="font-bold px-1.5 py-0.5 rounded text-[9px]"
                  style={{ color: col, background: col + "1a", border: `1px solid ${col}35` }}>
                  {ev.class}
                </span>
              </td>
              <td className="px-3 py-1.5 text-white/40">{ev.peak_flux.toExponential(1)}</td>
              <td className="px-3 py-1.5 text-white/55">{ev.region}</td>
              <td className="px-3 py-1.5">
                <span className={ev.type === "forecast" ? "text-violet-400" : "text-sky-400"}>
                  {ev.type === "forecast" ? "FCST" : "NOW"}
                </span>
              </td>
              <td className="px-3 py-1.5 text-white/35">{ev.lead_time_min ? `+${ev.lead_time_min}m` : "—"}</td>
              <td className="px-3 py-1.5">
                <span style={{ color: ev.confidence > 0.8 ? "#4ade80" : ev.confidence > 0.6 ? "#eab308" : "#f97316" }}>
                  {Math.round(ev.confidence * 100)}%
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
