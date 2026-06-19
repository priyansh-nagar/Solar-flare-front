import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { SunVisualization } from "./SunVisualization";
import { XRayLightCurves } from "./XRayLightCurves";
import { FlareEventLog } from "./FlareEventLog";
import { StatusBar } from "./StatusBar";
import { fetchSolarData } from "./api";
import type { SolarApiResponse, XRayPoint } from "./api";
import { format } from "date-fns";

const POLL = 30_000;
const TOAST_TTL = 8_000;

/* ── Alert toast ──────────────────────────────────────────────────────────── */
interface ToastData {
  id: number;
  timestamp: string;
  flare_class: string;
  p_30min: number;
  p_extreme: number;
  threshold: number;
  region: string;
  message: string;
  born: number;
}

function FlareToast({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const frame = () => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / TOAST_TTL) * 100);
      setProgress(pct);
      if (pct > 0) requestAnimationFrame(frame);
    };
    const raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const isX = toast.flare_class === "X";
  const accent = isX ? "#FF3B3B" : "#FF8C00";

  return (
    <div
      style={{
        width: 300,
        background: "#070C10",
        border: `1px solid ${accent}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: `0 0 24px ${accent}33, 0 4px 16px rgba(0,0,0,0.8)`,
        fontFamily: "monospace",
        animation: "toast-in 0.22s ease",
      }}
    >
      <style>{`
        @keyframes toast-in { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px 6px", borderBottom: `1px solid ${accent}33` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{
            display: "inline-block", width: 7, height: 7, borderRadius: "50%",
            background: accent, boxShadow: `0 0 6px ${accent}`,
            animation: "blink-led 0.6s infinite",
          }} />
          <span style={{ fontSize: 9, letterSpacing: "0.2em", color: accent, textTransform: "uppercase", fontWeight: "bold" }}>
            ⚠ FLARE ALERT
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#2E4558", fontSize: 12, lineHeight: 1, padding: 2 }}
        >✕</button>
      </div>

      {/* Body */}
      <div style={{ padding: "8px 10px 6px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 36, fontWeight: "bold", color: accent, lineHeight: 1 }}>
            {toast.flare_class}
          </span>
          <div>
            <div style={{ fontSize: 9, color: "#C8D8E8", letterSpacing: "0.1em" }}>CLASS PROBABILITY</div>
            <div style={{ fontSize: 18, fontWeight: "bold", color: accent }}>{Math.round(toast.p_30min * 100)}%</div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 8, color: "#2E4558", letterSpacing: "0.08em" }}>REGION</div>
            <div style={{ fontSize: 11, color: "#5B7A8A", fontWeight: "bold" }}>{toast.region}</div>
          </div>
        </div>

        <div style={{ fontSize: 8, color: "#5B7A8A", lineHeight: 1.6, marginBottom: 6, letterSpacing: "0.05em" }}>
          {toast.message}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: "#2E4558" }}>
          <span>THRESHOLD {Math.round(toast.threshold * 100)}%</span>
          <span>X-CLASS {Math.round(toast.p_extreme * 100)}%</span>
          <span>{toast.timestamp.slice(11, 19)} UTC</span>
        </div>
      </div>

      {/* Countdown bar */}
      <div style={{ height: 2, background: "#0C1219" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: accent, opacity: 0.7, transition: "none" }} />
      </div>
    </div>
  );
}

/* ── colour constants ──────────────────────────────────────────────────────── */
const C = {
  bg:        "#080C10",
  bg2:       "#0C1219",
  panel:     "#0E1620",
  border:    "#1E2D3D",
  textPri:   "#C8D8E8",
  textSec:   "#5B7A8A",
  textDim:   "#2E4558",
  green:     "#00FF88",
  amber:     "#FFB800",
  red:       "#FF3B3B",
  blue:      "#4DAAFF",
  cyan:      "#00D4FF",
};

/* ── helpers ───────────────────────────────────────────────────────────────── */
function classifyFlux(v: number) {
  if (v >= 1e-4) return { cls: "X", color: C.red };
  if (v >= 1e-5) return { cls: "M", color: "#FF8C00" };
  if (v >= 1e-6) return { cls: "C", color: C.amber };
  if (v >= 1e-7) return { cls: "B", color: C.blue };
  return { cls: "A", color: C.textSec };
}

function alertLevel(flux: number) {
  if (flux >= 1e-4) return { label: "FLARE DETECTED", color: C.red,   state: "alert" };
  if (flux >= 1e-5) return { label: "WARNING",        color: C.red,   state: "warning" };
  if (flux >= 1e-6) return { label: "ELEVATED",       color: C.amber, state: "watch" };
  return                    { label: "NOMINAL",        color: C.green, state: "quiet" };
}

/* ── shared panel components ───────────────────────────────────────────────── */
function Panel({
  children, topAccent, className = "", style = {},
}: {
  children: React.ReactNode;
  topAccent?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`flex flex-col overflow-hidden ${className}`}
      style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 2,
        borderTop: `2px solid ${topAccent ?? C.border}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function PanelHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between flex-shrink-0"
      style={{
        background: "#0A1218",
        borderBottom: `1px solid ${C.border}`,
        padding: "6px 14px",
      }}
    >
      <span style={{ fontSize: 9, letterSpacing: "0.2em", color: C.textSec, textTransform: "uppercase", fontFamily: "monospace" }}>
        {label}
      </span>
      {right && (
        <span style={{ fontSize: 8, color: C.textDim, fontFamily: "monospace", letterSpacing: "0.1em" }}>
          {right}
        </span>
      )}
    </div>
  );
}

/* LED indicator */
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

const EMPTY: SolarApiResponse = {
  active_regions: [],
  xray_series: [],
  health: { status: "", model_status: "loading", inference_time_ms: 0, last_prediction_time: "", system_health: "nominal" },
  forecast_windows: [],
  flare_events: [],
  confidence: 0,
  lead_time_peak: 0,
  p_15min: 0.30,
  p_30min: 0.19,
  p_extreme: 0.05,
};

/* ── main component ─────────────────────────────────────────────────────────── */
export function Dashboard() {
  const [data, setData]   = useState<SolarApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUp, setLastUp]   = useState<Date | null>(null);
  const [, setTick]       = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsForecast, setWsForecast] = useState<{ p_15min: number; p_30min: number; p_extreme: number; inference_ms?: number } | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [xraySeries, setXraySeries] = useState<XRayPoint[]>([]);
  const [liveFlareEvents, setLiveFlareEvents] = useState<SolarApiResponse["flare_events"]>([]);
  const [replayActive, setReplayActive] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const xraySeededRef    = useRef(false);
  const replayActiveRef  = useRef(false);
  const latestSoftFluxRef = useRef(2.3e-6); // updated on every forecast msg; used by alert handler

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetchSolarData();
      setData(r); setError(null); setLastUp(new Date());
      // Seed xraySeries once from the HTTP data so the chart/navigator
      // always have a full 360-point history on load (no blank-chart flash).
      // After this, every incoming WS point appends to the seeded series.
      if (!xraySeededRef.current && r.xray_series.length > 0) {
        xraySeededRef.current = true;
        setXraySeries(r.xray_series);
      }
      // Always refresh flare events from HTTP, but keep any live WS alerts at the top
      if (r.flare_events.length > 0) {
        setLiveFlareEvents((prev) => {
          const wsAlerts = prev.filter((e) => e.id.startsWith("ws-"));
          const merged = [...wsAlerts, ...r.flare_events];
          // Deduplicate by id and keep newest 20
          const seen = new Set<string>();
          return merged.filter((e) => seen.has(e.id) ? false : (seen.add(e.id), true)).slice(0, 20);
        });
      }
    } catch (e) { setError(e instanceof Error ? e.message : "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, POLL); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(id); }, []);

  useEffect(() => {
    const wsUrl: string | undefined = (import.meta as any).env?.VITE_WS_URL;
    if (!wsUrl) return;
    const httpBase = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
    const ping = () => fetch(`${httpBase}/api/healthz`, { mode: "no-cors" }).catch(() => {});
    ping();
    const id = setInterval(ping, 14 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    // In production (Vercel), point at the Render backend via VITE_WS_URL;
    // in dev, use the same host so the Vite proxy works.
    const wsBase = (import.meta as any).env?.VITE_WS_URL ?? `${proto}//${window.location.host}`;
    const url = `${wsBase}/api/ws`;
    let ws: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen  = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        retryTimer = setTimeout(connect, 5000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);

          if (msg.type === "forecast") {
            if (msg.soft_flux) latestSoftFluxRef.current = msg.soft_flux as number;
            setWsForecast({
              p_15min: msg.p_15min, p_30min: msg.p_30min, p_extreme: msg.p_extreme,
              inference_ms: msg.inference_ms,
            });
            setXraySeries((prev) => {
              // On replay_start the series is cleared; allow building from zero
              const newPt: XRayPoint = {
                time: (msg.timestamp as string) ?? new Date().toISOString(),
                soft: (msg.soft_flux as number) ?? (prev[prev.length - 1]?.soft ?? 2.3e-6),
                hard: (msg.hard_flux as number) ?? (prev[prev.length - 1]?.hard ?? 8.1e-8),
                prob: msg.p_30min as number,
              };
              return [...prev.slice(-479), newPt];
            });
            if (msg.replay === true) {
              const pct = Math.round(((msg.replay_idx as number) + 1) / (msg.replay_total as number) * 100);
              setReplayProgress(pct);
            }

          } else if (msg.type === "replay_start") {
            replayActiveRef.current = true;
            setReplayActive(true);
            setReplayProgress(0);
            setXraySeries([]); // clear so chart rebuilds from replay data

          } else if (msg.type === "replay_end") {
            replayActiveRef.current = false;
            setReplayActive(false);
            setReplayProgress(100);
            // Allow re-seeding from HTTP on next poll so the live chart
            // starts fresh after replay instead of showing stale replay data
            xraySeededRef.current = false;

          } else if (msg.type === "alert") {
            const id = Date.now();
            // Suppress toasts during replay — the replay can fire dozens of alerts
            // in ~24 seconds (one per threshold-crossing point), which would spam the UI.
            if (!replayActiveRef.current) {
              const toast: ToastData = { id, born: id, ...msg };
              setToasts((prev) => [...prev.slice(-2), toast]);
              setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_TTL);
            }
            // Add alert as a new entry in the live flare event log
            setLiveFlareEvents((prev) => {
              const flux = latestSoftFluxRef.current;
              const fc = msg.flare_class as string;
              const divisor = fc === "X" ? 1e-4 : fc === "M" ? 1e-5 : 1e-6;
              const magnitude = Math.max(1.0, flux / divisor);
              const magStr = magnitude < 10 ? magnitude.toFixed(1) : magnitude.toFixed(0);
              const noise = (Math.random() - 0.5) * 0.08;
              const newEv = {
                id: `ws-${id}`,
                time: (msg.timestamp as string) ?? new Date().toISOString(),
                class: `${fc}${magStr}`,
                peak_flux: flux,
                region: (msg.region as string) ?? "AR4081",
                type: "forecast" as const,
                confidence: parseFloat(Math.min(0.99, Math.max(0.50, (msg.p_30min as number) + noise)).toFixed(2)),
              };
              return [newEv, ...prev].slice(0, 20); // keep latest 20
            });
          }
        } catch { /* ignore */ }
      };
    }

    connect();
    return () => {
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  const d = data ?? EMPTY;
  // Prefer the live WS-driven series for hero metrics; fall back to HTTP data
  const liveSeries = xraySeries.length > 0 ? xraySeries : d.xray_series;
  const lastPt   = liveSeries[liveSeries.length - 1];
  const softFlux = lastPt?.soft ?? 0;
  const hardFlux = lastPt?.hard ?? 0;
  const alert    = alertLevel(softFlux);
  const nowcastAlert = alert.state === "warning" || alert.state === "alert";
  const { cls: softCls, color: softColor } = classifyFlux(softFlux);
  const { cls: hardCls }                   = classifyFlux(hardFlux);
  const prev  = liveSeries[liveSeries.length - 6];
  const trend = prev && softFlux > prev.soft * 1.4 ? "▲ RISING"
              : prev && softFlux < prev.soft * 0.7 ? "▼ FALLING" : "● STABLE";
  const trendColor = trend.startsWith("▲") ? C.amber : trend.startsWith("▼") ? C.blue : C.textSec;

  const flareAnno = useMemo(
    () => d.flare_events.map(e => ({ time: e.time, class: e.class, label: e.class })),
    [d.flare_events]
  );

  const lastFw = d.forecast_windows[d.forecast_windows.length - 1];
  const utcNow = format(new Date(), "HH:mm:ss");

  return (
    <div
      className="w-full h-screen flex flex-col overflow-hidden select-none relative"
      style={{ background: C.bg, fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace" }}
    >
      {/* ── CRT scanline overlay ──────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
        }}
      />

      {/* ── Toast alert stack ────────────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div
          style={{
            position: "fixed", top: 52, right: 16, zIndex: 9000,
            display: "flex", flexDirection: "column", gap: 8,
            pointerEvents: "auto",
          }}
        >
          {toasts.map((t) => (
            <FlareToast key={t.id} toast={t} onClose={() => dismissToast(t.id)} />
          ))}
        </div>
      )}

      {/* ── blink keyframe injection ──────────────────────────────────────── */}
      <style>{`
        @keyframes blink-led { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between flex-shrink-0"
        style={{
          background: "#060A0E",
          borderBottom: `1px solid ${C.border}`,
          padding: "8px 20px",
        }}
      >
        <div className="flex items-center gap-4">
          {/* alert indicator */}
          <div
            className="flex items-center gap-2"
            style={{
              background: alert.state !== "quiet" ? alert.color + "0D" : "transparent",
              border: `1px solid ${alert.color}55`,
              borderRadius: 2,
              padding: "4px 10px",
            }}
          >
            <LED
              color={alert.color}
              blink={alert.state === "warning" || alert.state === "alert"}
            />
            <span style={{ fontSize: 10, letterSpacing: "0.18em", color: alert.color, fontFamily: "monospace" }}>
              {alert.label}
            </span>
          </div>

          <div style={{ width: 1, height: 20, background: C.border }} />

          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.22em", color: C.textPri, fontFamily: "monospace" }}>
              SOLAR FLARE PREDICTION SYSTEM
            </div>
            <div style={{ fontSize: 8, letterSpacing: "0.18em", color: C.textDim, fontFamily: "monospace" }}>
              NOWCASTING · FORECASTING · GOES X-RAY ANALYSIS
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5" style={{ fontSize: 9, fontFamily: "monospace", color: C.textDim }}>
          <span>GOES-16 XRSB 1–8Å</span>
          <span>GOES-16 XRSA 0.5–4Å</span>
          <div style={{ width: 1, height: 14, background: C.border }} />
          <div className="flex items-center gap-1.5">
            <LED color={wsConnected ? C.green : C.amber} blink={!wsConnected} />
            <span style={{ color: wsConnected ? C.green : C.amber, letterSpacing: "0.1em" }}>
              {wsConnected ? "WS LIVE" : "WS OFFLINE"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <LED color={C.green} />
            <span style={{ color: C.green, letterSpacing: "0.1em" }}>LIVE {utcNow} UTC</span>
          </div>
        </div>
      </header>

      {/* ── MAIN GRID ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex gap-2 p-2">

        {/* ── LEFT: Sun + AR Table ─────────────────────────────────────── */}
        <div className="flex flex-col gap-2" style={{ width: "38%", flexShrink: 0 }}>

          <Panel topAccent={C.amber} className="flex-1 min-h-0">
            <PanelHeader label="Heliospheric Magnetogram" right="HMI · ACTIVE REGION OVERLAY" />
            <div className="flex-1 min-h-0 relative">
              {loading && !data && (
                <div
                  className="absolute inset-0 flex items-center justify-center z-10"
                  style={{ background: C.bg + "CC" }}
                >
                  <div
                    className="w-5 h-5 border-2 animate-spin"
                    style={{ borderColor: C.border, borderTopColor: C.blue }}
                  />
                </div>
              )}
              <SunVisualization regions={d.active_regions} nowcastAlert={nowcastAlert} />
            </div>
          </Panel>

          <Panel topAccent={C.blue} style={{ flexShrink: 0 }}>
            <PanelHeader label="Active Regions" right={`${d.active_regions.length} REGIONS TRACKED`} />
            <table className="w-full" style={{ fontSize: 9, fontFamily: "monospace" }}>
              <thead>
                <tr style={{ background: "#0A1218", borderBottom: `1px solid ${C.border}` }}>
                  {["Region","Position","Area","Risk"].map(h => (
                    <th key={h} style={{ padding: "5px 12px", textAlign: "left", fontWeight: "normal", color: C.textSec, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.active_regions.map((r, i) => {
                  const riskColor = { low: C.green, moderate: C.amber, high: "#FF8C00", severe: C.red }[r.flare_risk];
                  return (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? C.panel : C.bg2, borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "5px 12px", color: C.textPri, fontWeight: "bold" }}>{r.label}</td>
                      <td style={{ padding: "5px 12px", color: C.textSec }}>
                        {r.lat > 0 ? "N" : "S"}{Math.abs(r.lat)} {r.lon > 0 ? "E" : "W"}{Math.abs(r.lon)}
                      </td>
                      <td style={{ padding: "5px 12px", color: C.textSec }}>{r.area} μH</td>
                      <td style={{ padding: "5px 12px", color: riskColor, fontWeight: "bold", letterSpacing: "0.1em" }}>
                        {r.flare_risk.toUpperCase()}
                      </td>
                    </tr>
                  );
                })}
                {d.active_regions.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "8px 12px", color: C.textDim, textAlign: "center" }}>NO ACTIVE REGIONS</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Panel>
        </div>

        {/* ── RIGHT: data panels ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">

          {/* Nowcast + telemetry strip */}
          <Panel topAccent={C.cyan} style={{ flexShrink: 0 }}>
            <div className="flex items-stretch" style={{ borderBottom: `1px solid ${C.border}` }}>
              {/* divider helper */}
              {[
                /* Current class */
                <div key="cls" style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 8, letterSpacing: "0.15em", color: C.textSec, textTransform: "uppercase", marginBottom: 4 }}>
                      Current Class
                    </div>
                    <div style={{ fontSize: 96, fontWeight: "bold", lineHeight: 1, color: softColor, fontFamily: "monospace" }}>
                      {softCls}
                    </div>
                  </div>
                  <div style={{ fontSize: 8, fontFamily: "monospace", lineHeight: 1.8 }}>
                    <div style={{ color: trendColor, letterSpacing: "0.1em" }}>{trend}</div>
                    <div style={{ color: C.textDim }}>
                      SOFT: <span style={{ color: C.textSec }}>{softCls}-class</span>
                    </div>
                    <div style={{ color: C.textDim }}>
                      HARD: <span style={{ color: C.textSec }}>{hardCls}-class</span>
                    </div>
                  </div>
                </div>,

                /* Soft X-ray */
                <div key="soft" style={{ padding: "10px 20px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, borderLeft: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 8, letterSpacing: "0.15em", color: C.textSec, textTransform: "uppercase" }}>Soft X-ray 1–8Å</div>
                  <div style={{ fontSize: 28, fontWeight: "bold", color: C.blue, fontFamily: "monospace", lineHeight: 1.1 }}>{softFlux.toExponential(2)} W/m²</div>
                  <div style={{ width: 40, height: 2, background: C.blue, marginTop: 2 }} />
                </div>,

                /* Hard X-ray */
                <div key="hard" style={{ padding: "10px 20px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, borderLeft: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 8, letterSpacing: "0.15em", color: C.textSec, textTransform: "uppercase" }}>Hard X-ray 0.5–4Å</div>
                  <div style={{ fontSize: 28, fontWeight: "bold", color: C.cyan, fontFamily: "monospace", lineHeight: 1.1 }}>{hardFlux.toExponential(2)} W/m²</div>
                  <div style={{ width: 40, height: 2, background: C.cyan, marginTop: 2 }} />
                </div>,

                /* Forecast */
                <div key="fcst" style={{ padding: "10px 20px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, borderLeft: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 8, letterSpacing: "0.15em", color: C.textSec, textTransform: "uppercase", marginBottom: 2 }}>Predictive Forecast</div>
                  {[
                    { label: "M-CLASS (30min)", val: (wsForecast ?? d).p_30min, color: C.amber },
                    { label: "X-CLASS (30min)", val: (wsForecast ?? d).p_extreme, color: C.red },
                    { label: "ALL CLEAR (15min)", val: 1 - (wsForecast ?? d).p_15min, color: C.green },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 8, fontFamily: "monospace" }}>
                      <span style={{ color: C.textDim, minWidth: 112 }}>{label}</span>
                      <div style={{ width: 64, height: 2, background: C.border }}>
                        <div style={{ height: "100%", width: `${Math.round(Math.min(1, val) * 100)}%`, background: color, transition: "width 0.5s ease" }} />
                      </div>
                      <span style={{ color, width: 32 }}>{Math.round(Math.min(1, val) * 100)}%</span>
                    </div>
                  ))}
                </div>,

                /* Telemetry */
                <div key="tele" style={{ padding: "10px 20px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, borderLeft: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 8, letterSpacing: "0.15em", color: C.textSec, textTransform: "uppercase", marginBottom: 2 }}>Telemetry</div>
                  {[
                    { k: "AR Count",  v: d.active_regions.length.toString() },
                    { k: "Inference", v: wsForecast?.inference_ms ? `${wsForecast.inference_ms}ms` : (d.health.inference_time_ms ? `${d.health.inference_time_ms}ms` : "—") },
                    { k: "Model",     v: d.health.model_status?.toUpperCase() ?? "—" },
                  ].map(({ k, v }) => (
                    <div key={k} style={{ fontSize: 8, fontFamily: "monospace" }}>
                      <span style={{ color: C.textDim }}>{k} </span>
                      <span style={{ color: C.textSec }}>{v}</span>
                    </div>
                  ))}
                </div>,
              ]}
            </div>
          </Panel>

          {/* X-ray light curves */}
          <Panel topAccent={C.blue} className="flex-1 min-h-0">
            <div className="flex items-center justify-between flex-shrink-0" style={{ background: "#0A1218", borderBottom: `1px solid ${C.border}`, padding: "6px 14px" }}>
              <span style={{ fontSize: 9, letterSpacing: "0.2em", color: C.textSec, textTransform: "uppercase", fontFamily: "monospace" }}>
                X-ray Light Curves · Nowcasting Trigger
              </span>
              <div className="flex items-center gap-3">
                {replayActive && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 8, fontFamily: "monospace" }}>
                    <span style={{ color: C.amber, letterSpacing: "0.1em" }}>REPLAY {replayProgress}%</span>
                    <div style={{ width: 60, height: 2, background: C.border }}>
                      <div style={{ height: "100%", width: `${replayProgress}%`, background: C.amber, transition: "width 0.15s linear" }} />
                    </div>
                  </div>
                )}
                {replayActive && (
                  <button
                    onClick={() => {
                      if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: "replay_stop" }));
                      }
                      setReplayActive(false);
                      setReplayProgress(0);
                    }}
                    style={{
                      background: "none", border: `1px solid #FF3B3B`,
                      color: "#FF3B3B",
                      fontFamily: "monospace", fontSize: 8, letterSpacing: "0.12em",
                      padding: "2px 8px", borderRadius: 2, cursor: "pointer",
                      textTransform: "uppercase",
                    }}
                  >
                    ■ STOP
                  </button>
                )}
                {!replayActive && (
                  <button
                    onClick={() => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "replay_start" })); }}
                    disabled={!wsConnected}
                    style={{
                      background: "none", border: `1px solid ${!wsConnected ? C.border : C.amber}`,
                      color: !wsConnected ? C.textDim : C.amber,
                      fontFamily: "monospace", fontSize: 8, letterSpacing: "0.12em",
                      padding: "2px 8px", borderRadius: 2, cursor: !wsConnected ? "not-allowed" : "pointer",
                      textTransform: "uppercase",
                    }}
                  >
                    ▶ REPLAY
                  </button>
                )}
                <span style={{ fontSize: 8, color: C.textDim, fontFamily: "monospace", letterSpacing: "0.1em" }}>6h · GOES-16 · drag navigator to scroll</span>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {(() => {
                // During replay: only show replay (WS) data — never fall back to
                // the static HTTP seed, which would cause a jarring source-switch
                // and brush-range corruption mid-replay.
                // xraySeries is seeded from HTTP on load (so the chart is never blank),
                // then each WS point appends. Once seeded it always has >= 360 pts,
                // so the >= 30 guard is satisfied immediately. The HTTP seed uses
                // random flare-bump positions, so the navigator shape differs each reload.
                const activeSeries = replayActive
                  ? (xraySeries.length > 0 ? xraySeries : null)
                  : (xraySeries.length >= 30 ? xraySeries : d.xray_series.length >= 30 ? d.xray_series : null);

                return activeSeries
                  ? (
                    <XRayLightCurves
                      key={replayActive ? "replay" : "live"}
                      series={activeSeries}
                      flareEvents={flareAnno}
                      probM30={(wsForecast ?? d).p_30min}
                      replayActive={replayActive}
                      replayProgress={replayProgress}
                    />
                  )
                  : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 9, fontFamily: "monospace", color: C.textDim }}>
                      {replayActive ? "LOADING REPLAY DATA…" : "AWAITING DATA STREAM…"}
                    </div>
                  );
              })()}
            </div>
          </Panel>

          {/* Flare event log */}
          <Panel topAccent={C.cyan} style={{ flexShrink: 0, height: 172 }}>
            <PanelHeader label="Flare Event Database" right={`${liveFlareEvents.length} EVENTS · NOWCAST + FORECAST`} />
            <div
              className="flex-1 min-h-0 overflow-y-auto"
              style={{ scrollbarWidth: "thin", scrollbarColor: `${C.border} transparent` }}
            >
              <FlareEventLog events={liveFlareEvents} />
            </div>
          </Panel>
        </div>
      </div>

      {/* ── STATUS BAR ───────────────────────────────────────────────────── */}
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
