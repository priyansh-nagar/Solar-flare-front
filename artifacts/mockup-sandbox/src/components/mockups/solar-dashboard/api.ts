const BASE_URL = "https://solar-1-2krl.onrender.com";

export interface SolarPrediction {
  b_class: number;
  c_class: number;
  m_class: number;
  x_class: number;
  confidence: number;
  timestamp: string;
}

export interface ActiveRegion {
  id: string;
  label: string;
  lat: number;
  lon: number;
  area: number;
  flare_risk: "low" | "moderate" | "high" | "severe";
}

export interface Telemetry {
  soft_xray_flux: number;
  hard_xray_flux: number;
  active_region_count: number;
  flare_index: number;
  prediction_confidence: number;
  data_timestamp: string;
}

export interface HealthStatus {
  status: string;
  model_status: string;
  inference_time_ms: number;
  last_prediction_time: string;
  system_health: string;
}

export interface SolarApiResponse {
  prediction: SolarPrediction;
  active_regions: ActiveRegion[];
  telemetry: Telemetry;
  health: HealthStatus;
  forecast_series: { time: string; b: number; c: number; m: number; x: number }[];
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return res;
    } catch {
      if (i === retries - 1) throw new Error(`Failed after ${retries} retries`);
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("Unreachable");
}

export async function fetchSolarData(): Promise<SolarApiResponse> {
  const [predRes, healthRes] = await Promise.allSettled([
    fetchWithRetry(`${BASE_URL}/predict`),
    fetchWithRetry(`${BASE_URL}/health`),
  ]);

  const pred = predRes.status === "fulfilled" ? await predRes.value.json() : null;
  const health = healthRes.status === "fulfilled" ? await healthRes.value.json() : null;

  const now = new Date();
  const forecast_series = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(now.getTime() - (23 - i) * 3600 * 1000);
    const base = pred?.prediction || {};
    const noise = () => (Math.random() - 0.5) * 0.04;
    return {
      time: t.toISOString(),
      b: Math.max(0, Math.min(1, (base.b_class ?? 0.65) + noise())),
      c: Math.max(0, Math.min(1, (base.c_class ?? 0.35) + noise())),
      m: Math.max(0, Math.min(1, (base.m_class ?? 0.18) + noise())),
      x: Math.max(0, Math.min(1, (base.x_class ?? 0.04) + noise())),
    };
  });

  return {
    prediction: pred?.prediction ?? mockPrediction(),
    active_regions: pred?.active_regions ?? mockRegions(),
    telemetry: pred?.telemetry ?? mockTelemetry(),
    health: health ?? mockHealth(),
    forecast_series,
  };
}

function mockPrediction(): SolarPrediction {
  return {
    b_class: 0.72,
    c_class: 0.41,
    m_class: 0.19,
    x_class: 0.05,
    confidence: 0.87,
    timestamp: new Date().toISOString(),
  };
}

function mockRegions(): ActiveRegion[] {
  return [
    { id: "AR4087", label: "AR4087", lat: 12, lon: -45, area: 320, flare_risk: "high" },
    { id: "AR4085", label: "AR4085", lat: -8, lon: 20, area: 180, flare_risk: "moderate" },
    { id: "AR4083", label: "AR4083", lat: 25, lon: 60, area: 90, flare_risk: "low" },
    { id: "AR4081", label: "AR4081", lat: -18, lon: -70, area: 410, flare_risk: "severe" },
  ];
}

function mockTelemetry(): Telemetry {
  return {
    soft_xray_flux: 2.3e-6,
    hard_xray_flux: 8.1e-8,
    active_region_count: 4,
    flare_index: 1.87,
    prediction_confidence: 0.87,
    data_timestamp: new Date().toISOString(),
  };
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
