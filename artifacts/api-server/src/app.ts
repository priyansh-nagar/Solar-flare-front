import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { createProxyMiddleware } from "http-proxy-middleware";
import router from "./routes";
import { logger } from "./lib/logger";

const VITE_PORT = 8080;

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (process.env.NODE_ENV !== "production") {
  app.use(
    "/",
    createProxyMiddleware({
      target: `http://localhost:${VITE_PORT}`,
      changeOrigin: true,
      ws: true,
      on: {
        error: (_err, _req, res) => {
          if (res && "writeHead" in res) {
            (res as any).writeHead(502, { "Content-Type": "text/html" });
            (res as any).end(
              "<html><body style='font-family:monospace;background:#070C10;color:#4DAAFF;padding:2rem'>" +
              "<h3>⏳ Frontend starting…</h3><p>Vite dev server is booting on port 8080. Refresh in a moment.</p>" +
              "</body></html>"
            );
          }
        },
      },
    }),
  );
}

export default app;
