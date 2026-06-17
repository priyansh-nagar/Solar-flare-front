import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/replay", (_req, res) => {
  const now = Date.now();

  const soft_xray_base = 2.3e-6 + Math.random() * 1e-7;
  const hard_xray_base = 8.1e-8 + Math.random() * 5e-9;

  const p_15min  = parseFloat((0.28 + Math.random() * 0.08).toFixed(4));
  const p_30min  = parseFloat((0.16 + Math.random() * 0.08).toFixed(4));
  const p_extreme = parseFloat((0.03 + Math.random() * 0.04).toFixed(4));

  res.json({
    timestamp: new Date(now).toISOString(),
    p_15min,
    p_30min,
    p_extreme,
    soft_xray_base,
    hard_xray_base,
    model_version: "v2.1",
    data_source: "GOES-16 XRSB/XRSA",
  });
});

export default router;
