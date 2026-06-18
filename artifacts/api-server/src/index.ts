import http from "node:http";
import { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/api/ws" });

function makeBroadcast() {
  const p_15min   = parseFloat((0.26 + Math.random() * 0.10).toFixed(4));
  const p_30min   = parseFloat((0.15 + Math.random() * 0.10).toFixed(4));
  const p_extreme = parseFloat((0.02 + Math.random() * 0.05).toFixed(4));
  return JSON.stringify({
    type: "forecast",
    timestamp: new Date().toISOString(),
    p_15min,
    p_30min,
    p_extreme,
    model_version: "v2.1",
  });
}

wss.on("connection", (ws) => {
  logger.info("WebSocket client connected");
  ws.send(makeBroadcast());

  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(makeBroadcast());
    }
  }, 3000);

  ws.on("close", () => {
    clearInterval(interval);
    logger.info("WebSocket client disconnected");
  });
  ws.on("error", (err) => {
    clearInterval(interval);
    logger.error({ err }, "WebSocket error");
  });
});

server.listen(port, () => {
  logger.info({ port }, "Server listening (HTTP + WebSocket)");
});
