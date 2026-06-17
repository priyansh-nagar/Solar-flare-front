import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Brush, Legend,
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

const GOES_THRESHOLDS: { value: number; label: string; color: string }[] = [
  { value: 1e-4, label: "X1.0", color: "rgba(239,68,68,0.7)" },
  { value: 1e-5, label: "M1.0", color: "rgba(249,115,22,0.7)" },
  { value: 1e-6, label: "C1.0", color: "rgba(234,179,8,0.7)" },
  { value: 1e-7, label: "B1.0", color: "rgba(56,189,248,0.5)" },
];

function logScale(v: number) {
  if (v <= 0) return -9;
  return Math.log10(v);
}

function formatLog(v: number) {
  const val = Math.pow(10, v);
  if (val < 1e-8) return "< B";
  if (val < 1e-7) return "A";
  if (val < 1e-6) return "B";
  if (val < 1e-5) return "C";
  if (val < 1e-4) return "M";
  return "X";
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const time = label ? (() => { try { return format(new Date(label), "HH:mm:ss") + " UTC"; } catch { return label; } })() : "";
  return (
    <div className="bg-[#060a0e]/96 border border-white/10 rounded px-3 py-2 text-[10px] font-mono shadow-2xl">
      <div className="text-white/35 mb-2">{time}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-6">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-bold" style={{ color: p.color }}>
            {p.value !== undefined ? p.value.toFixed(2) : "—"} (10<sup>{Math.round(p.value)}</sup>)
          </span>
        </div>
      ))}
    </div>
  );
}

function ChannelChart({
  data,
  dataKey,
  color,
  label,
  flareEvents = [],
}: {
  data: any[];
  dataKey: string;
  color: string;
  label: string;
  flareEvents?: { time: string; class: string; label: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 4, right: 48, bottom: 0, left: 8 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="2 5" />
        <XAxis
          dataKey="time"
          tickFormatter={(v) => { try { return format(new Date(v), "HH:mm"); } catch { return v; } }}
          tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 8, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          tickFormatter={formatLog}
          tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 8, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
          domain={[-9, -3]}
          ticks={[-9, -8, -7, -6, -5, -4, -3]}
          width={24}
        />
        {GOES_THRESHOLDS.map((t) => (
          <ReferenceLine
            key={t.label}
            y={logScale(t.value)}
            stroke={t.color}
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{ value: t.label, position: "right", fill: t.color, fontSize: 8, fontFamily: "monospace" }}
          />
        ))}
        {flareEvents.map((ev) => (
          <ReferenceLine
            key={ev.time}
            x={ev.time}
            stroke="rgba(255,255,255,0.3)"
            strokeDasharray="3 3"
            label={{ value: ev.label, position: "insideTopLeft", fill: "rgba(255,255,255,0.5)", fontSize: 7 }}
          />
        ))}
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          fill={color}
          fillOpacity={0.06}
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
  const [brushRange, setBrushRange] = useState<[number, number]>([Math.max(0, series.length - 60), series.length - 1]);

  const processed = series.map((d) => ({
    time: d.time,
    soft: logScale(d.soft),
    hard: logScale(d.hard),
  }));

  const visible = processed.slice(brushRange[0], brushRange[1] + 1);

  return (
    <div className="h-full flex flex-col gap-0 p-0">
      <div className="flex-1 min-h-0 px-3 pt-2">
        <div className="text-[9px] font-mono text-white/30 uppercase tracking-wider mb-1">
          Soft X-ray · 1–8 Å (GOES)
        </div>
        <div style={{ height: "calc(50% - 16px)" }}>
          <ChannelChart data={visible} dataKey="soft" color="#38bdf8" label="Soft X-ray" flareEvents={flareEvents} />
        </div>
        <div className="text-[9px] font-mono text-white/30 uppercase tracking-wider mt-2 mb-1">
          Hard X-ray · 0.5–4 Å (GOES)
        </div>
        <div style={{ height: "calc(50% - 16px)" }}>
          <ChannelChart data={visible} dataKey="hard" color="#c084fc" label="Hard X-ray" flareEvents={flareEvents} />
        </div>
      </div>

      <div className="flex-shrink-0 px-3 pb-2 pt-1 border-t border-white/[0.04]">
        <div className="text-[9px] font-mono text-white/20 uppercase tracking-wider mb-1">Timeline Navigator — drag to scroll</div>
        <ResponsiveContainer width="100%" height={36}>
          <ComposedChart data={processed} margin={{ left: 8, right: 48 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[-9, -3]} />
            <Area type="monotone" dataKey="soft" stroke="#38bdf8" strokeWidth={1} fill="#38bdf8" fillOpacity={0.12} dot={false} isAnimationActive={false} />
            <Brush
              dataKey="time"
              height={28}
              stroke="rgba(255,255,255,0.12)"
              fill="rgba(15,20,30,0.6)"
              travellerWidth={6}
              startIndex={brushRange[0]}
              endIndex={brushRange[1]}
              onChange={(e: any) => {
                if (e.startIndex !== undefined && e.endIndex !== undefined) {
                  setBrushRange([e.startIndex, e.endIndex]);
                }
              }}
            >
              <ComposedChart>
                <Area type="monotone" dataKey="soft" stroke="#38bdf8" strokeWidth={0.5} fill="#38bdf8" fillOpacity={0.08} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </Brush>
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex justify-between text-[8px] font-mono text-white/15 mt-0.5 px-1">
          <span>← SCROLL BACKWARD</span>
          <span>DRAG HANDLES TO ZOOM · DRAG WINDOW TO PAN</span>
          <span>SCROLL FORWARD →</span>
        </div>
      </div>
    </div>
  );
}
