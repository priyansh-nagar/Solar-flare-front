import { useRef, useMemo, useState, useEffect } from "react";
import type { ActiveRegion } from "./api";

const riskColor: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  severe: "#ef4444",
};

function SunCanvas2D({ regions }: { regions: ActiveRegion[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const rotationRef = useRef(0);
  const [hovered, setHovered] = useState<ActiveRegion | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let running = true;

    function latLonTo2D(lat: number, lon: number, cx: number, cy: number, r: number, rotation: number) {
      const adjustedLon = lon + rotation;
      const lonRad = adjustedLon * (Math.PI / 180);
      const latRad = lat * (Math.PI / 180);
      const x = cx + r * Math.cos(latRad) * Math.sin(lonRad);
      const y = cy - r * Math.sin(latRad);
      const z = Math.cos(latRad) * Math.cos(lonRad);
      return { x, y, visible: z > 0 };
    }

    function draw() {
      if (!canvas) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;
      const r = Math.min(W, H) * 0.38;

      // Deep space background
      ctx.fillStyle = "#000005";
      ctx.fillRect(0, 0, W, H);

      // Stars
      for (let i = 0; i < 80; i++) {
        const sx = ((i * 137.5) % W);
        const sy = ((i * 97.3 + 50) % H);
        const brightness = 0.2 + (i % 5) * 0.08;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${brightness})`;
        ctx.fill();
      }

      // Outer corona glow (large, subtle)
      const outerGlow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.7);
      outerGlow.addColorStop(0, "rgba(255,80,0,0.08)");
      outerGlow.addColorStop(0.5, "rgba(255,40,0,0.04)");
      outerGlow.addColorStop(1, "rgba(255,20,0,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.7, 0, Math.PI * 2);
      ctx.fillStyle = outerGlow;
      ctx.fill();

      // Inner corona
      const innerCorona = ctx.createRadialGradient(cx, cy, r * 0.95, cx, cy, r * 1.18);
      innerCorona.addColorStop(0, "rgba(255,120,0,0.18)");
      innerCorona.addColorStop(1, "rgba(255,60,0,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2);
      ctx.fillStyle = innerCorona;
      ctx.fill();

      // Solar disk base
      const solarGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
      solarGrad.addColorStop(0, "#ffcc44");
      solarGrad.addColorStop(0.2, "#ff9900");
      solarGrad.addColorStop(0.5, "#e85500");
      solarGrad.addColorStop(0.8, "#c03000");
      solarGrad.addColorStop(1, "#7a1800");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = solarGrad;
      ctx.fill();

      // Granulation texture (seeded by rotation for slow scroll illusion)
      const t = Date.now() * 0.0001;
      for (let i = 0; i < 90; i++) {
        const seed = i * 137.508;
        const gx = cx + (Math.sin(seed + t * 0.3) * r * 0.85);
        const gy = cy + (Math.cos(seed * 1.3 + t * 0.2) * r * 0.85);
        const dist = Math.sqrt((gx - cx) ** 2 + (gy - cy) ** 2);
        if (dist > r * 0.93) continue;
        const gr = r * (0.025 + (i % 6) * 0.01);
        const granule = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        if (i % 3 === 0) {
          granule.addColorStop(0, "rgba(12,3,0,0.55)");
          granule.addColorStop(1, "rgba(12,3,0,0)");
        } else {
          granule.addColorStop(0, "rgba(255,190,60,0.22)");
          granule.addColorStop(1, "rgba(255,190,60,0)");
        }
        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.fillStyle = granule;
        ctx.fill();
      }

      // Limb darkening edge
      const limbDark = ctx.createRadialGradient(cx, cy, r * 0.72, cx, cy, r);
      limbDark.addColorStop(0, "rgba(0,0,0,0)");
      limbDark.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = limbDark;
      ctx.fill();

      // Clip to solar disk for region dots
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      regions.forEach((region) => {
        const { x, y, visible } = latLonTo2D(region.lat, region.lon, cx, cy, r * 0.9, rotationRef.current);
        if (!visible) return;
        const dotR = 5 + region.area / 100;
        const color = riskColor[region.flare_risk];
        const glowR = ctx.createRadialGradient(x, y, 0, x, y, dotR * 2.5);
        glowR.addColorStop(0, color + "cc");
        glowR.addColorStop(1, color + "00");
        ctx.beginPath();
        ctx.arc(x, y, dotR * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = glowR;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.font = `bold 9px monospace`;
        ctx.fillStyle = color;
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 4;
        ctx.fillText(region.label, x + dotR + 3, y + 3);
        ctx.shadowBlur = 0;
      });
      ctx.restore();

      rotationRef.current += 0.05;
      if (running) animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [regions]);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: mx, y: my });
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = Math.min(canvas.width, canvas.height) * 0.38;

    let found: ActiveRegion | null = null;
    for (const region of regions) {
      const lonRad = (region.lon + rotationRef.current) * (Math.PI / 180);
      const latRad = region.lat * (Math.PI / 180);
      const x = cx + r * 0.9 * Math.cos(latRad) * Math.sin(lonRad);
      const y = cy - r * 0.9 * Math.sin(latRad);
      const z = Math.cos(latRad) * Math.cos(lonRad);
      if (z <= 0) continue;
      const dotR = 5 + region.area / 100;
      if (Math.hypot(mx - x, my - y) < dotR * 2) { found = region; break; }
    }
    setHovered(found);
  }

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        width={800}
        height={600}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        style={{ cursor: hovered ? "crosshair" : "default" }}
      />
      {hovered && (
        <div
          className="absolute pointer-events-none bg-black/90 border border-white/20 text-white px-2.5 py-2 rounded text-xs font-mono shadow-xl z-20"
          style={{ left: mousePos.x + 16, top: mousePos.y - 10 }}
        >
          <div className="font-bold mb-1" style={{ color: riskColor[hovered.flare_risk] }}>{hovered.label}</div>
          <div className="text-white/60">Area: <span className="text-white/90">{hovered.area} μH</span></div>
          <div className="text-white/60">Risk: <span className="font-bold" style={{ color: riskColor[hovered.flare_risk] }}>{hovered.flare_risk.toUpperCase()}</span></div>
          <div className="text-white/60">Lat: <span className="text-white/90">{hovered.lat > 0 ? "+" : ""}{hovered.lat}°</span></div>
          <div className="text-white/60">Lon: <span className="text-white/90">{hovered.lon > 0 ? "+" : ""}{hovered.lon}°</span></div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex gap-3 text-[10px] font-mono text-white/40">
        {Object.entries(riskColor).map(([risk, color]) => (
          <span key={risk} className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
            {risk.toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

interface Props {
  regions: ActiveRegion[];
}

export function SunVisualization({ regions }: Props) {
  return <SunCanvas2D regions={regions} />;
}
