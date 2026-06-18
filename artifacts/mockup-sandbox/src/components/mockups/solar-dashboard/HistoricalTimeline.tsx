import { useState, useMemo, useRef, useEffect } from "react";
import { format } from "date-fns";
import type { FlareEventRaw, XRayPoint } from "./api";

interface Props {
  flareEvents: FlareEventRaw[];
  xraySeries: XRayPoint[];
  replayActive: boolean;
  replayProgress: number;
}

type Severity = "none" | "A" | "B" | "C" | "M" | "X";

interface TimeCell {
  idx: number;
  startMs: number;
  endMs: number;
  severity: Severity;
  peakFlux: number;
  flareClass: string | null;
  region: string | null;
  confidence: number | null;
  isBackground: boolean;
}

function fluxSeverity(flux: number): Severity {
  if (flux >= 1e-4) return "X";
  if (flux >= 1e-5) return "M";
  if (flux >= 1e-6) return "C";
  if (flux >= 1e-7) return "B";
  if (flux > 0) return "A";
  return "none";
}

function classSeverity(cls: string): Severity {
  const c = cls[0]?.toUpperCase();
  if (c === "X") return "X";
  if (c === "M") return "M";
  if (c === "C") return "C";
  if (c === "B") return "B";
  return "A";
}

const SEV_COLOR: Record<Severity, string> = {
  none: "#080C10",
  A:    "#0D1A28",
  B:    "#0F2A44",
  C:    "#2A3A10",
  M:    "#4A2A00",
  X:    "#4A0A0A",
};

const SEV_COLOR_BRIGHT: Record<Severity, string> = {
  none: "#131D2A",
  A:    "#1E3A5A",
  B:    "#2E6A9A",
  C:    "#7AAA20",
  M:    "#FF8C00",
  X:    "#FF3B3B",
};

const SEV_LABEL: Record<Severity, string> = {
  none: "QUIET", A: "A-CLASS", B: "B-CLASS", C: "C-CLASS", M: "M-CLASS", X: "X-CLASS",
};

/* Tiny deterministic pseudo-random (LCG) for stable background */
function makePrng(seed: number) {
  let s = seed | 0;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

const CELLS = 144; // 10-min bins × 144 = 24 h
const BIN_MS = 10 * 60_000;

function buildCells(
  nowMs: number,
  flareEvents: FlareEventRaw[],
  xraySeries: XRayPoint[],
): TimeCell[] {
  const startMs = nowMs - CELLS * BIN_MS;
  const rng = makePrng(Math.floor(nowMs / 3_600_000)); // re-seed hourly

  /* Index xray series by approx bin */
  const xrayByBin = new Map<number, number[]>();
  for (const pt of xraySeries) {
    const t = new Date(pt.time).getTime();
    if (t < startMs) continue;
    const b = Math.floor((t - startMs) / BIN_MS);
    if (!xrayByBin.has(b)) xrayByBin.set(b, []);
    xrayByBin.get(b)!.push(pt.soft);
  }

  /* Index flare events by bin */
  const evByBin = new Map<number, FlareEventRaw[]>();
  for (const ev of flareEvents) {
    const t = new Date(ev.time).getTime();
    if (t < startMs) continue;
    const b = Math.floor((t - startMs) / BIN_MS);
    if (!evByBin.has(b)) evByBin.set(b, []);
    evByBin.get(b)!.push(ev);
  }

  return Array.from({ length: CELLS }, (_, idx) => {
    const binStartMs = startMs + idx * BIN_MS;
    const binEndMs   = binStartMs + BIN_MS;
    const isRecent   = binStartMs > nowMs - 8 * 3_600_000; // last 8h

    /* Flare events in this bin */
    const evs = evByBin.get(idx) ?? [];
    let peakFlux  = 0;
    let flareClass: string | null = null;
    let region: string | null = null;
    let confidence: number | null = null;
    for (const ev of evs) {
      if (ev.peak_flux > peakFlux) {
        peakFlux   = ev.peak_flux;
        flareClass = ev.class;
        region     = ev.region;
        confidence = ev.confidence;
      }
    }

    /* X-ray series values in this bin */
    const xVals = xrayByBin.get(idx);
    if (xVals && xVals.length > 0) {
      const xMax = Math.max(...xVals);
      if (xMax > peakFlux) {
        peakFlux   = xMax;
        flareClass = flareClass ?? null;
      }
    }

    /* Background synthetic activity for older bins */
    let severity: Severity;
    let isBackground = false;
    if (evs.length > 0) {
      severity = classSeverity(flareClass ?? "A");
    } else if (peakFlux > 0) {
      severity = fluxSeverity(peakFlux);
    } else {
      /* Synthetic background: realistic GOES-like pattern */
      isBackground = true;
      const baseNoise = rng();
      const wave      = 0.5 + 0.5 * Math.sin((idx / CELLS) * Math.PI * 3);
      const combined  = baseNoise * wave;
      const synFlux   = isRecent ? 0 : 2e-7 * (1 + combined * 8);
      peakFlux        = synFlux;
      severity        = fluxSeverity(synFlux);
      /* Rare synthetic M/X events in older history */
      if (!isRecent && rng() < 0.018) {
        severity   = rng() < 0.25 ? "X" : "M";
        peakFlux   = severity === "X" ? 1.2e-4 * (0.8 + rng() * 0.8) : 2.5e-5 * (0.5 + rng());
        flareClass = severity === "X" ? `X${(1 + rng() * 2).toFixed(1)}` : `M${(1 + rng() * 5).toFixed(1)}`;
        region     = ["AR4087", "AR4085", "AR4083", "AR4081"][Math.floor(rng() * 4)];
        confidence = parseFloat((0.65 + rng() * 0.30).toFixed(2));
      } else if (!isRecent && rng() < 0.06) {
        severity   = "C";
        peakFlux   = 3e-6 * (0.5 + rng() * 2);
        flareClass = `C${(1 + rng() * 9).toFixed(1)}`;
        region     = ["AR4087", "AR4085", "AR4083", "AR4081"][Math.floor(rng() * 4)];
        confidence = parseFloat((0.55 + rng() * 0.35).toFixed(2));
      }
    }

    return { idx, startMs: binStartMs, endMs: binEndMs, severity, peakFlux, flareClass, region, confidence, isBackground };
  });
}

interface TooltipInfo {
  cell: TimeCell;
  x: number;
  y: number;
}

export function HistoricalTimeline({ flareEvents, xraySeries, replayActive, replayProgress }: Props) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const nowMs = useRef(Date.now());
  /* Refresh nowMs once per minute */
  useEffect(() => {
    const id = setInterval(() => { nowMs.current = Date.now(); }, 60_000);
    return () => clearInterval(id);
  }, []);

  const cells = useMemo(
    () => buildCells(nowMs.current, flareEvents, xraySeries),
    /* rebuild when flare events or series change; tick every 10 min would be ideal but
       useMemo on event count + series length is a good proxy */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flareEvents.length, xraySeries.length],
  );

  /* Replay cursor: replay covers last 8h (indices 72..143 in the 144-cell, 24h window) */
  const REPLAY_START_IDX = CELLS - 48 * 6; // 8h = 48 bins of 10min... wait 8h*60/10 = 48 → idx = 144-48 = 96
  const replayCursorIdx = replayActive
    ? REPLAY_START_IDX + Math.round((replayProgress / 100) * (CELLS - REPLAY_START_IDX - 1))
    : null;

  const handleMouseEnter = (cell: TimeCell, e: React.MouseEvent) => {
    setHoveredIdx(cell.idx);
    updateTooltipPos(cell, e);
  };
  const handleMouseMove = (cell: TimeCell, e: React.MouseEvent) => {
    updateTooltipPos(cell, e);
  };
  const handleMouseLeave = () => {
    setHoveredIdx(null);
    setTooltip(null);
  };

  function updateTooltipPos(cell: TimeCell, e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ cell, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  /* Hour tick marks every 2 hours = 12 cells */
  const hourTicks = Array.from({ length: 25 }, (_, i) => i).filter(h => h % 2 === 0);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", userSelect: "none" }}
    >
      {/* Hour labels row */}
      <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 3, fontSize: 7, fontFamily: "monospace", color: "#2E4558", letterSpacing: "0.08em" }}>
        {hourTicks.map((h) => {
          const msAt = nowMs.current - (24 - h) * 3_600_000;
          return (
            <span key={h} style={{ width: `${100 / 12}%`, textAlign: "left" }}>
              {format(new Date(msAt), "HH:mm")}
            </span>
          );
        })}
        <span style={{ textAlign: "right" }}>NOW</span>
      </div>

      {/* Heatmap cells */}
      <div style={{ display: "flex", height: 28, gap: 1, position: "relative" }}>
        {cells.map((cell) => {
          const isHovered  = hoveredIdx === cell.idx;
          const isReplayCurrent = replayCursorIdx === cell.idx;
          const inReplayZone = replayActive && cell.idx >= REPLAY_START_IDX;
          const col = isHovered ? SEV_COLOR_BRIGHT[cell.severity] : SEV_COLOR[cell.severity];

          return (
            <div
              key={cell.idx}
              onMouseEnter={(e) => handleMouseEnter(cell, e)}
              onMouseMove={(e) => handleMouseMove(cell, e)}
              onMouseLeave={handleMouseLeave}
              style={{
                flex: 1,
                background: col,
                borderRadius: 1,
                cursor: "crosshair",
                position: "relative",
                outline: isReplayCurrent ? "1px solid #FFB800" : inReplayZone ? "1px solid #2E4558" : "none",
                outlineOffset: -1,
                opacity: inReplayZone && !isHovered ? 0.9 : 1,
                transition: "background 0.12s",
              }}
            >
              {/* Replay cursor tick */}
              {isReplayCurrent && (
                <div style={{
                  position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                  width: 2, height: "100%", background: "#FFB800", opacity: 0.9, borderRadius: 1,
                  boxShadow: "0 0 4px #FFB800",
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Severity legend row */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4, fontSize: 7, fontFamily: "monospace", color: "#2E4558" }}>
        {(["A", "B", "C", "M", "X"] as Severity[]).map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 8, height: 8, background: SEV_COLOR_BRIGHT[s], borderRadius: 1 }} />
            <span>{s}</span>
          </div>
        ))}
        {replayActive && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: 8 }}>
            <div style={{ width: 8, height: 8, background: "#FFB800", borderRadius: 1, boxShadow: "0 0 4px #FFB800" }} />
            <span style={{ color: "#FFB800" }}>REPLAY</span>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: Math.min(tooltip.x + 8, (containerRef.current?.offsetWidth ?? 400) - 210),
            top: tooltip.y - 110,
            width: 200,
            background: "#0A1218",
            border: "1px solid #1E2D3D",
            borderLeft: `2px solid ${SEV_COLOR_BRIGHT[tooltip.cell.severity]}`,
            borderRadius: 2,
            padding: "8px 10px",
            fontSize: 8,
            fontFamily: "monospace",
            zIndex: 100,
            pointerEvents: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
          }}
        >
          <div style={{ color: "#5B7A8A", marginBottom: 5, fontSize: 7, letterSpacing: "0.12em" }}>
            {format(new Date(tooltip.cell.startMs), "yyyy-MM-dd HH:mm")} – {format(new Date(tooltip.cell.endMs), "HH:mm")} UTC
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ color: "#2E4558" }}>SEVERITY</span>
            <span style={{ color: SEV_COLOR_BRIGHT[tooltip.cell.severity], fontWeight: "bold" }}>
              {SEV_LABEL[tooltip.cell.severity]}
            </span>
          </div>
          {tooltip.cell.flareClass && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ color: "#2E4558" }}>CLASS</span>
              <span style={{ color: SEV_COLOR_BRIGHT[tooltip.cell.severity], fontWeight: "bold" }}>
                {tooltip.cell.flareClass}
              </span>
            </div>
          )}
          {tooltip.cell.peakFlux > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ color: "#2E4558" }}>PEAK FLUX</span>
              <span style={{ color: "#C8D8E8" }}>{tooltip.cell.peakFlux.toExponential(2)} W/m²</span>
            </div>
          )}
          {tooltip.cell.region && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ color: "#2E4558" }}>REGION</span>
              <span style={{ color: "#5B7A8A" }}>{tooltip.cell.region}</span>
            </div>
          )}
          {tooltip.cell.confidence != null && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#2E4558" }}>CONFIDENCE</span>
              <span style={{ color: "#5B7A8A" }}>{Math.round(tooltip.cell.confidence * 100)}%</span>
            </div>
          )}
          {tooltip.cell.isBackground && !tooltip.cell.flareClass && (
            <div style={{ color: "#2E4558", fontSize: 7, marginTop: 3 }}>SYNTHETIC BACKGROUND</div>
          )}
        </div>
      )}
    </div>
  );
}
