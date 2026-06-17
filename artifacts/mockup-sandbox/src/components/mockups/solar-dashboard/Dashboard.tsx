import { useState, useEffect, useCallback, useMemo } from "react";
import { SunVisualization } from "./SunVisualization";
import { XRayLightCurves } from "./XRayLightCurves";
import { FlareEventLog } from "./FlareEventLog";
import { StatusBar } from "./StatusBar";
import { fetchSolarData } from "./api";
import type { SolarApiResponse } from "./api";
import { format } from "date-fns";

const POLL = 30_000;

/* ── tiny helpers ────────────────────────────────────────────────────────── */

function classifyFlux(v: number) {
  if (v >= 1e-4) return { cls: "X", color: "#ef4444" };
  if (v >= 1e-5) return { cls: "M", color: "#f97316" };
  if (v >= 1e-6) return { cls: "C", color: "#eab308" };
  if (v >= 1e-7) return { cls: "B", color: "#38bdf8" };
  return { cls: "A", color: "#6b7280" };
}

function alertLevel(flux: number) {
  if (flux >= 1e-4) return { label: "SEVERE",   color: "#ef4444" };
  if (flux >= 1e-5) return { label: "HIGH",     color: "#f97316" };
  if (flux >= 1e-6) return { label: "ELEVATED", color: "#eab308" };
  return                    { label: "NORMAL",   color: "#22c55e" };
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-white/[0.07] bg-[#07090d] rounded-sm overflow-hidden flex flex-col ${className}`}>
      {children}
    </div>
  );
}

function PanelHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.05] flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="w-0.5 h-3 rounded bg-sky-500/40 flex-shrink-0" />
        <span className="text-[9px] font-mono text-white/30 uppercase tracking-[0.15em]">{label}</span>
      </div>
      {right && <div className="text-[8px] font-mono text-white/18">{right}</div>}
    </div>
  );
}

function Blink() {
  return (
    <span className="relative inline-flex w-1.5 h-1.5">
      <span className="animate-ping absolute inset-0 rounded-full bg-red-400 opacity-70" />
      <span className="relative rounded-full w-1.5 h-1.5 bg-red-500" />
    </span>
  );
}

const EMPTY: SolarApiResponse = {
  active_regions: [],
  xray_series: [],
  health: { status: "", model_status: "loading", inference_time_ms: 0, last_prediction_time: "", system_health: "nominal" },
  forecast_windows: [],
  flare_events: [],
  confidence: 0,
  lead_time_peak: 0,
};

/* ── main component ──────────────────────────────────────────────────────── */

export function Dashboard() {
  const [data, setData] = useState<SolarApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [lastUp, setLastUp]   = useState<Date | null>(null);
  const [, setTick]           = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await fetchSolarData();
      setData(r); setError(null); setLastUp(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, POLL); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(id); }, []);

  const d = data ?? EMPTY;
  const lastPt = d.xray_series[d.xray_series.length - 1];
  const softFlux = lastPt?.soft ?? 0;
  const hardFlux = lastPt?.hard ?? 0;
  const alert = alertLevel(softFlux);
  const nowcastAlert = alert.label === "HIGH" || alert.label === "SEVERE";
  const { cls: softCls, color: softColor } = classifyFlux(softFlux);
  const { cls: hardCls }                    = classifyFlux(hardFlux);

  const flareAnno = useMemo(
    () => d.flare_events.map(e => ({ time: e.time, class: e.class, label: e.class })),
    [d.flare_events]
  );

  const utcNow = format(new Date(), "HH:mm:ss") + " UTC";

  /* trend: compare last vs 5-back */
  const prev = d.xray_series[d.xray_series.length - 6];
  const trend = prev && softFlux > prev.soft * 1.4 ? "▲ RISING"
              : prev && softFlux < prev.soft * 0.7 ? "▼ FALLING"
              : "● STABLE";
  const trendColor = trend.startsWith("▲") ? "#f97316" : trend.startsWith("▼") ? "#38bdf8" : "#6b7280";

  return (
    <div
      className="w-full h-screen flex flex-col overflow-hidden select-none"
      style={{ background: "#050608", fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace" }}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-2 border-b border-white/[0.05] flex-shrink-0">
        <div className="flex items-center gap-3.5">
          {/* animated sun icon */}
          <div className="relative w-5 h-5 flex-shrink-0">
            <span className="absolute inset-0 rounded-full bg-orange-400/20 animate-ping" style={{ animationDuration: "3s" }} />
            <span className="relative flex w-5 h-5 rounded-full border border-orange-400/45 items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-yellow-200 to-orange-500" />
            </span>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-[0.2em] text-white/85 uppercase">
              Solar Flare Prediction System
            </div>
            <div className="text-[8px] text-white/22 tracking-widest uppercase">
              Nowcasting · Forecasting · GOES X-ray Analysis
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* alert badge */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-sm border"
            style={{ borderColor: alert.color + "40", background: alert.color + "10" }}>
            {nowcastAlert && <Blink />}
            {!nowcastAlert && (
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: alert.color, boxShadow: `0 0 6px ${alert.color}` }} />
            )}
            <span className="text-[9px] font-mono font-bold tracking-widest" style={{ color: alert.color }}>
              {alert.label}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[9px] font-mono text-white/22">
            <span>GOES-16 XRSB 1–8Å</span>
            <span>GOES-16 XRSA 0.5–4Å</span>
            <span className="text-sky-400/60">● LIVE {utcNow}</span>
          </div>
        </div>
      </header>

      {/* ── MAIN GRID ──────────────────────────────────────────────────────── */}
      {/*   Left 38% = sun panel    Right 62% = data panels                    */}
      <div className="flex-1 min-h-0 flex gap-2 p-2">

        {/* ── LEFT: Sun ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2" style={{ width: "38%", flexShrink: 0 }}>

          {/* Sun visualization */}
          <Panel className="flex-1 min-h-0">
            <PanelHeader label="Heliospheric Magnetogram" right="HMI · Active Region Overlay" />
            <div className="flex-1 min-h-0 relative">
              {loading && !data && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#050608]/70 z-10">
                  <div className="w-6 h-6 border border-sky-500/40 border-t-sky-400 rounded-full animate-spin" />
                </div>
              )}
              <SunVisualization regions={d.active_regions} nowcastAlert={nowcastAlert} />
            </div>
          </Panel>

          {/* Active region table */}
          <Panel style={{ flexShrink: 0 }}>
            <PanelHeader label="Active Regions" right={`${d.active_regions.length} regions`} />
            <table className="w-full text-[9px] font-mono">
              <thead>
                <tr className="border-b border-white/[0.04] text-white/22 uppercase tracking-wider">
                  <th className="px-3 py-1 text-left font-normal">Region</th>
                  <th className="px-3 py-1 text-left font-normal">Position</th>
                  <th className="px-3 py-1 text-left font-normal">Area</th>
                  <th className="px-3 py-1 text-left font-normal">Risk</th>
                </tr>
              </thead>
              <tbody>
                {d.active_regions.map(r => (
                  <tr key={r.id} className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors">
                    <td className="px-3 py-1.5 text-white/70 font-bold">{r.label}</td>
                    <td className="px-3 py-1.5 text-white/35">
                      {r.lat > 0 ? "N" : "S"}{Math.abs(r.lat)} {r.lon > 0 ? "E" : "W"}{Math.abs(r.lon)}
                    </td>
                    <td className="px-3 py-1.5 text-white/35">{r.area} μH</td>
                    <td className="px-3 py-1.5 font-bold uppercase" style={{
                      color: { low: "#22c55e", moderate: "#eab308", high: "#f97316", severe: "#ef4444" }[r.flare_risk]
                    }}>{r.flare_risk}</td>
                  </tr>
                ))}
                {d.active_regions.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-2 text-white/20 text-center">—</td></tr>
                )}
              </tbody>
            </table>
          </Panel>
        </div>

        {/* ── RIGHT: data panels ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">

          {/* Nowcast strip */}
          <Panel style={{ flexShrink: 0 }}>
            <div className="flex items-stretch divide-x divide-white/[0.05]">

              {/* Current class */}
              <div className="px-5 py-2.5 flex items-center gap-4">
                <div>
                  <div className="text-[8px] font-mono text-white/25 uppercase tracking-widest mb-0.5">Current Class</div>
                  <div className="text-3xl font-bold font-mono leading-none" style={{ color: softColor, textShadow: `0 0 18px ${softColor}` }}>
                    {softCls}
                  </div>
                </div>
                <div className="text-[8px] font-mono space-y-0.5">
                  <div style={{ color: trendColor }}>{trend}</div>
                  <div className="text-white/25">Soft: <span className="text-white/55">{softCls}-class</span></div>
                  <div className="text-white/25">Hard: <span className="text-white/55">{hardCls}-class</span></div>
                </div>
              </div>

              {/* Soft flux */}
              <div className="px-5 py-2.5 flex flex-col justify-center gap-1 flex-1">
                <div className="text-[8px] font-mono text-white/25 uppercase tracking-widest">Soft X-ray 1–8Å</div>
                <div className="text-sm font-mono font-bold text-sky-400">{softFlux.toExponential(2)} W/m²</div>
                <div className="h-1.5 bg-white/[0.04] rounded overflow-hidden">
                  <div className="h-full rounded bg-sky-500/70 transition-all duration-700"
                    style={{ width: `${Math.max(2, Math.min(100, ((Math.log10(softFlux || 1e-9) + 9) / 6) * 100))}%` }} />
                </div>
              </div>

              {/* Hard flux */}
              <div className="px-5 py-2.5 flex flex-col justify-center gap-1 flex-1">
                <div className="text-[8px] font-mono text-white/25 uppercase tracking-widest">Hard X-ray 0.5–4Å</div>
                <div className="text-sm font-mono font-bold text-violet-400">{hardFlux.toExponential(2)} W/m²</div>
                <div className="h-1.5 bg-white/[0.04] rounded overflow-hidden">
                  <div className="h-full rounded bg-violet-500/70 transition-all duration-700"
                    style={{ width: `${Math.max(2, Math.min(100, ((Math.log10(hardFlux || 1e-9) + 9) / 6) * 100))}%` }} />
                </div>
              </div>

              {/* Forecast confidence */}
              <div className="px-5 py-2.5 flex flex-col justify-center gap-0.5">
                <div className="text-[8px] font-mono text-white/25 uppercase tracking-widest mb-0.5">Forecast</div>
                {[
                  { label: "C-class", val: d.forecast_windows[d.forecast_windows.length - 1]?.prob_c ?? 0, color: "#eab308" },
                  { label: "M-class", val: d.forecast_windows[d.forecast_windows.length - 1]?.prob_m ?? 0, color: "#f97316" },
                  { label: "X-class", val: d.forecast_windows[d.forecast_windows.length - 1]?.prob_x ?? 0, color: "#ef4444" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex items-center gap-2 text-[8px] font-mono">
                    <span className="text-white/30 w-12">{label}</span>
                    <div className="w-16 h-1 bg-white/[0.04] rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${Math.round(val * 100)}%`, backgroundColor: color }} />
                    </div>
                    <span style={{ color }}>{Math.round(val * 100)}%</span>
                  </div>
                ))}
                <div className="text-[7px] font-mono text-white/20 mt-0.5">Lead T+{d.lead_time_peak}min · {Math.round(d.confidence * 100)}% conf.</div>
              </div>

              {/* Telemetry */}
              <div className="px-5 py-2.5 flex flex-col justify-center gap-0.5 text-[8px] font-mono">
                <div className="text-white/25 uppercase tracking-widest mb-0.5">Telemetry</div>
                <div className="text-white/35">AR Count <span className="text-white/65 ml-1">{d.active_regions.length}</span></div>
                <div className="text-white/35">Inference <span className="text-white/65 ml-1">{d.health.inference_time_ms || "—"}ms</span></div>
                <div className="text-white/35">Model <span className="text-white/65 ml-1">{d.health.model_status}</span></div>
              </div>
            </div>
          </Panel>

          {/* X-ray light curves */}
          <Panel className="flex-1 min-h-0">
            <PanelHeader label="X-ray Light Curves · Nowcasting Trigger" right="6h · GOES-16 · drag navigator to scroll" />
            <div className="flex-1 min-h-0">
              {d.xray_series.length > 0
                ? <XRayLightCurves series={d.xray_series} flareEvents={flareAnno} />
                : <div className="flex items-center justify-center h-full text-[9px] font-mono text-white/20">Loading data…</div>
              }
            </div>
          </Panel>

          {/* Flare event log */}
          <Panel style={{ flexShrink: 0, height: "170px" }}>
            <PanelHeader label="Flare Event Database" right={`${d.flare_events.length} events · nowcast + forecast`} />
            <div className="flex-1 min-h-0 overflow-y-auto"
              style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
              <FlareEventLog events={d.flare_events} />
            </div>
          </Panel>
        </div>
      </div>

      {/* ── STATUS BAR ─────────────────────────────────────────────────────── */}
      <StatusBar
        health={d.health}
        isLoading={loading && !!data}
        error={error}
        lastUpdated={lastUp}
        nowcastAlert={nowcastAlert}
      />
    </div>
  );
}
