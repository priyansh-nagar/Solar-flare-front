import { useState, useEffect, useCallback } from "react";
import { SunVisualization } from "./SunVisualization";
import { AlertPanel } from "./AlertPanel";
import { ForecastChart } from "./ForecastChart";
import { TelemetryPanel } from "./TelemetryPanel";
import { StatusBar } from "./StatusBar";
import { fetchSolarData } from "./api";
import type { SolarApiResponse } from "./api";

const POLL_INTERVAL = 30_000;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1.5 border-b border-white/[0.06] flex items-center gap-2">
      <span className="w-1 h-3 rounded-sm bg-sky-500/60 flex-shrink-0" />
      <span className="text-[9px] font-mono text-white/30 uppercase tracking-[0.15em]">{children}</span>
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`border border-white/[0.07] bg-[#080a0c] rounded flex flex-col overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#050608]/80 z-10 rounded">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border border-sky-500/40 border-t-sky-400 rounded-full animate-spin" />
        <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Initializing...</span>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [data, setData] = useState<SolarApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

  const empty: SolarApiResponse = {
    prediction: { b_class: 0, c_class: 0, m_class: 0, x_class: 0, confidence: 0, timestamp: "" },
    active_regions: [],
    telemetry: { soft_xray_flux: 0, hard_xray_flux: 0, active_region_count: 0, flare_index: 0, prediction_confidence: 0, data_timestamp: "" },
    health: { status: "", model_status: "loading", inference_time_ms: 0, last_prediction_time: "", system_health: "nominal" },
    forecast_series: [],
  };

  const d = data ?? empty;

  return (
    <div
      className="w-full h-screen flex flex-col select-none overflow-hidden"
      style={{ backgroundColor: "#050608", fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.06] bg-black/30 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 rounded-full bg-orange-500/30 animate-ping" style={{ animationDuration: "3s" }} />
              <div className="relative w-5 h-5 rounded-full border border-orange-400/60 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-orange-300 to-orange-600" />
              </div>
            </div>
            <div>
              <div className="text-xs font-bold tracking-[0.2em] text-white/90 uppercase">Solar Flare Prediction System</div>
              <div className="text-[9px] text-white/25 tracking-widest uppercase">AI-Powered Space Weather Monitoring</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-[10px] font-mono text-white/25">
          <span>SWPC / NOAA CLASS</span>
          <span className="text-white/15">|</span>
          <span>GOES-16 XRAY</span>
          <span className="text-white/15">|</span>
          <span className="text-sky-400/50">LIVE</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-white/40">{new Date().toUTCString().replace(" GMT", " UTC")}</span>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <div className="flex-1 min-h-0 grid p-3 gap-3" style={{ gridTemplateColumns: "1fr 340px", gridTemplateRows: "1fr 180px" }}>

        {/* Sun visualization — spans both rows on left */}
        <Panel className="row-span-2 relative">
          <SectionLabel>Heliospheric Magnetogram · Active Region Overlay</SectionLabel>
          <div className="flex-1 min-h-0 relative">
            {loading && <LoadingOverlay />}
            <SunVisualization regions={d.active_regions} />
          </div>
          {/* Active region table overlay */}
          {d.active_regions.length > 0 && (
            <div className="absolute bottom-8 right-3 bg-black/80 border border-white/10 rounded p-2 text-[9px] font-mono">
              <div className="text-white/30 uppercase tracking-wider mb-1.5">Active Regions</div>
              {d.active_regions.map(r => (
                <div key={r.id} className="flex items-center gap-3 py-0.5">
                  <span className="text-white/70 font-bold w-14">{r.label}</span>
                  <span className="text-white/30 w-16">Lat {r.lat > 0 ? "+" : ""}{r.lat}°</span>
                  <span
                    className="uppercase font-bold w-14"
                    style={{ color: { low: "#22c55e", moderate: "#eab308", high: "#f97316", severe: "#ef4444" }[r.flare_risk] }}
                  >
                    {r.flare_risk}
                  </span>
                  <span className="text-white/25">{r.area} μH</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Right column top: Alert + Forecast stacked */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Alert status */}
          <Panel style={{ flex: "0 0 auto", height: "220px" } as React.CSSProperties}>
            <SectionLabel>Flare Alert Status</SectionLabel>
            <div className="flex-1 min-h-0 relative">
              {loading && <LoadingOverlay />}
              <AlertPanel prediction={d.prediction} />
            </div>
          </Panel>

          {/* Forecast chart */}
          <Panel className="flex-1 min-h-0">
            <SectionLabel>24h Probability Forecast</SectionLabel>
            <div className="flex-1 min-h-0 relative">
              {loading && <LoadingOverlay />}
              <ForecastChart series={d.forecast_series} />
            </div>
          </Panel>
        </div>

        {/* Telemetry — bottom right */}
        <Panel>
          <div className="flex-1 min-h-0 relative">
            {loading && <LoadingOverlay />}
            <TelemetryPanel telemetry={d.telemetry} />
          </div>
        </Panel>

      </div>

      {/* Status bar */}
      <StatusBar health={d.health} isLoading={loading} error={error} lastUpdated={lastUpdated} />
    </div>
  );
}
