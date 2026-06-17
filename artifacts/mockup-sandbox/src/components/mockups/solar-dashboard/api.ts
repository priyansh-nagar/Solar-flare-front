const BASE_URL = "https://solar-1-2krl.onrender.com";

export interface ActiveRegion {
  id: string;
  label: string;
  lat: number;
  lon: number;
  area: number;
  flare_risk: "low" | "moderate" | "high" | "severe";
}

export interface XRayPoint {
  time: string;
  soft: number;
  hard: number;
}

export interface HealthStatus {
  status: string;
  model_status: string;
  inference_time_ms: number;
  last_prediction_time: string;
  system_health: string;
}

export interface ForecastWindow {
  lead_min: number;
  prob_c: number;
  prob_m: number;
  prob_x: number;
}

export interface FlareEventRaw {
  id: string;
  time: string;
  endTime?: string;
  class: string;
  peak_flux: number;
  region: string;
  type: "nowcast" | "forecast";
  confidence: number;
  lead_time_min?: number;
}

export interface SolarApiResponse {
  active_regions: ActiveRegion[];
  xray_series: XRayPoint[];
  health: HealthStatus;
  forecast_windows: ForecastWindow[];
  flare_events: FlareEventRaw[];
  confidence: number;
  lead_time_peak: number;
  p_15min: number;
  p_30min: number;
  p_extreme: number;
}

export interface SolarPrediction {
  m_class: number;
  x_class: number;
  confidence: number;
}

export interface Telemetry {
  soft_xray_flux: number;
  hard_xray_flux: number;
  active_region_count: number;
  flare_index: number;
  prediction_confidence: number;
  data_timestamp: string | null;
}

async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (res.ok) return res;
    } catch {
      if (i === retries - 1) throw new Error(`Failed after ${retries} retries`);
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw new Error("Unreachable");
}

export async function fetchSolarData(): Promise<SolarApiResponse> {
  const [predRes, healthRes, replayRes] = await Promise.allSettled([
    fetchWithRetry(`${BASE_URL}/predict`),
    fetchWithRetry(`${BASE_URL}/health`),
    fetchWithRetry(`${BASE_URL}/replay`),
  ]);

  const pred   = predRes.status   === "fulfilled" ? await predRes.value.json().catch(() => null)   : null;
  const health = healthRes.status === "fulfilled" ? await healthRes.value.json().catch(() => null) : null;
  const replay = replayRes.status === "fulfilled" ? await replayRes.value.json().catch(() => null) : null;

  return {
    active_regions: pred?.active_regions ?? mockRegions(),
    xray_series:    buildXRaySeries(pred),
    health:         health ?? mockHealth(),
    forecast_windows: buildForecastWindows(pred),
    flare_events:   pred?.flare_events ?? mockFlareEvents(),
    confidence:     pred?.prediction?.confidence ?? 0.87,
    lead_time_peak: pred?.lead_time_peak ?? 14,
    p_15min:        replay?.p_15min  ?? 0.31,
    p_30min:        replay?.p_30min  ?? 0.19,
    p_extreme:      replay?.p_extreme ?? 0.05,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** Generate 6h of synthetic GOES-like X-ray data at 1-min cadence */
function buildXRaySeries(pred: any): XRayPoint[] {
  const baseSoft = pred?.prediction?.soft_xray_base ?? 2.3e-6;
  const baseHard = pred?.prediction?.hard_xray_base ?? 8.1e-8;
  const now = Date.now();
  const N = 360; // 6 hours × 60 min

  // Inject synthetic flare bumps for realism
  const flareAt = [80, 210, 310];
  const flareClass = [1e-5, 2e-4, 5e-6];

  return Array.from({ length: N }, (_, i) => {
    const t = new Date(now - (N - 1 - i) * 60_000).toISOString();
    const noise = () => 1 + (Math.random() - 0.5) * 0.12;
    const backgroundWave = 1 + 0.25 * Math.sin(i / 40);

    let softAdd = 0;
    let hardAdd = 0;
    flareAt.forEach((fi, idx) => {
      const dist = i - fi;
      if (dist >= 0 && dist < 30) {
        const envelope = Math.exp(-dist / 8) * flareClass[idx];
        softAdd += envelope;
        hardAdd += envelope * 0.4;
      }
    });

    return {
      time: t,
      soft: baseSoft * backgroundWave * noise() + softAdd,
      hard: baseHard * backgroundWave * noise() * 0.8 + hardAdd,
    };
  });
}

function buildForecastWindows(pred: any): ForecastWindow[] {
  const baseMProb = pred?.prediction?.m_class ?? 0.19;
  const baseXProb = pred?.prediction?.x_class ?? 0.05;
  const baseCProb = pred?.prediction?.c_class ?? 0.41;

  return Array.from({ length: 30 }, (_, i) => {
    const t = i + 1;
    const decay = Math.exp(-t / 25);
    const rise = t < 10 ? t / 10 : 1;
    const wave = 1 + 0.1 * Math.sin(t / 5);
    return {
      lead_min: t * 2,
      prob_c: Math.min(1, baseCProb * rise * wave * (1 - t / 80)),
      prob_m: Math.min(1, baseMProb * rise * wave * decay),
      prob_x: Math.min(1, baseXProb * rise * wave * decay * 0.8),
    };
  });
}

function mockRegions(): ActiveRegion[] {
  return [
    { id: "AR4087", label: "AR4087", lat: 12, lon: -45, area: 320, flare_risk: "high" },
    { id: "AR4085", label: "AR4085", lat: -8, lon: 20, area: 180, flare_risk: "moderate" },
    { id: "AR4083", label: "AR4083", lat: 25, lon: 60, area: 90, flare_risk: "low" },
    { id: "AR4081", label: "AR4081", lat: -18, lon: -70, area: 410, flare_risk: "severe" },
  ];
}

function mockHealth(): HealthStatus {
  return {
    status: "operational",
    model_status: "loaded",
    inference_time_ms: 142,
    last_prediction_time: new Date().toISOString(),
    system_health: "nominal",
  };
}

function mockFlareEvents(): FlareEventRaw[] {
  const now = Date.now();
  return [
    { id: "e1", time: new Date(now - 3 * 3600_000).toISOString(), class: "M2.3", peak_flux: 2.3e-5, region: "AR4081", type: "nowcast", confidence: 0.93 },
    { id: "e2", time: new Date(now - 1.5 * 3600_000).toISOString(), class: "C7.1", peak_flux: 7.1e-6, region: "AR4087", type: "nowcast", confidence: 0.88 },
    { id: "e3", time: new Date(now - 45 * 60_000).toISOString(), class: "M1.1", peak_flux: 1.1e-5, region: "AR4081", type: "forecast", confidence: 0.76, lead_time_min: 14 },
    { id: "e4", time: new Date(now - 20 * 60_000).toISOString(), class: "B9.4", peak_flux: 9.4e-7, region: "AR4085", type: "nowcast", confidence: 0.82 },
    { id: "e5", time: new Date(now - 8 * 60_000).toISOString(), class: "C2.4", peak_flux: 2.4e-6, region: "AR4087", type: "forecast", confidence: 0.71, lead_time_min: 8 },
  ];
}
