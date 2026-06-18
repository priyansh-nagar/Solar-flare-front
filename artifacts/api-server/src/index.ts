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

/** Server-side random walk for GOES-like X-ray flux values */
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

wss.on("connection", (ws) => {
  logger.info("WebSocket client connected");

  let tickCount  = 0;
  let softFlux   = 2.3e-6;   // start at mid C-class
  let hardFlux   = 8.1e-8;

  function broadcast() {
    if (ws.readyState !== ws.OPEN) return;

    tickCount++;
    // Spike once every 100 ticks (≈5 minutes at 3 s intervals)
    const spike = tickCount % 100 === 0;
    const { p_15min, p_30min, p_extreme } = makeForecast(spike);
    const { soft_flux, hard_flux }        = makeXRay(softFlux, hardFlux, spike);
    softFlux = soft_flux;
    hardFlux = hard_flux;
    const timestamp = new Date().toISOString();

    ws.send(JSON.stringify({
      type: "forecast",
      timestamp,
      p_15min,
      p_30min,
      p_extreme,
      soft_flux,
      hard_flux,
      model_version: "v2.1",
    }));

    if (p_30min >= ALERT_THRESHOLD) {
      const flareClass = p_extreme >= 0.30 ? "X" : "M";
      ws.send(JSON.stringify({
        type: "alert",
        timestamp,
        flare_class: flareClass,
        p_30min,
        p_extreme,
        threshold: ALERT_THRESHOLD,
        region: "AR4081",
        message: `${flareClass}-CLASS flare probability ${Math.round(p_30min * 100)}% exceeds FAR threshold`,
      }));
      logger.warn({ p_30min, flare_class: flareClass }, "Alert threshold crossed — broadcasting alert");
    }
  }

  broadcast();
  const interval = setInterval(broadcast, 3000);

  ws.on("close", () => { clearInterval(interval); logger.info("WebSocket client disconnected"); });
  ws.on("error", (err) => { clearInterval(interval); logger.error({ err }, "WebSocket error"); });
});

server.listen(port, () => {
  logger.info({ port, alert_threshold: ALERT_THRESHOLD }, "Server listening (HTTP + WebSocket)");
});
