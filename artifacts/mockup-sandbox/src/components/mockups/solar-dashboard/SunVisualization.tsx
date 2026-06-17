import { useRef, useEffect, useState } from "react";
import type { ActiveRegion } from "./api";

const riskColor: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  severe: "#ef4444",
};

const POLARITY_POS = "rgba(80,120,255,0.55)";
const POLARITY_NEG = "rgba(255,60,60,0.55)";

function drawSunspot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string
) {
  const umbra = r * 0.42;
  const penumbra = r;
  const filaR = r * 1.18;

  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2;
    const ax = x + filaR * Math.cos(angle);
    const ay = y + filaR * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(x + penumbra * 0.85 * Math.cos(angle), y + penumbra * 0.85 * Math.sin(angle));
    ctx.lineTo(ax, ay);
    ctx.strokeStyle = "rgba(80,30,0,0.25)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  const penGrad = ctx.createRadialGradient(x, y, umbra, x, y, penumbra);
  penGrad.addColorStop(0, "rgba(40,15,0,0.92)");
  penGrad.addColorStop(0.45, "rgba(80,30,5,0.80)");
  penGrad.addColorStop(0.75, "rgba(140,60,10,0.55)");
  penGrad.addColorStop(1, "rgba(200,90,15,0.0)");
  ctx.beginPath();
  ctx.arc(x, y, penumbra, 0, Math.PI * 2);
  ctx.fillStyle = penGrad;
  ctx.fill();

  const umbraGrad = ctx.createRadialGradient(x - umbra * 0.15, y - umbra * 0.15, 0, x, y, umbra);
  umbraGrad.addColorStop(0, "rgba(5,2,0,0.98)");
  umbraGrad.addColorStop(0.6, "rgba(15,5,0,0.95)");
  umbraGrad.addColorStop(1, "rgba(35,12,0,0.88)");
  ctx.beginPath();
  ctx.arc(x, y, umbra, 0, Math.PI * 2);
  ctx.fillStyle = umbraGrad;
  ctx.fill();

  const shineGrad = ctx.createRadialGradient(x - umbra * 0.25, y - umbra * 0.3, 0, x, y, umbra * 0.6);
  shineGrad.addColorStop(0, "rgba(120,60,10,0.18)");
  shineGrad.addColorStop(1, "rgba(120,60,10,0)");
  ctx.beginPath();
  ctx.arc(x, y, umbra * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = shineGrad;
  ctx.fill();

  const dotR = r * 0.35 + (color === riskColor.severe ? 4 : 0);
  const dotGlow = ctx.createRadialGradient(x, y, 0, x, y, dotR * 3);
  dotGlow.addColorStop(0, color + "cc");
  dotGlow.addColorStop(0.4, color + "55");
  dotGlow.addColorStop(1, color + "00");
  ctx.beginPath();
  ctx.arc(x, y, dotR * 3, 0, Math.PI * 2);
  ctx.fillStyle = dotGlow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, dotR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawFieldLines(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  count = 5
) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    const cpx = mx - dy * (0.3 + t * 0.25);
    const cpy = my + dx * (0.3 + t * 0.25);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpx, cpy, x2, y2);
    ctx.strokeStyle = `rgba(150,180,255,${0.06 + t * 0.05})`;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawPolarityPatch(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  polarity: "pos" | "neg"
) {
  const color = polarity === "pos" ? POLARITY_POS : POLARITY_NEG;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

function drawProminence(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, angle: number, t: number) {
  const baseX = cx + r * Math.cos(angle);
  const baseY = cy + r * Math.sin(angle);
  const wave = Math.sin(t + angle * 3) * 8;
  const h = r * 0.14 + wave;
  const cpx = baseX + h * 1.2 * Math.cos(angle) + wave * Math.cos(angle + 1.5);
  const cpy = baseY + h * 1.2 * Math.sin(angle) + wave * Math.sin(angle + 1.5);
  const tipX = baseX + h * 1.8 * Math.cos(angle);
  const tipY = baseY + h * 1.8 * Math.sin(angle);
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(cpx, cpy, tipX, tipY);
  ctx.strokeStyle = "rgba(255,140,20,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const proGlow = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, h * 0.5);
  proGlow.addColorStop(0, "rgba(255,160,30,0.35)");
  proGlow.addColorStop(1, "rgba(255,100,0,0)");
  ctx.beginPath();
  ctx.arc(tipX, tipY, h * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = proGlow;
  ctx.fill();
}

interface Props {
  regions: ActiveRegion[];
  nowcastAlert: boolean;
}

export function SunVisualization({ regions, nowcastAlert }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const rotRef = useRef(0);
  const [hovered, setHovered] = useState<ActiveRegion | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const regionPosCache = useRef<Map<string, { x: number; y: number; r: number }>>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let running = true;

    function latLonTo2D(lat: number, lon: number, cx: number, cy: number, r: number, rot: number) {
      const adjLon = lon + rot;
      const lonRad = adjLon * (Math.PI / 180);
      const latRad = lat * (Math.PI / 180);
      const x = cx + r * Math.cos(latRad) * Math.sin(lonRad);
      const y = cy - r * Math.sin(latRad);
      const z = Math.cos(latRad) * Math.cos(lonRad);
      return { x, y, visible: z > 0.08 };
    }

    function draw() {
      if (!canvas) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;
      const r = Math.min(W, H) * 0.40;
      const t = Date.now() * 0.001;

      ctx.fillStyle = "#010204";
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < 120; i++) {
        const sx = ((i * 137.508) % W);
        const sy = ((i * 97.32 + 40) % H);
        const br = 0.12 + ((i * 73) % 100) / 100 * 0.35;
        const sr = i % 7 === 0 ? 1.2 : 0.5;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${br})`;
        ctx.fill();
      }

      const outerHalo = ctx.createRadialGradient(cx, cy, r * 0.98, cx, cy, r * 2.2);
      outerHalo.addColorStop(0, "rgba(255,90,0,0.10)");
      outerHalo.addColorStop(0.3, "rgba(255,50,0,0.05)");
      outerHalo.addColorStop(0.7, "rgba(255,20,0,0.02)");
      outerHalo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = outerHalo;
      ctx.fill();

      if (nowcastAlert) {
        const alertPulse = 0.5 + 0.5 * Math.sin(t * 4);
        const alertGlow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.5);
        alertGlow.addColorStop(0, `rgba(255,50,0,${0.18 * alertPulse})`);
        alertGlow.addColorStop(1, "rgba(255,0,0,0)");
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = alertGlow;
        ctx.fill();
      }

      const innerCorona = ctx.createRadialGradient(cx, cy, r * 0.97, cx, cy, r * 1.22);
      innerCorona.addColorStop(0, "rgba(255,150,20,0.22)");
      innerCorona.addColorStop(0.4, "rgba(255,100,5,0.10)");
      innerCorona.addColorStop(1, "rgba(255,60,0,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.22, 0, Math.PI * 2);
      ctx.fillStyle = innerCorona;
      ctx.fill();

      [3, 5, 7, 11].forEach((_n, idx) => {
        const pAngle = (idx * 1.1 + t * 0.07) % (Math.PI * 2);
        drawProminence(ctx, cx, cy, r, pAngle, t);
        drawProminence(ctx, cx, cy, r, pAngle + Math.PI, t);
      });

      const solar = ctx.createRadialGradient(cx - r * 0.18, cy - r * 0.2, 0, cx, cy, r);
      solar.addColorStop(0, "#ffe060");
      solar.addColorStop(0.08, "#ffb830");
      solar.addColorStop(0.22, "#f88000");
      solar.addColorStop(0.45, "#e05500");
      solar.addColorStop(0.7, "#b03000");
      solar.addColorStop(0.88, "#7a1800");
      solar.addColorStop(1, "#3d0800");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = solar;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      for (let i = 0; i < 160; i++) {
        const seed = i * 137.508;
        const oscillate = Math.sin(seed * 0.1 + t * 0.25) * r * 0.04;
        const gx = cx + (Math.sin(seed + t * 0.12) * r * 0.82) + oscillate;
        const gy = cy + (Math.cos(seed * 1.31 + t * 0.08) * r * 0.82);
        const dist = Math.hypot(gx - cx, gy - cy);
        if (dist > r * 0.96) continue;
        const cellR = r * (0.028 + ((seed * 7) % 17) / 17 * 0.022);
        const bright = i % 4 === 0;
        const dark = i % 5 === 0;
        if (dark) {
          const dg = ctx.createRadialGradient(gx, gy, 0, gx, gy, cellR);
          dg.addColorStop(0, "rgba(10,3,0,0.62)");
          dg.addColorStop(0.5, "rgba(10,3,0,0.30)");
          dg.addColorStop(1, "rgba(10,3,0,0)");
          ctx.beginPath();
          ctx.arc(gx, gy, cellR, 0, Math.PI * 2);
          ctx.fillStyle = dg;
          ctx.fill();
        } else if (bright) {
          const bg = ctx.createRadialGradient(gx, gy, 0, gx, gy, cellR);
          bg.addColorStop(0, "rgba(255,220,80,0.28)");
          bg.addColorStop(1, "rgba(255,200,60,0)");
          ctx.beginPath();
          ctx.arc(gx, gy, cellR, 0, Math.PI * 2);
          ctx.fillStyle = bg;
          ctx.fill();
        }
      }

      const limbDark = ctx.createRadialGradient(cx, cy, r * 0.65, cx, cy, r);
      limbDark.addColorStop(0, "rgba(0,0,0,0)");
      limbDark.addColorStop(0.6, "rgba(0,0,0,0.08)");
      limbDark.addColorStop(1, "rgba(0,0,0,0.68)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = limbDark;
      ctx.fill();

      const newCache = new Map<string, { x: number; y: number; r: number }>();
      const visibleRegions = regions
        .map((region) => {
          const pos = latLonTo2D(region.lat, region.lon, cx, cy, r * 0.88, rotRef.current);
          return { region, ...pos };
        })
        .filter((d) => d.visible);

      for (let i = 0; i < visibleRegions.length; i++) {
        for (let j = i + 1; j < visibleRegions.length; j++) {
          const a = visibleRegions[i];
          const b = visibleRegions[j];
          drawFieldLines(ctx, a.x, a.y, b.x, b.y, 4);
        }
      }

      visibleRegions.forEach(({ region, x, y }) => {
        const polarity = regions.indexOf(region) % 2 === 0 ? "pos" : "neg";
        const patchR = region.area / 8 + 18;
        drawPolarityPatch(ctx, x, y, patchR * 1.6, polarity);
        const oppositeX = x + (Math.sin(rotRef.current * 0.1) * patchR * 1.2);
        const oppositeY = y + (Math.cos(rotRef.current * 0.1) * patchR * 0.8);
        drawPolarityPatch(ctx, oppositeX, oppositeY, patchR, polarity === "pos" ? "neg" : "pos");
      });

      visibleRegions.forEach(({ region, x, y }) => {
        const spotR = region.area / 18 + 8;
        drawSunspot(ctx, x, y, spotR, riskColor[region.flare_risk]);
        newCache.set(region.id, { x, y, r: spotR });

        ctx.font = `bold ${Math.max(8, spotR * 0.8)}px monospace`;
        ctx.fillStyle = riskColor[region.flare_risk];
        ctx.shadowColor = "rgba(0,0,0,0.95)";
        ctx.shadowBlur = 6;
        ctx.fillText(region.label, x + spotR * 1.3, y + 3);
        ctx.shadowBlur = 0;
      });

      ctx.restore();

      const specHighlight = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.35, 0, cx - r * 0.38, cy - r * 0.35, r * 0.5);
      specHighlight.addColorStop(0, "rgba(255,255,220,0.06)");
      specHighlight.addColorStop(1, "rgba(255,255,220,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = specHighlight;
      ctx.fill();

      regionPosCache.current = newCache;
      rotRef.current += 0.045;
      if (running) animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [regions, nowcastAlert]);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    let found: ActiveRegion | null = null;
    for (const [id, pos] of regionPosCache.current) {
      if (Math.hypot(mx - pos.x, my - pos.y) < pos.r * 2.5) {
        found = regions.find((r) => r.id === id) ?? null;
        break;
      }
    }
    setHovered(found);
  }

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        width={640}
        height={580}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        style={{ cursor: hovered ? "crosshair" : "default" }}
      />
      {hovered && (
        <div
          className="absolute pointer-events-none z-20 bg-[#080c10]/95 border border-white/15 rounded px-2.5 py-2 text-[10px] font-mono shadow-2xl"
          style={{ left: mousePos.x + 14, top: mousePos.y - 10 }}
        >
          <div className="font-bold text-sm mb-1.5" style={{ color: riskColor[hovered.flare_risk] }}>{hovered.label}</div>
          <div className="space-y-0.5 text-white/50">
            <div>Area <span className="text-white/80 ml-2">{hovered.area} μH</span></div>
            <div>Lat  <span className="text-white/80 ml-2">{hovered.lat > 0 ? "+" : ""}{hovered.lat}°</span></div>
            <div>Lon  <span className="text-white/80 ml-2">{hovered.lon > 0 ? "+" : ""}{hovered.lon}°</span></div>
            <div>Risk <span className="font-bold ml-2" style={{ color: riskColor[hovered.flare_risk] }}>{hovered.flare_risk.toUpperCase()}</span></div>
          </div>
        </div>
      )}
      <div className="absolute bottom-1.5 left-2 flex gap-3 text-[9px] font-mono">
        {Object.entries(riskColor).map(([risk, color]) => (
          <span key={risk} className="flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}` }} />
            {risk.toUpperCase()}
          </span>
        ))}
      </div>
      <div className="absolute top-1.5 right-2 flex gap-2 text-[9px] font-mono text-white/25">
        <span className="flex items-center gap-1"><span className="w-2 h-1 rounded" style={{ backgroundColor: POLARITY_POS }} />+POLARITY</span>
        <span className="flex items-center gap-1"><span className="w-2 h-1 rounded" style={{ backgroundColor: POLARITY_NEG }} />−POLARITY</span>
      </div>
    </div>
  );
}
