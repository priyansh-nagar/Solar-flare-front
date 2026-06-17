import { useState, useEffect, useCallback, useMemo } from "react";
import { SunVisualization } from "./SunVisualization";
import { XRayLightCurves } from "./XRayLightCurves";
import { NowcastPanel } from "./NowcastPanel";
import { ForecastPanel } from "./ForecastPanel";
import { FlareEventLog } from "./FlareEventLog";
import { StatusBar } from "./StatusBar";
import { fetchSolarData } from "./api";
import type { SolarApiResponse } from "./api";

const POLL_INTERVAL = 30_000;

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.05] flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="w-0.5 h-3 rounded-sm bg-sky-500/50 flex-shrink-0" />
        <span className="text-[9px] font-mono text-white/30 uppercase tracking-[0.15em]">{children}</span>
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-white/[0.06] bg-[#07090c] rounded flex flex-col overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#050608]/75 z-10">
      <div className="w-6 h-6 border border-sky-500/40 border-t-sky-400 rounded-full animate-spin" />
    </div>
  );
}

function AlertBadge({ level, color }: { level: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }} />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      </span>
      <span className="text-[9px] font-mono font-bold tracking-widest" style={{ color }}>{level}</span>
    </div>
  );
}

function getAlertLevel(last?: { soft: number; hard: number }): { level: string; color: string } {
  const flux = Math.max(last?.soft ?? 0, last?.hard ?? 0);
  if (flux >= 1e-4) return { level: "SEVERE", color: "#ef4444" };
  if (flux >= 1e-5) return { level: "HIGH", color: "#f97316" };
  if (flux >= 1e-6) return { level: "ELEVATED", color: "#eab308" };
  return { level: "NORMAL", color: "#22c55e" };
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

export function Dashboard() {
  const [data, setData] = useState<SolarApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const result = await fetchSolarData();
      setData(result);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  // Clock tick for live timestamp
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const d = data ?? EMPTY;
  const lastPoint = d.xray_series[d.xray_series.length - 1];
  const alert = getAlertLevel(lastPoint);
  const nowcastAlert = alert.level === "HIGH" || alert.level === "SEVERE";

  const flareAnnotations = useMemo(() =>
    d.flare_events.map((ev) => ({ time: ev.time, class: ev.class, label: ev.class })),
    [d.flare_events]
  );

  const utcNow = new Date().toUTCString().replace(" GMT", " UTC");

  return (
    <div
      className="w-full h-screen flex flex-col overflow-hidden select-none"
      style={{ backgroundColor: "#050608", fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" }}
    >
      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05] bg-black/30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative w-5 h-5 flex-shrink-0">
            <div className="absolute inset-0 rounded-full bg-orange-500/25 animate-ping" style={{ animationDuration: "3s" }} />
            <div className="relative w-5 h-5 rounded-full border border-orange-400/50 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-orange-300 to-orange-600" />
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-[0.22em] text-white/85 uppercase">Solar Flare Prediction System</div>
            <div className="text-[8px] text-white/22 tracking-widest uppercase">Nowcasting · Forecasting · GOES X-ray Analysis</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <AlertBadge level={alert.level} color={alert.color} />
          <div className="w-px h-4 bg-white/[0.08]" />
          <div className="flex items-center gap-4 text-[9px] font-mono text-white/22">
            <span>GOES-16 XRSB · 1–8Å</span>
            <span>GOES-16 XRSA · 0.5–4Å</span>
            <span className="text-sky-400/50">LIVE</span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-white/35">{utcNow}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN GRID ─────────────────────────────────────────────────────────── */}
      <div
        className="flex-1 min-h-0 p-2 gap-2"
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr 240px",
          gridTemplateRows: "1fr 160px",
        }}
      >
        {/* ── LEFT: Sun magnetogram (spans 2 rows) ──────────────────────────── */}
        <Panel className="row-span-2">
          <SectionLabel
            right={
              <span className="text-[8px] font-mono text-white/18">HMI · MAGNETOGRAM OVERLAY</span>
            }
          >
            Heliospheric Magnetogram
          </SectionLabel>
          <div className="flex-1 min-h-0 relative">
            {loading && data === null && <Loading />}
            <SunVisualization regions={d.active_regions} nowcastAlert={nowcastAlert} />
          </div>
          {/* Active region list */}
          <div className="flex-shrink-0 border-t border-white/[0.05]">
            <div className="px-2.5 py-1 text-[8px] font-mono text-white/20 uppercase tracking-wider">Active Regions</div>
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="text-white/20 border-b border-white/[0.04]">
                  <th className="px-2 py-0.5 text-left font-normal">ID</th>
                  <th className="px-2 py-0.5 text-left font-normal">Pos</th>
                  <th className="px-2 py-0.5 text-left font-normal">Area</th>
                  <th className="px-2 py-0.5 text-left font-normal">Risk</th>
                </tr>
              </thead>
              <tbody>
                {d.active_regions.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.03]">
                    <td className="px-2 py-1 text-white/60 font-bold">{r.label}</td>
                    <td className="px-2 py-1 text-white/35">{r.lat > 0 ? "N" : "S"}{Math.abs(r.lat)} {r.lon > 0 ? "E" : "W"}{Math.abs(r.lon)}</td>
                    <td className="px-2 py-1 text-white/35">{r.area}μH</td>
                    <td className="px-2 py-1">
                      <span className="font-bold uppercase" style={{
                        color: { low: "#22c55e", moderate: "#eab308", high: "#f97316", severe: "#ef4444" }[r.flare_risk]
                      }}>{r.flare_risk}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* ── CENTER TOP: X-ray light curves ────────────────────────────────── */}
        <Panel>
          <SectionLabel right={<span className="text-[8px] font-mono text-white/18">6h · scroll/zoom enabled</span>}>
            X-ray Light Curves · Nowcasting Trigger
          </SectionLabel>
          <div className="flex-1 min-h-0 relative">
            {loading && data === null && <Loading />}
            {d.xray_series.length > 0 && (
              <XRayLightCurves series={d.xray_series} flareEvents={flareAnnotations} />
            )}
          </div>
        </Panel>

        {/* ── RIGHT COLUMN TOP: Nowcast + Forecast stacked ──────────────────── */}
        <div className="flex flex-col gap-2 min-h-0">
          {/* Nowcast */}
          <Panel style={{ flex: "0 0 auto", height: "210px" } as React.CSSProperties}>
            <SectionLabel>Nowcast · Real-time</SectionLabel>
            <div className="flex-1 min-h-0 relative">
              {loading && data === null && <Loading />}
              <NowcastPanel series={d.xray_series} alertActive={nowcastAlert} />
            </div>
          </Panel>
          {/* Forecast */}
          <Panel className="flex-1 min-h-0">
            <SectionLabel>Predictive Forecast · Lead Time</SectionLabel>
            <div className="flex-1 min-h-0 relative">
              {loading && data === null && <Loading />}
              {d.forecast_windows.length > 0 && (
                <ForecastPanel
                  windows={d.forecast_windows}
                  confidence={d.confidence}
                  leadTimePeak={d.lead_time_peak}
                />
              )}
            </div>
          </Panel>
        </div>

        {/* ── CENTER BOTTOM: Flare event log ────────────────────────────────── */}
        <Panel>
          <div className="flex-1 min-h-0 relative">
            {loading && data === null && <Loading />}
            <FlareEventLog events={d.flare_events} />
          </div>
        </Panel>

        {/* ── RIGHT BOTTOM: Telemetry summary ───────────────────────────────── */}
        <Panel>
          <SectionLabel>Telemetry</SectionLabel>
          <div className="flex-1 p-2 space-y-1.5 text-[9px] font-mono overflow-hidden">
            {[
              { label: "Soft X-ray", value: lastPoint ? lastPoint.soft.toExponential(2) : "—", unit: "W/m²", color: "#38bdf8" },
              { label: "Hard X-ray", value: lastPoint ? lastPoint.hard.toExponential(2) : "—", unit: "W/m²", color: "#c084fc" },
              { label: "AR Count", value: String(d.active_regions.length), unit: "regions", color: "#fb923c" },
              { label: "Confidence", value: `${Math.round(d.confidence * 100)}%`, unit: "", color: "#4ade80" },
              { label: "Inference", value: d.health.inference_time_ms ? `${d.health.inference_time_ms}ms` : "—", unit: "", color: "#a3a3a3" },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                <span className="text-white/30 uppercase tracking-wider">{label}</span>
                <span style={{ color }}>{value} <span className="text-white/20">{unit}</span></span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── STATUS BAR ────────────────────────────────────────────────────────── */}
      <StatusBar
        health={d.health}
        isLoading={loading && data !== null}
        error={error}
        lastUpdated={lastUpdated}
        nowcastAlert={nowcastAlert}
      />
    </div>
  );
}
