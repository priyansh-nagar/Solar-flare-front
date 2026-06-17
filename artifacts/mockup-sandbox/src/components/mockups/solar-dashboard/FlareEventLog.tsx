import { format } from "date-fns";

export interface FlareEvent {
  id: string;
  time: string;
  endTime?: string;
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

const classColor: Record<string, string> = {
  X: "#ef4444", M: "#f97316", C: "#eab308", B: "#38bdf8", A: "#94a3b8",
};

function getClass(flux: number): string {
  if (flux >= 1e-4) return "X";
  if (flux >= 1e-5) return "M";
  if (flux >= 1e-6) return "C";
  if (flux >= 1e-7) return "B";
  return "A";
}

export function FlareEventLog({ events }: Props) {
  const sorted = [...events].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.05]">
        <span className="text-[9px] font-mono text-white/35 uppercase tracking-widest">Flare Event Database</span>
        <span className="text-[9px] font-mono text-white/20">{events.length} events</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[9px] font-mono text-white/20">NO EVENTS RECORDED</div>
        ) : (
          <table className="w-full text-[9px] font-mono">
            <thead className="sticky top-0 bg-[#060a0e]">
              <tr className="text-white/25 uppercase tracking-wider border-b border-white/[0.04]">
                <th className="px-2 py-1 text-left font-normal">Time (UTC)</th>
                <th className="px-2 py-1 text-left font-normal">Class</th>
                <th className="px-2 py-1 text-left font-normal">Peak Flux</th>
                <th className="px-2 py-1 text-left font-normal">Region</th>
                <th className="px-2 py-1 text-left font-normal">Type</th>
                <th className="px-2 py-1 text-left font-normal">Lead</th>
                <th className="px-2 py-1 text-left font-normal">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((ev) => {
                const cls = ev.class || getClass(ev.peak_flux);
                const color = classColor[cls[0]] ?? "#94a3b8";
                const timeStr = (() => {
                  try { return format(new Date(ev.time), "MM-dd HH:mm"); } catch { return ev.time; }
                })();
                return (
                  <tr
                    key={ev.id}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-2 py-1.5 text-white/50">{timeStr}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className="font-bold px-1.5 py-0.5 rounded text-[9px]"
                        style={{ color, backgroundColor: color + "20", border: `1px solid ${color}40` }}
                      >
                        {cls}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-white/50">{ev.peak_flux.toExponential(1)}</td>
                    <td className="px-2 py-1.5 text-white/60">{ev.region}</td>
                    <td className="px-2 py-1.5">
                      <span className={`uppercase ${ev.type === "forecast" ? "text-violet-400" : "text-sky-400"}`}>
                        {ev.type === "forecast" ? "FCST" : "NOW"}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-white/40">
                      {ev.lead_time_min ? `+${ev.lead_time_min}m` : "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      <span style={{ color: ev.confidence > 0.8 ? "#4ade80" : ev.confidence > 0.6 ? "#eab308" : "#f97316" }}>
                        {Math.round(ev.confidence * 100)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
