import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Area,
} from "recharts";
import { format } from "date-fns";
import { useState, useRef, useEffect } from "react";

export interface XRayPoint {
  time: string;
  soft: number;
  hard: number;
  prob?: number;
}

interface Props {
  series: XRayPoint[];
  flareEvents?: { time: string; class: string; label: string }[];
  probM30?: number;
  replayActive?: boolean;
  replayProgress?: number;
}

const GOES_THRESHOLDS = [
  { value: 1e-4, label: "X1.0", color: "#FF3B3B" },
  { value: 1e-5, label: "M1.0", color: "#FF8C00" },
  { value: 1e-6, label: "C1.0", color: "#FFB800" },
  { value: 1e-7, label: "B1.0", color: "#4DAAFF" },
];

function logScale(v: number) {
  if (v <= 0) return -9;
  return Math.log10(v);
}

function formatLog(v: number) {
  const m: Record<number, string> = { "-9": "<B", "-8": "A", "-7": "B", "-6": "C", "-5": "M", "-4": "X", "-3": ">X" };
  return m[v] ?? v.toString();
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const time = label
    ? (() => { try { return format(new Date(label), "HH:mm:ss") + " UTC"; } catch { return label; } })()
    : "";
  return (
    <div style={{ background: "#0E1620", border: "1px solid #1E2D3D", borderRadius: 2, padding: "8px 12px", fontSize: 9, fontFamily: "monospace" }}>
      <div style={{ color: "#2E4558", marginBottom: 6 }}>{time}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 24, marginBottom: 2 }}>
          <span style={{ color: "#5B7A8A" }}>{p.name}</span>
          <span style={{ color: p.color, fontWeight: "bold" }}>
            {p.dataKey === "prob"
              ? `${p.value?.toFixed(1)}%`
              : `10^${p.value?.toFixed(1)} W/m²`
            }
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Custom drag navigator ───────────────────────────────────────────────── */
function NavigatorMinimap({
  data,
  range,
  onChange,
  replayActive,
  replayProgress,
}: {
  data: { soft: number }[];
  range: [number, number];
  onChange: (r: [number, number]) => void;
  replayActive?: boolean;
  replayProgress?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<null | {
    mode: "pan" | "L" | "R";
    x0: number;
    r0: [number, number];
  }>(null);

  const n = data.length;
  const H = 38;

  const pctOf = (i: number) => (i / Math.max(n - 1, 1)) * 100;
  const leftPct  = pctOf(range[0]);
  const rightPct = pctOf(range[1]);
  const winPct   = rightPct - leftPct;

  /* ── build SVG polyline ── */
  const vals = data.map((d) => d.soft);
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const pad = 2;
  const normY = (v: number) =>
    mx === mn ? H / 2 : pad + ((1 - (v - mn) / (mx - mn)) * (H - pad * 2));

  const points = data
    .map((d, i) => `${pctOf(i).toFixed(2)},${normY(d.soft).toFixed(2)}`)
    .join(" ");

  /* replay cursor pct inside minimap */
  const replayCursorPct = replayActive && replayProgress != null
    ? `${replayProgress.toFixed(1)}`
    : null;

  /* ── drag logic ── */
  const startDrag = (e: React.MouseEvent, mode: "pan" | "L" | "R") => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mode, x0: e.clientX, r0: [range[0], range[1]] };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const { mode, x0, r0 } = dragRef.current;
      const w = containerRef.current?.offsetWidth ?? 1;
      const dIdx = Math.round(((ev.clientX - x0) / w) * (n - 1));
      const ws = r0[1] - r0[0];
      let nr: [number, number];
      if (mode === "pan") {
        const s = Math.max(0, Math.min(n - 1 - ws, r0[0] + dIdx));
        nr = [s, s + ws];
      } else if (mode === "L") {
        const s = Math.max(0, Math.min(r0[1] - 5, r0[0] + dIdx));
        nr = [s, r0[1]];
      } else {
        const end = Math.min(n - 1, Math.max(r0[0] + 5, r0[1] + dIdx));
        nr = [r0[0], end];
      }
      onChange(nr);
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: H, userSelect: "none", overflow: "hidden" }}
    >
      {/* SVG background line */}
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 100 ${H}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, display: "block" }}
      >
        <rect width="100" height={H} fill="#090E14" />
        {n > 1 && (
          <polyline
            points={points}
            fill="none"
            stroke="#1E3A5A"
            strokeWidth="0.6"
          />
        )}
        {n > 1 && (
          <polyline
            points={`0,${H} ${points} 100,${H}`}
            fill="#4DAAFF"
            fillOpacity="0.06"
            stroke="none"
          />
        )}
        {/* dim masks outside window */}
        <rect x={0} y={0} width={leftPct} height={H} fill="rgba(0,0,0,0.55)" />
        <rect x={rightPct} y={0} width={100 - rightPct} height={H} fill="rgba(0,0,0,0.55)" />
        {/* window border */}
        <rect
          x={leftPct + 0.3}
          y={0.5}
          width={Math.max(0, winPct - 0.6)}
          height={H - 1}
          fill="none"
          stroke="#2A4158"
          strokeWidth="0.8"
        />
        {/* replay cursor */}
        {replayCursorPct != null && (
          <line
            x1={replayCursorPct}
            y1={0}
            x2={replayCursorPct}
            y2={H}
            stroke="#FFB800"
            strokeWidth="1"
            strokeOpacity="0.9"
          />
        )}
      </svg>

      {/* Invisible overlay for pan drag (window body) */}
      <div
        onMouseDown={(e) => startDrag(e, "pan")}
        style={{
          position: "absolute",
          left: `${leftPct}%`,
          width: `${winPct}%`,
          top: 0,
          height: "100%",
          cursor: "grab",
        }}
      />

      {/* Left resize handle */}
      <div
        onMouseDown={(e) => startDrag(e, "L")}
        style={{
          position: "absolute",
          left: `${leftPct}%`,
          top: 0,
          width: 8,
          height: "100%",
          cursor: "w-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        <div style={{ width: 2, height: 12, background: "#4DAAFF", opacity: 0.7, borderRadius: 1 }} />
      </div>

      {/* Right resize handle */}
      <div
        onMouseDown={(e) => startDrag(e, "R")}
        style={{
          position: "absolute",
          left: `${rightPct}%`,
          transform: "translateX(-100%)",
          top: 0,
          width: 8,
          height: "100%",
          cursor: "e-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        <div style={{ width: 2, height: 12, background: "#4DAAFF", opacity: 0.7, borderRadius: 1 }} />
      </div>
    </div>
  );
}

/* ── main component ──────────────────────────────────────────────────────── */
export function XRayLightCurves({ series, flareEvents = [], probM30 = 0, replayActive = false, replayProgress = 0 }: Props) {
  const WINDOW = 60;

  const [brushRange, setBrushRange] = useState<[number, number]>(() => {
    const end = Math.max(0, series.length - 1);
    return [Math.max(0, end - WINDOW), end];
  });

  // Auto-advance the window when new points arrive.
  // Handles three cases:
  //   1. nearLive — user is at the tail, advance with new data
  //   2. bigJump — large batch of data (seed / replay start), snap to tail
  //   3. seriesShrunk — series became shorter (source switch: HTTP→WS or replay clear), snap to tail
  useEffect(() => {
    if (series.length === 0) {
      setBrushRange([0, 0]);
      return;
    }
    const end = series.length - 1;
    setBrushRange((prev) => {
      const seriesShrunk = prev[1] > end + 3;           // series got shorter → new source
      const nearLive     = prev[1] >= end - 5;          // at the live edge
      const bigJump      = (end - prev[1]) > WINDOW;    // large batch arrived

      if (!nearLive && !bigJump && !seriesShrunk) return prev; // user panned back — leave alone

      const winSize = (bigJump || seriesShrunk) ? WINDOW : (prev[1] - prev[0]);
      return [Math.max(0, end - winSize), end];
    });
  }, [series.length]);

  const processed = series.map((d) => ({
    time: d.time,
    soft: logScale(d.soft),
    hard: logScale(d.hard),
    prob: d.prob !== undefined ? d.prob * 100 : (probM30 ?? 0) * 100,
  }));

  // Guard: clamp brush range to valid indices
  const safeEnd   = Math.max(0, series.length - 1);
  const safeStart = Math.min(brushRange[0], safeEnd);
  const safeRight = Math.min(brushRange[1], safeEnd);
  const visible   = processed.slice(safeStart, safeRight + 1);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Legend row */}
      <div style={{ flexShrink: 0, display: "flex", gap: 18, fontSize: 8, fontFamily: "monospace", padding: "5px 14px 3px", borderBottom: "1px solid #1E2D3D" }}>
        {[
          { color: "#4DAAFF", label: "SoLEXS 1-8Å" },
          { color: "#00D4FF", label: "HEL1OS 0.5-4Å" },
          { color: "#FF3B3B", label: "P(M+ 30min)" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, background: color, flexShrink: 0 }} />
            <span style={{ color: "#5B7A8A", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
          </div>
        ))}
        {replayActive && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 2, background: "#FFB800" }} />
            <span style={{ color: "#FFB800", letterSpacing: "0.1em" }}>REPLAY CURSOR</span>
          </div>
        )}
      </div>

      {/* Merged chart */}
      <div style={{ flex: 1, minHeight: 0, padding: "4px 10px 0" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={visible} margin={{ top: 4, right: 48, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="#1E2D3D" strokeDasharray="3 6" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={(v) => { try { return format(new Date(v), "HH:mm"); } catch { return v; } }}
              tick={{ fill: "#5B7A8A", fontSize: 9, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#1E2D3D" }}
              ticks={(() => {
                if (visible.length < 2) return [];
                const count = 6;
                const raw = Array.from({ length: count }, (_, i) =>
                  visible[Math.round(i * (visible.length - 1) / (count - 1))]?.time
                ).filter(Boolean) as string[];
                // Deduplicate: small visible windows (< count points) cause the same
                // index to be selected multiple times → duplicate timestamp strings →
                // Recharts key collision → corrupted/straight line rendering.
                return [...new Set(raw)];
              })()}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={formatLog}
              tick={{ fill: "#5B7A8A", fontSize: 9, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#1E2D3D" }}
              domain={[-9, -3]}
              ticks={[-9, -8, -7, -6, -5, -4, -3]}
              width={22}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: "#5B7A8A", fontSize: 9, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#1E2D3D" }}
              width={36}
            />
            {GOES_THRESHOLDS.map((t) => (
              <ReferenceLine
                key={t.label}
                yAxisId="left"
                y={logScale(t.value)}
                stroke={t.color}
                strokeDasharray="4 4"
                strokeWidth={1}
                strokeOpacity={0.5}
                label={{ value: t.label, position: "insideTopRight", fill: t.color, fontSize: 8, fontFamily: "monospace" }}
              />
            ))}
            <ReferenceLine
              yAxisId="right"
              y={78.2}
              stroke="#FF3B3B"
              strokeDasharray="6 3"
              strokeWidth={1}
              strokeOpacity={0.85}
              label={{ value: "FAR THRESHOLD", position: "insideTopLeft", fill: "#FF3B3B", fontSize: 7, fontFamily: "monospace" }}
            />
            {flareEvents.map((ev) => (
              <ReferenceLine
                key={ev.time}
                yAxisId="left"
                x={ev.time}
                stroke="#5B7A8A"
                strokeDasharray="2 4"
                strokeWidth={1}
                label={{ value: ev.label, position: "insideTopLeft", fill: "#5B7A8A", fontSize: 7 }}
              />
            ))}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="soft"
              stroke="#4DAAFF"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "#4DAAFF", strokeWidth: 0 }}
              name="SoLEXS 1-8Å"
              isAnimationActive={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="hard"
              stroke="#00D4FF"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "#00D4FF", strokeWidth: 0 }}
              name="HEL1OS 0.5-4Å"
              isAnimationActive={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="prob"
              stroke="#FF3B3B"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "#FF3B3B", strokeWidth: 0 }}
              name="P(M+ 30min)"
              isAnimationActive={false}
            />
            <Tooltip content={<CustomTooltip />} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Timeline navigator */}
      <div style={{ flexShrink: 0, padding: "4px 10px 6px", borderTop: "1px solid #1E2D3D" }}>
        <div style={{ fontSize: 8, letterSpacing: "0.15em", color: "#2E4558", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 4 }}>
          Timeline Navigator — Drag to Scroll
        </div>
        <NavigatorMinimap
          data={processed}
          range={[safeStart, safeRight]}
          onChange={setBrushRange}
          replayActive={replayActive}
          replayProgress={replayProgress}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, fontFamily: "monospace", color: "#2E4558", marginTop: 3, padding: "0 2px" }}>
          <span>← SCROLL BACKWARD</span>
          <span>DRAG HANDLES TO ZOOM · DRAG WINDOW TO PAN</span>
          <span>SCROLL FORWARD →</span>
        </div>
      </div>
    </div>
  );
}
