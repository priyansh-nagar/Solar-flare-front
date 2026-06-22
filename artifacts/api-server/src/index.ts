import http from "node:http";
import { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const ALERT_THRESHOLD = 0.60;

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/api/ws" });

type ReplayPoint = {
  soft_flux: number;
  hard_flux: number;
  p_15min: number;
  p_30min: number;
  p_extreme: number;
  inference_ms: number;
};

/**
 * Generate a synthetic GOES-like 8-hour X-ray replay sequence.
 * Each date event produces a uniquely-shaped flux profile with
 * its own baseline, flare onset, peak magnitude, and decay rate.
 */
function generateFlareSequence(params: {
  baseSoft: number;
  baseHard: number;
  flareAt: number;
  peakSoft: number;
  riseMinutes: number;
  decayMinutes: number;
  isXClass: boolean;
}): ReplayPoint[] {
  const N = 480; // 8 h × 60 min
  const ratio = params.peakSoft / params.baseSoft;

  return Array.from({ length: N }, (_, i) => {
    const det  = Math.sin(i * 0.31) * 0.06 + Math.cos(i * 0.17) * 0.04;
    const wave = 1 + 0.22 * Math.sin((i / 120) * Math.PI);
    const dist = i - params.flareAt;

    let flareFactor = 1.0;
    // Gradual cubic pre-flare rise
    if (dist >= -params.riseMinutes && dist < 0) {
      const t = (dist + params.riseMinutes) / params.riseMinutes;
      flareFactor = 1 + (ratio - 1) * t * t * t;
    }
    // Impulsive peak, then exponential decay
    if (dist >= 0) {
      flareFactor = 1 + (ratio - 1) * Math.exp(-dist / params.decayMinutes);
    }

    const soft = parseFloat(Math.max(1e-9, params.baseSoft * wave * (1 + det) * flareFactor).toExponential(4));
    const hard = parseFloat(Math.max(1e-9, params.baseHard * wave * (1 + det * 0.7) * flareFactor * 0.92).toExponential(4));

    const probBase  = 0.12 + 0.03 * Math.sin((i / 120) * Math.PI);
    const probBoost = (dist >= -35 && dist < 100)
      ? Math.max(0, 1 - Math.abs(dist - 5) / 60) * (params.isXClass ? 0.82 : 0.65)
      : 0;
    const p_30min   = parseFloat(Math.min(0.95, probBase + probBoost).toFixed(4));
    const p_15min   = parseFloat(Math.min(0.95, p_30min * 0.92 + 0.03).toFixed(4));
    const p_extreme = parseFloat(Math.min(0.95, p_30min * (params.isXClass ? 0.48 : 0.18)).toFixed(4));
    const inference_ms = Math.round(95 + Math.sin(i * 0.43) * 55 + Math.cos(i * 0.29) * 30);

    return { soft_flux: soft, hard_flux: hard, p_15min, p_30min, p_extreme, inference_ms };
  });
}

// One deterministic sequence per selectable date. Peak soft fluxes match
// real GOES XRSB 1-8Å class boundaries (X1 = 1e-4, X3.4 = 3.4e-4, etc.)
const DATE_SEQUENCES = new Map<string, ReplayPoint[]>([
  ["2024-02-09 (X3.4)", generateFlareSequence({
    baseSoft: 1.8e-6, baseHard: 6.1e-8,
    flareAt: 180, peakSoft: 3.4e-4,
    riseMinutes: 20, decayMinutes: 30,
    isXClass: true,
  })],
  ["2024-02-22 (X6.4)", generateFlareSequence({
    baseSoft: 2.1e-6, baseHard: 7.6e-8,
    flareAt: 240, peakSoft: 6.4e-4,
    riseMinutes: 15, decayMinutes: 38,
    isXClass: true,
  })],
  ["2024-03-23 (X1.1)", generateFlareSequence({
    baseSoft: 1.2e-6, baseHard: 4.0e-8,
    flareAt: 300, peakSoft: 1.1e-4,
    riseMinutes: 28, decayMinutes: 22,
    isXClass: true,
  })],
  ["2024-05-06 (X4.5)", generateFlareSequence({
    baseSoft: 2.8e-6, baseHard: 9.5e-8,
    flareAt: 150, peakSoft: 4.5e-4,
    riseMinutes: 18, decayMinutes: 32,
    isXClass: true,
  })],
  ["2024-05-10 (X5.8)", generateFlareSequence({
    baseSoft: 3.2e-6, baseHard: 1.1e-7,
    flareAt: 360, peakSoft: 5.8e-4,
    riseMinutes: 12, decayMinutes: 42,
    isXClass: true,
  })],
  ["2024-10-03 (M5.1)", generateFlareSequence({
    baseSoft: 1.5e-6, baseHard: 5.2e-8,
    flareAt: 210, peakSoft: 5.1e-5,
    riseMinutes: 32, decayMinutes: 50,
    isXClass: false,
  })],
]);

function makeForecast() {
  const p_15min   = parseFloat((0.26 + Math.random() * 0.10).toFixed(4));
  const p_30min   = parseFloat((0.15 + Math.random() * 0.10).toFixed(4));
  const p_extreme = parseFloat((0.02 + Math.random() * 0.05).toFixed(4));
  return { p_15min, p_30min, p_extreme };
}

function makeXRay(prevSoft: number, prevHard: number) {
  const noise = () => 1 + (Math.random() - 0.5) * 0.10;
  const wave  = 1 + 0.12 * Math.sin(Date.now() / 70_000);
  // Clamp live soft to at most M-class (1e-4) to prevent jarring X flashes
  const soft = parseFloat(Math.min(9.9e-5, Math.max(1e-9, prevSoft * noise() * wave)).toExponential(4));
  const hard = parseFloat(Math.min(9.9e-6, Math.max(1e-9, prevHard * noise() * wave * 0.88)).toExponential(4));
  return { soft_flux: soft, hard_flux: hard };
}

wss.on("connection", (ws) => {
  logger.info("WebSocket client connected");

  let tickCount  = 0;
  let softFlux   = 2.3e-6;
  let hardFlux   = 8.1e-8;
  let liveInterval:  ReturnType<typeof setInterval> | null = null;
  let replayTimeout: ReturnType<typeof setTimeout>  | null = null;

  function stopAll() {
    if (liveInterval)  { clearInterval(liveInterval);  liveInterval  = null; }
    if (replayTimeout) { clearTimeout(replayTimeout);  replayTimeout = null; }
  }

  function broadcastLive() {
    if (ws.readyState !== ws.OPEN) return;
    tickCount++;
    const { p_15min, p_30min, p_extreme } = makeForecast();
    const { soft_flux, hard_flux }        = makeXRay(softFlux, hardFlux);
    softFlux = soft_flux;
    hardFlux = hard_flux;
    const inference_ms = Math.round(85 + Math.random() * 130);
    const timestamp    = new Date().toISOString();

    ws.send(JSON.stringify({
      type: "forecast", timestamp,
      p_15min, p_30min, p_extreme,
      soft_flux, hard_flux, inference_ms,
      model_version: "v2.1",
    }));

    if (p_30min >= ALERT_THRESHOLD) {
      const flareClass = p_extreme >= 0.30 ? "X" : "M";
      ws.send(JSON.stringify({
        type: "alert", timestamp, flare_class: flareClass,
        p_30min, p_extreme, threshold: ALERT_THRESHOLD,
        region: "AR4081",
        message: `${flareClass}-CLASS flare probability ${Math.round(p_30min * 100)}% exceeds FAR threshold`,
      }));
      logger.warn({ p_30min, flare_class: flareClass }, "Alert threshold crossed — broadcasting alert");
    }
  }

  function startLive() {
    stopAll();
    liveInterval = setInterval(broadcastLive, 3000);
  }

  function startReplay(speed = 20, date = "2024-02-22 (X6.4)") {
    if (ws.readyState !== ws.OPEN) return;
    stopAll();

    const sequence = DATE_SEQUENCES.get(date) ?? DATE_SEQUENCES.get("2024-02-22 (X6.4)")!;
    // Interval per point: 1x=1000ms, 5x=200ms, 10x=100ms, 20x=50ms
    const intervalMs = Math.max(10, Math.round(1000 / speed));

    logger.info({ date, speed, intervalMs, points: sequence.length }, "Starting replay");
    ws.send(JSON.stringify({ type: "replay_start", total: sequence.length }));

    const baseTime = Date.now() - sequence.length * 60_000; // walk from 8h ago
    let idx = 0;

    function sendNext() {
      if (ws.readyState !== ws.OPEN || idx >= sequence.length) {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "replay_end" }));
          logger.info("Replay complete — resuming live mode");
        }
        startLive();
        return;
      }

      const pt        = sequence[idx];
      const timestamp = new Date(baseTime + idx * 60_000).toISOString();

      ws.send(JSON.stringify({
        type: "forecast", timestamp, ...pt,
        replay: true, replay_idx: idx, replay_total: sequence.length,
        model_version: "v2.1",
      }));

      if (pt.p_30min >= ALERT_THRESHOLD) {
        const flareClass = pt.p_extreme >= 0.30 ? "X" : "M";
        ws.send(JSON.stringify({
          type: "alert", timestamp, flare_class: flareClass,
          p_30min: pt.p_30min, p_extreme: pt.p_extreme,
          threshold: ALERT_THRESHOLD, region: "AR4081",
          message: `${flareClass}-CLASS flare probability ${Math.round(pt.p_30min * 100)}% exceeds FAR threshold`,
        }));
      }

      idx++;
      replayTimeout = setTimeout(sendNext, intervalMs);
    }

    sendNext();
  }

  function stopReplay() {
    stopAll();
    logger.info("Replay stopped by client — resuming live mode");
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "replay_end" }));
    }
    startLive();
  }

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "replay_start") {
        const speed = typeof msg.speed === "number" && msg.speed > 0 ? msg.speed : 20;
        const date  = typeof msg.date  === "string" ? msg.date  : "2024-02-22 (X6.4)";
        startReplay(speed, date);
      } else if (msg.type === "replay_stop") {
        stopReplay();
      }
    } catch { /* ignore */ }
  });

  // First tick immediately, then live interval
  broadcastLive();
  startLive();

  ws.on("close", () => { stopAll(); logger.info("WebSocket client disconnected"); });
  ws.on("error", (err) => { stopAll(); logger.error({ err }, "WebSocket error"); });
});

server.listen(port, () => {
  logger.info({ port, alert_threshold: ALERT_THRESHOLD }, "Server listening (HTTP + WebSocket)");
});
