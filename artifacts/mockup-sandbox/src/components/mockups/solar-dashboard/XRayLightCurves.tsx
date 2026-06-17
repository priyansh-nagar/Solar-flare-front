import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
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
            10<sup>{p.value?.toFixed(1)}</sup> W/m²
          </span>
        </div>
      ))}
    </div>
  );
}

function ChannelChart({
  data, dataKey, color, label, flareEvents = [],
}: {
  data: any[];
  dataKey: string;
  color: string;
  label: string;
  flareEvents?: { time: string; class: string; label: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 4, right: 52, bottom: 0, left: 4 }}>
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
          tickFormatter={formatLog}
          tick={{ fill: "#5B7A8A", fontSize: 9, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={{ stroke: "#1E2D3D" }}
          domain={[-9, -3]}
          ticks={[-9, -8, -7, -6, -5, -4, -3]}
          width={22}
        />
        {GOES_THRESHOLDS.map((t) => (
          <ReferenceLine
            key={t.label}
            y={logScale(t.value)}
            stroke={t.color}
            strokeDasharray="4 4"
            strokeWidth={1}
            strokeOpacity={0.5}
            label={{ value: t.label, position: "right", fill: t.color, fontSize: 8, fontFamily: "monospace" }}
          />
        ))}
        {flareEvents.map((ev) => (
          <ReferenceLine
            key={ev.time}
            x={ev.time}
            stroke="#5B7A8A"
            strokeDasharray="2 4"
            strokeWidth={1}
            label={{ value: ev.label, position: "insideTopLeft", fill: "#5B7A8A", fontSize: 7 }}
          />
        ))}
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
          name={label}
          isAnimationActive={false}
        />
        <Tooltip content={<CustomTooltip />} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function XRayLightCurves({ series, flareEvents = [] }: Props) {
  const [brushRange, setBrushRange] = useState<[number, number]>([
    Math.max(0, series.length - 60),
    series.length - 1,
  ]);

  const processed = series.map((d) => ({
    time: d.time,
    soft: logScale(d.soft),
    hard: logScale(d.hard),
  }));

  const visible = processed.slice(brushRange[0], brushRange[1] + 1);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ flex: 1, minHeight: 0, padding: "6px 10px 0" }}>
        {/* Soft X-ray */}
        <div style={{ fontSize: 8, letterSpacing: "0.15em", color: "#5B7A8A", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 4 }}>
          SoLEXS · Soft X-ray · 1–8 Å (GOES)
        </div>
        <div style={{ height: "calc(50% - 20px)" }}>
          <ChannelChart data={visible} dataKey="soft" color="#4DAAFF" label="Soft X-ray" flareEvents={flareEvents} />
        </div>
        {/* Hard X-ray */}
        <div style={{ fontSize: 8, letterSpacing: "0.15em", color: "#5B7A8A", textTransform: "uppercase", fontFamily: "monospace", margin: "10px 0 4px" }}>
          HEL1OS · Hard X-ray · 0.5–4 Å (GOES)
        </div>
        <div style={{ height: "calc(50% - 20px)" }}>
          <ChannelChart data={visible} dataKey="hard" color="#00D4FF" label="Hard X-ray" flareEvents={flareEvents} />
        </div>
      </div>

      {/* Timeline navigator */}
      <div style={{ flexShrink: 0, padding: "4px 10px 6px", borderTop: "1px solid #1E2D3D" }}>
        <div style={{ fontSize: 8, letterSpacing: "0.15em", color: "#2E4558", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 4 }}>
          Timeline Navigator — Drag to Scroll
        </div>
        <ResponsiveContainer width="100%" height={34}>
          <ComposedChart data={processed} margin={{ left: 4, right: 52 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[-9, -3]} />
            <Area
              type="monotone"
              dataKey="soft"
              stroke="#4DAAFF"
              strokeWidth={1}
              fill="#4DAAFF"
              fillOpacity={0.08}
              dot={false}
              isAnimationActive={false}
            />
            <Brush
              dataKey="time"
              height={28}
              stroke="#1E2D3D"
              fill="#0C1219"
              travellerWidth={5}
              startIndex={brushRange[0]}
              endIndex={brushRange[1]}
              onChange={(e: any) => {
                if (e.startIndex !== undefined && e.endIndex !== undefined) {
                  setBrushRange([e.startIndex, e.endIndex]);
                }
              }}
            >
              <ComposedChart>
                <Area type="monotone" dataKey="soft" stroke="#4DAAFF" strokeWidth={0.5} fill="#4DAAFF" fillOpacity={0.06} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </Brush>
          </ComposedChart>
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
