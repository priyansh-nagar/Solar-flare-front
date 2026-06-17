import {
  ComposedChart, AreaChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Brush, Area,
} from "recharts";
import { format } from "date-fns";
import { useState } from "react";

export interface XRayPoint {
  time: string;
  soft: number;
  hard: number;
  label?: string;
}

interface Props {
  series: XRayPoint[];
  flareEvents?: { time: string; class: string; label: string }[];
  probM30?: number;
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

export function XRayLightCurves({ series, flareEvents = [], probM30 = 0 }: Props) {
  const [brushRange, setBrushRange] = useState<[number, number]>([
    Math.max(0, series.length - 60),
    series.length - 1,
  ]);

  const processed = series.map((d) => ({
    time: d.time,
    soft: logScale(d.soft),
    hard: logScale(d.hard),
    prob: probM30 * 100,
  }));

  const visible = processed.slice(brushRange[0], brushRange[1] + 1);

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
              interval="preserveStartEnd"
              minTickGap={50}
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
        <ResponsiveContainer width="100%" height={52}>
          <AreaChart data={processed} margin={{ top: 2, right: 48, bottom: 0, left: 4 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[-9, -3]} />
            <Area
              type="monotone"
              dataKey="soft"
              stroke="#4DAAFF"
              strokeWidth={1}
              fill="#4DAAFF"
              fillOpacity={0.12}
              dot={false}
              isAnimationActive={false}
            />
            <Brush
              dataKey="time"
              height={36}
              y={8}
              stroke="#2A4158"
              fill="#0C1219"
              fillOpacity={0.85}
              travellerWidth={6}
              startIndex={brushRange[0]}
              endIndex={brushRange[1]}
              onChange={(e: any) => {
                if (e.startIndex !== undefined && e.endIndex !== undefined) {
                  setBrushRange([e.startIndex, e.endIndex]);
                }
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, fontFamily: "monospace", color: "#2E4558", marginTop: 2, padding: "0 4px" }}>
          <span>← SCROLL BACKWARD</span>
          <span>DRAG HANDLES TO ZOOM · DRAG WINDOW TO PAN</span>
          <span>SCROLL FORWARD →</span>
        </div>
      </div>
    </div>
  );
}
