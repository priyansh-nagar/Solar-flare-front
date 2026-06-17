import { useRef, useEffect, useState } from "react";
import type { ActiveRegion } from "./api";

const RISK_COLOR: Record<string, string> = {
  low:      "#00FF88",
  moderate: "#FFB800",
  high:     "#FF8C00",
  severe:   "#FF3B3B",
};

interface Props {
  regions: ActiveRegion[];
  nowcastAlert: boolean;
}

export function SunVisualization({ regions, nowcastAlert }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef(0);
  const rotRef    = useRef(0);
  const boxCacheRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());
  const [hovered, setHovered]   = useState<ActiveRegion | null>(null);
  const [tip, setTip]           = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let alive = true;

    /* pre-bake granulation offscreen */
    const gran = document.createElement("canvas");
    gran.width = 512; gran.height = 512;
    const gc = gran.getContext("2d")!;
    const GCX = 256, GCY = 256, GR = 240;
    for (let i = 0; i < 200; i++) {
      const seed = i * 137.508;
      const gx   = GCX + Math.sin(seed) * GR * 0.92 * Math.random();
      const gy   = GCY + Math.cos(seed * 1.31) * GR * 0.92 * Math.random();
      const gr2  = 7 + Math.random() * 14;
      const dark = i % 6 === 0;
      if (!dark && i % 9 !== 0) continue;
      const alpha = dark ? 0.22 : 0.12;
      const gg = gc.createRadialGradient(gx, gy, 0, gx, gy, gr2);
      gg.addColorStop(0, dark ? `rgba(8,2,0,${alpha})` : `rgba(255,205,50,${alpha})`);
      gg.addColorStop(1, "rgba(0,0,0,0)");
      gc.beginPath(); gc.arc(gx, gy, gr2, 0, Math.PI * 2);
      gc.fillStyle = gg; gc.fill();
    }

    function drawFrame() {
      if (!canvas) return;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const R  = Math.min(W, H) * 0.41;

      /* sparse star field */
      for (let i = 0; i < 70; i++) {
        const sx = (i * 137.508) % W;
        const sy = (i * 91.32 + 20) % H;
        const a  = 0.04 + (i % 11) / 11 * 0.15;
        ctx.beginPath();
        ctx.arc(sx, sy, i % 11 === 0 ? 0.8 : 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,216,232,${a})`;
        ctx.fill();
      }

      /* ── 3 concentric corona rings (no glow, instrument style) ────── */
      const ringColors = ["rgba(255,184,0,0.07)", "rgba(255,184,0,0.04)", "rgba(255,184,0,0.02)"];
      [1.08, 1.16, 1.26].forEach((mult, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * mult, 0, Math.PI * 2);
        ctx.strokeStyle = ringColors[i];
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      /* alert ring (data-driven only, no pulse animation) */
      if (nowcastAlert) {
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,59,59,0.45)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      /* ── solar disk base ──────────────────────────────────────────── */
      const disk = ctx.createRadialGradient(cx - R * 0.18, cy - R * 0.18, 0, cx, cy, R);
      disk.addColorStop(0.00, "#fff8d0");
      disk.addColorStop(0.04, "#ffe060");
      disk.addColorStop(0.15, "#ffaa00");
      disk.addColorStop(0.38, "#e06000");
      disk.addColorStop(0.65, "#a83200");
      disk.addColorStop(0.88, "#601400");
      disk.addColorStop(1.00, "#200500");
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = disk; ctx.fill();

      /* granulation layer */
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.97, 0, Math.PI * 2); ctx.clip();
      ctx.translate(cx, cy);
      ctx.rotate(rotRef.current * 0.006);
      ctx.drawImage(gran, -R, -R, R * 2, R * 2);
      ctx.restore();

      /* limb darkening */
      const limb = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
      limb.addColorStop(0, "rgba(0,0,0,0)");
      limb.addColorStop(0.65, "rgba(0,0,0,0.05)");
      limb.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = limb; ctx.fill();

      /* ── sunspots + active region markers ─────────────────────────── */
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();

      const newBoxes = new Map<string, { x: number; y: number; w: number; h: number }>();

      regions.forEach((region) => {
        const adjLon = region.lon + rotRef.current;
        const lonRad = adjLon * (Math.PI / 180);
        const latRad = region.lat * (Math.PI / 180);
        const z = Math.cos(latRad) * Math.cos(lonRad);
        if (z < 0.12) return;

        const limbFade = Math.min(1, (z - 0.12) / 0.25);
        const sx = cx + R * 0.90 * Math.cos(latRad) * Math.sin(lonRad);
        const sy = cy - R * 0.90 * Math.sin(latRad);
        const spotR = Math.max(4, region.area / 22 + 5) * limbFade;

        /* sunspot: penumbra */
        const pen = ctx.createRadialGradient(sx, sy, spotR * 0.35, sx, sy, spotR * 1.05);
        pen.addColorStop(0, "rgba(4,1,0,0.96)");
        pen.addColorStop(0.45, "rgba(22,7,0,0.78)");
        pen.addColorStop(0.75, "rgba(70,25,2,0.42)");
        pen.addColorStop(1, "rgba(150,55,5,0)");
        ctx.beginPath(); ctx.arc(sx, sy, spotR * 1.05, 0, Math.PI * 2);
        ctx.fillStyle = pen; ctx.fill();

        /* sunspot: umbra */
        const umb = ctx.createRadialGradient(sx - spotR * 0.08, sy - spotR * 0.1, 0, sx, sy, spotR * 0.35);
        umb.addColorStop(0, "rgba(2,0,0,0.99)");
        umb.addColorStop(1, "rgba(8,2,0,0.95)");
        ctx.beginPath(); ctx.arc(sx, sy, spotR * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = umb; ctx.fill();

        /* active region: dashed rectangle (instrument style) */
        const col = RISK_COLOR[region.flare_risk];
        const bw = spotR * 3.2, bh = spotR * 2.6;
        ctx.beginPath();
        ctx.rect(sx - bw / 2, sy - bh / 2, bw, bh);
        ctx.strokeStyle = col;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 3]);
        ctx.globalAlpha = limbFade * 0.85;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        /* label */
        ctx.font = `bold ${Math.max(7, spotR * 0.7)}px monospace`;
        ctx.fillStyle = col;
        ctx.fillText(region.label, sx - bw / 2, sy - bh / 2 - 3);

        newBoxes.set(region.id, { x: sx - bw / 2, y: sy - bh / 2, w: bw, h: bh });
      });

      ctx.restore();

      /* outer ring (clean boundary, no glow) */
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "#1E2D3D";
      ctx.lineWidth = 1; ctx.stroke();

      boxCacheRef.current = newBoxes;
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
    const sy = (e.clientY - rect.top)  * (c.height / rect.height);
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    let hit: ActiveRegion | null = null;
    for (const [id, b] of boxCacheRef.current) {
      if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
        hit = regions.find(r => r.id === id) ?? null;
        break;
      }
    }
    setHovered(hit);
  }

  return (
    <div className="relative w-full h-full" style={{ background: "#080C10" }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        width={600} height={560}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHovered(null)}
        style={{ cursor: hovered ? "crosshair" : "default", display: "block" }}
      />

      {/* hover tooltip */}
      {hovered && (
        <div
          className="absolute pointer-events-none z-20"
          style={{
            left: tip.x + 14, top: tip.y - 8,
            background: "#0E1620", border: "1px solid #1E2D3D",
            borderTop: `2px solid ${RISK_COLOR[hovered.flare_risk]}`,
            borderRadius: 2, padding: "8px 12px",
            fontSize: 9, fontFamily: "monospace",
          }}
        >
          <div style={{ color: RISK_COLOR[hovered.flare_risk], fontWeight: "bold", marginBottom: 4, letterSpacing: "0.1em" }}>
            {hovered.label}
          </div>
          {[
            ["AREA", `${hovered.area} μH`],
            ["LAT",  `${hovered.lat > 0 ? "N" : "S"}${Math.abs(hovered.lat)}°`],
            ["LON",  `${hovered.lon > 0 ? "E" : "W"}${Math.abs(hovered.lon)}°`],
            ["RISK", hovered.flare_risk.toUpperCase()],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 12, marginBottom: 2 }}>
              <span style={{ color: "#2E4558", width: 32 }}>{k}</span>
              <span style={{ color: k === "RISK" ? RISK_COLOR[hovered.flare_risk] : "#C8D8E8" }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* risk legend */}
      <div className="absolute bottom-1.5 left-2 flex gap-3">
        {Object.entries(RISK_COLOR).map(([k, c]) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 8, fontFamily: "monospace", color: "#2E4558" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block" }} />
            {k.toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
