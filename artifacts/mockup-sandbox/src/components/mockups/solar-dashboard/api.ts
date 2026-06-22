const LOCAL_API = "/api";

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
  prob?: number; // P(M+ 30min) 0–1, stored per-point
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


export async function fetchSolarData(): Promise<SolarApiResponse> {
  const replayRes = await Promise.allSettled([
    fetch(`${LOCAL_API}/replay`),
  ]);

  const replay = replayRes[0].status === "fulfilled" ? await replayRes[0].value.json().catch(() => null) : null;

  return {
    active_regions: mockRegions(),
    xray_series:    buildXRaySeries(null),
    health:         mockHealth(),
    forecast_windows: buildForecastWindows(null),
    flare_events:   mockFlareEvents(),
    confidence:     0.87,
    lead_time_peak: 14,
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

  // Inject synthetic flare bumps at random positions so the shape differs each reload
  const rndFlare = () => Math.floor(Math.random() * N);
  const flareAt = [
    20  + Math.floor(Math.random() * 100),
    140 + Math.floor(Math.random() * 80),
    250 + Math.floor(Math.random() * 90),
  ].sort((a, b) => a - b);
  const flareClass = [
    [3e-6, 8e-5, 5e-5][Math.floor(Math.random() * 3)],
    [2e-4, 8e-5, 4e-4][Math.floor(Math.random() * 3)],
    [5e-6, 3e-5, 1e-5][Math.floor(Math.random() * 3)],
  ];
  void rndFlare;

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

    // Probability follows a slow sine + flare bumps, stays realistic (5–40%)
    const baseProb = 0.14 + 0.08 * Math.sin(i / 55 + 1.2);
    let probAdd = 0;
    flareAt.forEach((fi) => {
      const dist = i - fi;
      if (dist >= -10 && dist < 25) {
        const envelope = Math.exp(-Math.abs(dist - 3) / 10) * 0.38;
        probAdd += envelope;
      }
    });
    const prob = Math.min(0.95, Math.max(0.04, baseProb + probAdd + (Math.random() - 0.5) * 0.04));

    return {
      time: t,
      soft: baseSoft * backgroundWave * noise() + softAdd,
      hard: baseHard * backgroundWave * noise() * 0.8 + hardAdd,
      prob,
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
  const regions = ["AR4081", "AR4085", "AR4087", "AR4083"];
  const classPool: { cls: string; flux: number }[] = [
    { cls: "X1.2", flux: 1.2e-4 }, { cls: "X2.1", flux: 2.1e-4 },
    { cls: "M5.3", flux: 5.3e-5 }, { cls: "M3.1", flux: 3.1e-5 },
    { cls: "M2.3", flux: 2.3e-5 }, { cls: "M1.1", flux: 1.1e-5 },
    { cls: "C9.4", flux: 9.4e-6 }, { cls: "C7.1", flux: 7.1e-6 },
    { cls: "C4.8", flux: 4.8e-6 }, { cls: "C2.4", flux: 2.4e-6 },
    { cls: "B9.4", flux: 9.4e-7 }, { cls: "B6.2", flux: 6.2e-7 },
  ];

  const rng = (min: number, max: number) => min + Math.random() * (max - min);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Spread 8 events over the last 8 hours at random offsets
  const offsets = [
    rng(7 * 3600_000, 8 * 3600_000),
    rng(5 * 3600_000, 7 * 3600_000),
    rng(3.5 * 3600_000, 5 * 3600_000),
    rng(2 * 3600_000, 3.5 * 3600_000),
    rng(80 * 60_000, 2 * 3600_000),
    rng(40 * 60_000, 80 * 60_000),
    rng(15 * 60_000, 40 * 60_000),
    rng(3 * 60_000, 15 * 60_000),
  ];

  return offsets.map((offset, i) => {
    const entry = pick(classPool);
    const isForecast = Math.random() < 0.35;
    return {
      id: `mock-${Math.floor(now / 30_000)}-${i}`,
      time: new Date(now - offset).toISOString(),
      class: entry.cls,
      peak_flux: entry.flux * (0.85 + Math.random() * 0.30),
      region: pick(regions),
      type: isForecast ? "forecast" : "nowcast",
      confidence: parseFloat((0.65 + Math.random() * 0.32).toFixed(2)),
      ...(isForecast ? { lead_time_min: Math.round(rng(5, 25)) } : {}),
    } as FlareEventRaw;
  });
}
