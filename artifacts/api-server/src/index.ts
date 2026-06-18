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

function makeForecast(spike = false) {
  const p_15min   = parseFloat((0.26 + Math.random() * 0.10).toFixed(4));
  const p_30min   = spike
    ? parseFloat((0.65 + Math.random() * 0.28).toFixed(4))
    : parseFloat((0.15 + Math.random() * 0.10).toFixed(4));
  const p_extreme = spike
    ? parseFloat((0.18 + Math.random() * 0.20).toFixed(4))
    : parseFloat((0.02 + Math.random() * 0.05).toFixed(4));
  return { p_15min, p_30min, p_extreme };
}

function makeXRay(prevSoft: number, prevHard: number, spike = false) {
  const noise  = () => 1 + (Math.random() - 0.5) * 0.10;
  const wave   = 1 + 0.12 * Math.sin(Date.now() / 70_000);
  const soft = spike
    ? parseFloat((prevSoft * noise() * wave * (8 + Math.random() * 12)).toExponential(4))
    : parseFloat((Math.max(1e-9, prevSoft * noise() * wave)).toExponential(4));
  const hard = spike
    ? parseFloat((prevHard * noise() * wave * (6 + Math.random() * 10)).toExponential(4))
    : parseFloat((Math.max(1e-9, prevHard * noise() * wave * 0.88)).toExponential(4));
  return { soft_flux: soft, hard_flux: hard };
}

/**
 * Deterministic 8-hour GOES-like X-ray replay sequence.
 * No Math.random() — uses trig at prime frequencies so the shape is
 * always the same and predictable. Features an M1.6-class storm at hour 4.
 */
function generateReplaySequence() {
  const N        = 480; // 8 h × 60 min
  const baseSoft = 2.1e-6;
  const baseHard = 7.6e-8;
  const flareAt  = 240; // M-flare onset at minute 240 (hour 4)

  return Array.from({ length: N }, (_, i) => {
    const det  = Math.sin(i * 0.31) * 0.06 + Math.cos(i * 0.17) * 0.04;
    const wave = 1 + 0.22 * Math.sin((i / 120) * Math.PI);

    const dist = i - flareAt;
    let boost = 1;
    if (dist >= -25 && dist < 0)   boost = 1 + ((dist + 25) / 25) * 1.8;
    if (dist >= 0  && dist < 120)  boost = 1 + Math.exp(-dist / 22) * 6.5; // M1.6 peak

    const soft = parseFloat(Math.max(1e-9, baseSoft * wave * (1 + det) * boost).toExponential(4));
    const hard = parseFloat(Math.max(1e-9, baseHard * wave * (1 + det * 0.7) * boost * 0.92).toExponential(4));

    const probBase  = 0.11 + 0.04 * Math.sin((i / 120) * Math.PI);
    const probBoost = (dist >= -30 && dist < 90)
      ? Math.max(0, 1 - Math.abs(dist - 10) / 55) * 0.62 : 0;
    const prob      = parseFloat(Math.min(0.95, probBase + probBoost).toFixed(4));

    const p_30min   = prob;
    const p_15min   = parseFloat(Math.min(0.95, prob * 0.9 + 0.04).toFixed(4));
    const p_extreme = parseFloat(Math.min(0.95, prob * 0.25).toFixed(4));
    const inference_ms = Math.round(95 + Math.sin(i * 0.43) * 55 + Math.cos(i * 0.29) * 30);

    return { soft_flux: soft, hard_flux: hard, p_15min, p_30min, p_extreme, inference_ms };
  });
}

const REPLAY_SEQUENCE = generateReplaySequence();

wss.on("connection", (ws) => {
  logger.info("WebSocket client connected");

  let tickCount  = 0;
  let softFlux   = 2.3e-6;
  let hardFlux   = 8.1e-8;
  let liveInterval:   ReturnType<typeof setInterval>  | null = null;
  let replayTimeout:  ReturnType<typeof setTimeout>   | null = null;

  function stopAll() {
    if (liveInterval)  { clearInterval(liveInterval);  liveInterval  = null; }
    if (replayTimeout) { clearTimeout(replayTimeout);  replayTimeout = null; }
  }

  function broadcastLive() {
    if (ws.readyState !== ws.OPEN) return;
    tickCount++;
    const spike = tickCount % 100 === 0;
    const { p_15min, p_30min, p_extreme } = makeForecast(spike);
    const { soft_flux, hard_flux }        = makeXRay(softFlux, hardFlux, spike);
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

  function startReplay() {
    if (ws.readyState !== ws.OPEN) return;
    stopAll();
    logger.info({ total: REPLAY_SEQUENCE.length }, "Starting GOES-16 8h replay sequence");
    ws.send(JSON.stringify({ type: "replay_start", total: REPLAY_SEQUENCE.length }));

    const baseTime = Date.now() - REPLAY_SEQUENCE.length * 60_000; // walk from 8h ago
    let idx = 0;

    function sendNext() {
      if (ws.readyState !== ws.OPEN || idx >= REPLAY_SEQUENCE.length) {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "replay_end" }));
          logger.info("Replay complete — resuming live mode");
        }
        startLive();
        return;
      }

      const pt        = REPLAY_SEQUENCE[idx];
      const timestamp = new Date(baseTime + idx * 60_000).toISOString();

      ws.send(JSON.stringify({
        type: "forecast", timestamp, ...pt,
        replay: true, replay_idx: idx, replay_total: REPLAY_SEQUENCE.length,
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
      replayTimeout = setTimeout(sendNext, 200); // 200 ms/point → 480 pts ≈ 96 s total
    }

    sendNext();
  }

  // Handle messages from the client
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "replay_start") startReplay();
    } catch { /* ignore */ }
  });

  // Immediate first tick then start live interval
  broadcastLive();
  startLive();

  ws.on("close", () => { stopAll(); logger.info("WebSocket client disconnected"); });
  ws.on("error", (err) => { stopAll(); logger.error({ err }, "WebSocket error"); });
});

server.listen(port, () => {
  logger.info({ port, alert_threshold: ALERT_THRESHOLD }, "Server listening (HTTP + WebSocket)");
});
