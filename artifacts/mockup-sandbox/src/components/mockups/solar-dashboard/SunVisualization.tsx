import { useRef, useEffect, useState } from "react";
import type { ActiveRegion } from "./api";

const RISK_COLOR: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  severe: "#ef4444",
};

interface Props {
  regions: ActiveRegion[];
  nowcastAlert: boolean;
}

export function SunVisualization({ regions, nowcastAlert }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const rotRef = useRef(0);
  const dotCacheRef = useRef<Map<string, { cx: number; cy: number; r: number }>>(new Map());
  const [hovered, setHovered] = useState<ActiveRegion | null>(null);
  const [tip, setTip] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let alive = true;

    /* ── pre-bake a granulation offscreen texture ───────────────────────── */
    const gran = document.createElement("canvas");
    gran.width = 512;
    gran.height = 512;
    const gc = gran.getContext("2d")!;
    const GCX = 256, GCY = 256, GR = 240;
    for (let i = 0; i < 260; i++) {
      const seed = i * 137.508;
      const gx = GCX + Math.sin(seed) * GR * 0.94 * Math.random();
      const gy = GCY + Math.cos(seed * 1.31) * GR * 0.94 * Math.random();
      const gr2 = 6 + Math.random() * 14;
      const dark = i % 5 === 0;
      const bright = i % 7 === 0;
      const alpha = dark ? 0.30 : bright ? 0.18 : 0.0;
      if (alpha === 0) continue;
      const gg = gc.createRadialGradient(gx, gy, 0, gx, gy, gr2);
      gg.addColorStop(0, dark ? `rgba(10,3,0,${alpha})` : `rgba(255,210,60,${alpha})`);
      gg.addColorStop(1, "rgba(0,0,0,0)");
      gc.beginPath();
      gc.arc(gx, gy, gr2, 0, Math.PI * 2);
      gc.fillStyle = gg;
      gc.fill();
    }

    function drawFrame() {
      if (!canvas) return;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.41;
      const t = Date.now() * 0.001;

      /* stars */
      for (let i = 0; i < 90; i++) {
        const sx = (i * 137.508) % W;
        const sy = (i * 97.32 + 30) % H;
        const a = 0.08 + (i % 10) / 10 * 0.28;
        ctx.beginPath();
        ctx.arc(sx, sy, i % 9 === 0 ? 1.0 : 0.45, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fill();
      }

      /* outer corona halo */
      const halo = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 2.0);
      halo.addColorStop(0, "rgba(255,100,10,0.09)");
      halo.addColorStop(0.4, "rgba(255,60,0,0.04)");
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(cx, cy, R * 2.0, 0, Math.PI * 2);
      ctx.fillStyle = halo; ctx.fill();

      /* alert pulse */
      if (nowcastAlert) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 5);
        const ap = ctx.createRadialGradient(cx, cy, R * 0.88, cx, cy, R * 1.55);
        ap.addColorStop(0, `rgba(255,40,0,${0.20 * pulse})`);
        ap.addColorStop(1, "rgba(255,0,0,0)");
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.55, 0, Math.PI * 2);
        ctx.fillStyle = ap; ctx.fill();
      }

      /* inner corona ring */
      const corona = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.18);
      corona.addColorStop(0, "rgba(255,160,20,0.24)");
      corona.addColorStop(0.5, "rgba(255,110,5,0.10)");
      corona.addColorStop(1, "rgba(255,60,0,0)");
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.18, 0, Math.PI * 2);
      ctx.fillStyle = corona; ctx.fill();

      /* solar disk base gradient */
      const disk = ctx.createRadialGradient(cx - R * 0.22, cy - R * 0.22, 0, cx, cy, R);
      disk.addColorStop(0.00, "#fff5c0");
      disk.addColorStop(0.05, "#ffdd50");
      disk.addColorStop(0.18, "#ffaa00");
      disk.addColorStop(0.40, "#e86000");
      disk.addColorStop(0.68, "#b03500");
      disk.addColorStop(0.88, "#6e1800");
      disk.addColorStop(1.00, "#2a0600");
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = disk; ctx.fill();

      /* granulation texture overlay (rotated slowly to fake surface motion) */
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.97, 0, Math.PI * 2); ctx.clip();
      ctx.translate(cx, cy);
      ctx.rotate(rotRef.current * 0.008);
      ctx.drawImage(gran, -R, -R, R * 2, R * 2);
      ctx.restore();

      /* limb darkening overlay */
      const limb = ctx.createRadialGradient(cx, cy, R * 0.62, cx, cy, R);
      limb.addColorStop(0, "rgba(0,0,0,0)");
      limb.addColorStop(0.7, "rgba(0,0,0,0.06)");
      limb.addColorStop(1, "rgba(0,0,0,0.72)");
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = limb; ctx.fill();

      /* ── sunspots + active region dots ────────────────────────────────── */
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();

      const newCache = new Map<string, { cx: number; cy: number; r: number }>();

      regions.forEach((region) => {
        const adjLon = region.lon + rotRef.current;
        const lonRad = adjLon * (Math.PI / 180);
        const latRad = region.lat * (Math.PI / 180);
        const z = Math.cos(latRad) * Math.cos(lonRad);
        if (z < 0.12) return; // behind limb

        const sx = cx + R * 0.90 * Math.cos(latRad) * Math.sin(lonRad);
        const sy = cy - R * 0.90 * Math.sin(latRad);

        /* proximity fade near limb */
        const limbFade = Math.min(1, (z - 0.12) / 0.25);
        const spotR = Math.max(5, region.area / 20 + 6) * limbFade;

        /* penumbra */
        const pen = ctx.createRadialGradient(sx, sy, spotR * 0.38, sx, sy, spotR * 1.1);
        pen.addColorStop(0, "rgba(8,2,0,0.94)");
        pen.addColorStop(0.5, "rgba(30,10,0,0.75)");
        pen.addColorStop(0.8, "rgba(90,35,5,0.40)");
        pen.addColorStop(1, "rgba(180,70,10,0)");
        ctx.beginPath(); ctx.arc(sx, sy, spotR * 1.1, 0, Math.PI * 2);
        ctx.fillStyle = pen; ctx.fill();

        /* umbra */
        const umb = ctx.createRadialGradient(sx - spotR * 0.1, sy - spotR * 0.12, 0, sx, sy, spotR * 0.38);
        umb.addColorStop(0, "rgba(4,1,0,0.98)");
        umb.addColorStop(1, "rgba(10,3,0,0.92)");
        ctx.beginPath(); ctx.arc(sx, sy, spotR * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = umb; ctx.fill();

        /* risk glow dot */
        const col = RISK_COLOR[region.flare_risk];
        const dotR = Math.max(3, spotR * 0.28);
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, dotR * 3);
        glow.addColorStop(0, col + "cc");
        glow.addColorStop(0.5, col + "44");
        glow.addColorStop(1, col + "00");
        ctx.beginPath(); ctx.arc(sx, sy, dotR * 3, 0, Math.PI * 2);
        ctx.fillStyle = glow; ctx.fill();
        ctx.beginPath(); ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.shadowColor = col; ctx.shadowBlur = 6;
        ctx.fill(); ctx.shadowBlur = 0;

        /* label */
        ctx.font = `bold ${Math.max(8, spotR * 0.75)}px monospace`;
        ctx.fillStyle = col;
        ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = 5;
        ctx.fillText(region.label, sx + dotR * 1.6, sy + 3);
        ctx.shadowBlur = 0;

        newCache.set(region.id, { cx: sx, cy: sy, r: spotR * 1.2 });
      });

      ctx.restore();

      /* soft specular highlight */
      const spec = ctx.createRadialGradient(cx - R * 0.32, cy - R * 0.30, 0, cx - R * 0.32, cy - R * 0.30, R * 0.55);
      spec.addColorStop(0, "rgba(255,255,220,0.07)");
      spec.addColorStop(1, "rgba(255,255,220,0)");
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = spec; ctx.fill();

      dotCacheRef.current = newCache;
      rotRef.current += 0.04;
      if (alive) rafRef.current = requestAnimationFrame(drawFrame);
    }

    drawFrame();
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, [regions, nowcastAlert]);

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (c.width / rect.width);
    const sy = (e.clientY - rect.top) * (c.height / rect.height);
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    let hit: ActiveRegion | null = null;
    for (const [id, d] of dotCacheRef.current) {
      if (Math.hypot(sx - d.cx, sy - d.cy) < d.r) {
        hit = regions.find((r) => r.id === id) ?? null;
        break;
      }
    }
    setHovered(hit);
  }

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        width={600}
        height={560}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHovered(null)}
        style={{ cursor: hovered ? "crosshair" : "default" }}
      />

      {/* hover tooltip */}
      {hovered && (
        <div
          className="absolute pointer-events-none z-20 rounded border text-[10px] font-mono shadow-2xl px-2.5 py-2"
          style={{
            left: tip.x + 14, top: tip.y - 8,
            backgroundColor: "rgba(6,10,16,0.96)",
            borderColor: "rgba(255,255,255,0.12)",
          }}
        >
          <div className="font-bold mb-1" style={{ color: RISK_COLOR[hovered.flare_risk] }}>
            {hovered.label}
          </div>
          <div className="space-y-0.5 text-white/45">
            <div>Area <span className="text-white/75 ml-2">{hovered.area} μH</span></div>
            <div>Lat  <span className="text-white/75 ml-2">{hovered.lat > 0 ? "N" : "S"}{Math.abs(hovered.lat)}°</span></div>
            <div>Lon  <span className="text-white/75 ml-2">{hovered.lon > 0 ? "E" : "W"}{Math.abs(hovered.lon)}°</span></div>
            <div>Risk <span className="font-bold ml-2" style={{ color: RISK_COLOR[hovered.flare_risk] }}>
              {hovered.flare_risk.toUpperCase()}
            </span></div>
          </div>
        </div>
      )}

      {/* legend */}
      <div className="absolute bottom-1.5 left-2 flex gap-3">
        {Object.entries(RISK_COLOR).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1 text-[8px] font-mono" style={{ color: "rgba(255,255,255,0.32)" }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 4px ${c}` }} />
            {k.toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
