import type { CompareResponse, RouteResult } from "../types";

export type CityNode = {
  coordinates: [number, number];
  /** Grid carbon intensity kgCO2/kWh — used as node weight for green routing */
  intensity: number;
  /** Relative routing “entry” carbon weight at this hub (gCO2 baseline), scales with edge length */
  nodeCarbonWeight: number;
};

export type GraphEdge = {
  to: string;
  distanceKm: number;
  latencyMs: number;
  /** Edge transfer carbon (gCO2) — link + endpoint blend */
  carbonFactor: number;
};

type Graph = Record<string, GraphEdge[]>;

/**
 * Real-world lon/lat [lng, lat] for Mercator projection (not random).
 * Carbon weights are demo-scale but consistent (higher = dirtier hub).
 */
export const CITY_DATA: Record<string, CityNode> = {
  Mumbai: { coordinates: [72.8777, 19.076], intensity: 0.34, nodeCarbonWeight: 12 },
  Dubai: { coordinates: [55.2708, 25.2048], intensity: 0.66, nodeCarbonWeight: 22 },
  Singapore: { coordinates: [103.8198, 1.3521], intensity: 0.29, nodeCarbonWeight: 9 },
  Frankfurt: { coordinates: [8.6821, 50.1109], intensity: 0.38, nodeCarbonWeight: 14 },
  London: { coordinates: [-0.1276, 51.5072], intensity: 0.31, nodeCarbonWeight: 11 },
  "New York": { coordinates: [-74.006, 40.7128], intensity: 0.61, nodeCarbonWeight: 20 },
  "Sao Paulo": { coordinates: [-46.6333, -23.5505], intensity: 0.58, nodeCarbonWeight: 19 },
  Tokyo: { coordinates: [139.6917, 35.6895], intensity: 0.47, nodeCarbonWeight: 16 },
  Sydney: { coordinates: [151.2093, -33.8688], intensity: 0.26, nodeCarbonWeight: 8 }
};

const CONNECTIONS: Array<[string, string]> = [
  ["Mumbai", "Dubai"],
  ["Mumbai", "Singapore"],
  ["Mumbai", "Frankfurt"],
  ["Dubai", "Frankfurt"],
  ["Dubai", "London"],
  ["Dubai", "Singapore"],
  ["Singapore", "Tokyo"],
  ["Singapore", "Sydney"],
  ["Singapore", "Sao Paulo"],
  ["Frankfurt", "London"],
  ["Frankfurt", "New York"],
  ["Frankfurt", "Tokyo"],
  ["London", "New York"],
  ["London", "Sao Paulo"],
  ["New York", "Sao Paulo"],
  ["New York", "Tokyo"],
  ["Tokyo", "Sydney"],
  ["Sao Paulo", "Sydney"],
  /* Long-haul alternatives for distinct fast vs green corridors */
  ["London", "Sydney"],
  ["New York", "Sydney"]
];

function haversineDistanceKm(a: [number, number], b: [number, number]) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const earthR = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
  return 2 * earthR * Math.asin(Math.sqrt(h));
}

function buildGraph(): Graph {
  const g: Graph = {};
  Object.keys(CITY_DATA).forEach((city) => {
    g[city] = [];
  });
  CONNECTIONS.forEach(([from, to]) => {
    const a = CITY_DATA[from];
    const b = CITY_DATA[to];
    if (!a || !b) return;
    const distanceKm = haversineDistanceKm(a.coordinates, b.coordinates);
    const baseLatency = Math.round(distanceKm * 0.55);
    const linkCarbon = Number((((a.intensity + b.intensity) / 2) * distanceKm * 0.09).toFixed(4));
    const edgeAB: GraphEdge = {
      to,
      distanceKm: Number(distanceKm.toFixed(1)),
      latencyMs: Math.max(30, baseLatency),
      carbonFactor: linkCarbon
    };
    const edgeBA: GraphEdge = {
      to: from,
      distanceKm: edgeAB.distanceKm,
      latencyMs: edgeAB.latencyMs,
      carbonFactor: edgeAB.carbonFactor
    };
    g[from].push(edgeAB);
    g[to].push(edgeBA);
  });
  return g;
}

const NETWORK_GRAPH = buildGraph();

function undirectedEdgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function edgeKeysFromPath(path: string[]): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < path.length - 1; i += 1) {
    s.add(undirectedEdgeKey(path[i], path[i + 1]));
  }
  return s;
}

export function pathsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/** Green cost: edge carbon + entering destination hub (node weight × distance). */
function ecoEdgeCost(from: string, edge: GraphEdge): number {
  const dest = CITY_DATA[edge.to];
  const w = dest?.nodeCarbonWeight ?? 14;
  const intensity = dest?.intensity ?? 0.4;
  return edge.carbonFactor + w * 0.35 + intensity * edge.distanceKm * 0.22;
}

function fastEdgeCost(edge: GraphEdge): number {
  return edge.latencyMs + edge.distanceKm * 0.025;
}

function dijkstra(
  source: string,
  destination: string,
  score: (from: string, edge: GraphEdge) => number
): string[] {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const unvisited = new Set(Object.keys(NETWORK_GRAPH));

  Object.keys(NETWORK_GRAPH).forEach((node) => {
    dist[node] = Number.POSITIVE_INFINITY;
    prev[node] = null;
  });
  dist[source] = 0;

  while (unvisited.size > 0) {
    let current: string | null = null;
    let best = Number.POSITIVE_INFINITY;
    unvisited.forEach((node) => {
      if (dist[node] < best) {
        best = dist[node];
        current = node;
      }
    });

    if (!current || best === Number.POSITIVE_INFINITY) break;
    unvisited.delete(current);
    if (current === destination) break;

    NETWORK_GRAPH[current].forEach((edge) => {
      if (!unvisited.has(edge.to)) return;
      const alt = dist[current!] + score(current!, edge);
      if (alt < dist[edge.to]) {
        dist[edge.to] = alt;
        prev[edge.to] = current;
      }
    });
  }

  const path: string[] = [];
  let walk: string | null = destination;
  while (walk) {
    path.unshift(walk);
    walk = prev[walk];
  }
  if (path.length === 0 || path[0] !== source) return [];
  return path;
}

function enumerateSimplePaths(source: string, destination: string, maxDepth: number): string[][] {
  const out: string[][] = [];
  function walk(u: string, path: string[]) {
    if (path.length > maxDepth) return;
    if (u === destination) {
      out.push([...path]);
      return;
    }
    for (const e of NETWORK_GRAPH[u] || []) {
      if (path.includes(e.to)) continue;
      path.push(e.to);
      walk(e.to, path);
      path.pop();
    }
  }
  walk(source, [source]);
  return out;
}

function pathEcoCost(path: string[]): number {
  let t = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    const from = path[i];
    const to = path[i + 1];
    const edge = NETWORK_GRAPH[from]?.find((e) => e.to === to);
    if (!edge) return Number.POSITIVE_INFINITY;
    t += ecoEdgeCost(from, edge);
  }
  return t;
}

/**
 * Second-best green path: avoid reusing the full fast path by penalizing its edges, then enumerate if needed.
 */
function computeGreenPathDistinct(source: string, destination: string, fastPath: string[]): string[] {
  const naiveEco = dijkstra(source, destination, (from, edge) => ecoEdgeCost(from, edge));
  if (!pathsEqual(naiveEco, fastPath) && naiveEco.length) return naiveEco;

  const fastEdges = edgeKeysFromPath(fastPath);
  const penalized = dijkstra(source, destination, (from, edge) => {
    const k = undirectedEdgeKey(from, edge.to);
    const base = ecoEdgeCost(from, edge);
    return base + (fastEdges.has(k) ? 1e7 : 0);
  });
  if (!pathsEqual(penalized, fastPath) && penalized.length) return penalized;

  const all = enumerateSimplePaths(source, destination, 14);
  let best: string[] = [];
  let bestCost = Number.POSITIVE_INFINITY;
  for (const p of all) {
    if (pathsEqual(p, fastPath)) continue;
    const c = pathEcoCost(p);
    if (c < bestCost) {
      bestCost = c;
      best = p;
    }
  }
  return best.length ? best : naiveEco;
}

function summarizePath(path: string[]): Omit<RouteResult, "path"> {
  let latency = 0;
  let carbon = 0;
  let cost = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    const from = path[i];
    const to = path[i + 1];
    const edge = NETWORK_GRAPH[from]?.find((candidate: GraphEdge) => candidate.to === to);
    if (!edge) continue;
    latency += edge.latencyMs;
    carbon += Math.round(edge.carbonFactor + (CITY_DATA[to]?.nodeCarbonWeight ?? 0) * 0.08);
    cost += edge.distanceKm * 0.03;
  }
  return {
    latency: Math.round(latency),
    carbon: Math.round(carbon),
    cost: Math.round(cost * 100) / 100
  };
}

export type RouteRecommendation = {
  mode: "eco" | "fast";
  reason: string;
};

export function recommendRoute(fast: RouteResult, eco: RouteResult): RouteRecommendation | null {
  if (!fast.path.length || !eco.path.length) return null;
  const latF = fast.latency;
  const latE = eco.latency;
  const cF = fast.carbon;
  const cE = eco.carbon;
  const carbonSave = cF - cE;
  const latencySave = latE - latF;
  const relCarbon = carbonSave / Math.max(1, cF);
  const relLat = latencySave / Math.max(1, latF);

  if (carbonSave > 3 && relCarbon > 0.12 && relLat < 0.45) {
    return {
      mode: "eco",
      reason: `Green route cuts ~${Math.round(relCarbon * 100)}% carbon with moderate latency trade-off.`
    };
  }
  if (latencySave > 15 && relLat > 0.1) {
    return {
      mode: "fast",
      reason: `Fast route saves ~${Math.round(latencySave)} ms latency vs green for this pair.`
    };
  }
  if (carbonSave >= latencySave / 8) {
    return { mode: "eco", reason: "Green route offers the better carbon profile here." };
  }
  return { mode: "fast", reason: "Fast route is the stronger fit for latency on this corridor." };
}

export function computeRoutes(source: string, destination: string): CompareResponse["routes"] {
  if (!CITY_DATA[source] || !CITY_DATA[destination]) {
    const fallback: RouteResult = { path: [source, destination], latency: 0, carbon: 0, cost: 0, message: "Unknown city." };
    return { eco: fallback, balanced: fallback, fast: fallback };
  }

  if (source === destination) {
    const same: RouteResult = {
      path: [source],
      latency: 0,
      carbon: 0,
      cost: 0,
      message: "Source and destination are the same."
    };
    return { eco: same, balanced: same, fast: same };
  }

  const fastPath = dijkstra(source, destination, (_from, edge) => fastEdgeCost(edge));
  const ecoPath = computeGreenPathDistinct(source, destination, fastPath);
  const balancedPath = dijkstra(source, destination, (from, edge) => fastEdgeCost(edge) * 0.48 + ecoEdgeCost(from, edge) * 0.52);

  const fastMetrics = summarizePath(fastPath);
  const ecoMetrics = summarizePath(ecoPath);
  const balancedMetrics = summarizePath(balancedPath);

  const noRoute: RouteResult = {
    path: [],
    latency: 0,
    carbon: 0,
    cost: 0,
    message: "No path exists between these cities on the network graph."
  };

  return {
    eco: ecoPath.length ? { path: ecoPath, ...ecoMetrics } : { ...noRoute },
    balanced: balancedPath.length ? { path: balancedPath, ...balancedMetrics } : { ...noRoute },
    fast: fastPath.length ? { path: fastPath, ...fastMetrics } : { ...noRoute }
  };
}

/** Per-hop graph data for a computed path (same edges as routing uses). */
export type PathSegment = {
  from: string;
  to: string;
  distanceKm: number;
  latencyMs: number;
  carbonFactor: number;
};

export function getPathEdgeSegments(path: string[]): PathSegment[] {
  const out: PathSegment[] = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const from = path[i];
    const to = path[i + 1];
    const edge = NETWORK_GRAPH[from]?.find((e) => e.to === to);
    if (!edge) continue;
    out.push({ from, to, distanceKm: edge.distanceKm, latencyMs: edge.latencyMs, carbonFactor: edge.carbonFactor });
  }
  return out;
}

/**
 * Total path carbon (g) using the same hop model as routing, **without** per-hop rounding.
 * Use for comparisons (Impact, deltas) where rounded totals can tie incorrectly.
 */
export function getPathCarbonGramsExact(path: string[]): number {
  let carbon = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    const from = path[i];
    const to = path[i + 1];
    const edge = NETWORK_GRAPH[from]?.find((e) => e.to === to);
    if (!edge) continue;
    carbon += edge.carbonFactor + (CITY_DATA[to]?.nodeCarbonWeight ?? 0) * 0.08;
  }
  return carbon;
}

export type DerivedPathSignals = {
  hopCount: number;
  totalLatencyMs: number;
  totalEdgeCarbonG: number;
  /** Mean grid carbon intensity (kgCO2/kWh) along hops — from CITY_DATA, not random */
  pathAvgIntensityKgPerKwh: number;
  congestionPct: number;
  trafficLoadPct: number;
  nodeHealthPct: number;
  /** Hop with highest latency per km (stress proxy) */
  maxStressEdge: PathSegment | null;
};

/**
 * Deterministic “network” metrics from path topology and edge weights only.
 */
export function derivePathSignals(path: string[]): DerivedPathSignals | null {
  const segments = getPathEdgeSegments(path);
  if (!segments.length) return null;
  const hopCount = segments.length;
  const totalLatencyMs = segments.reduce((s, e) => s + e.latencyMs, 0);
  const totalEdgeCarbonG = segments.reduce((s, e) => s + e.carbonFactor, 0);
  const intensities = path.map((c) => CITY_DATA[c]?.intensity ?? 0);
  const pathAvgIntensityKgPerKwh = intensities.reduce((a, b) => a + b, 0) / Math.max(1, path.length);
  const stressScores = segments.map((e) => e.latencyMs / Math.max(0.5, e.distanceKm));
  const avgStress = stressScores.reduce((a, b) => a + b, 0) / hopCount;
  const maxIdx = stressScores.reduce((best, v, i) => (v > stressScores[best] ? i : best), 0);
  const maxStressEdge = segments[maxIdx] ?? null;
  const congestionPct = Math.min(95, Math.round(26 + avgStress * 8.5 + pathAvgIntensityKgPerKwh * 36));
  const trafficLoadPct = Math.min(95, Math.round(34 + (totalLatencyMs / Math.max(1, hopCount * 90)) * 32));
  const nodeHealthPct = Math.max(62, Math.round(100 - congestionPct * 0.36));
  return {
    hopCount,
    totalLatencyMs,
    totalEdgeCarbonG,
    pathAvgIntensityKgPerKwh,
    congestionPct,
    trafficLoadPct,
    nodeHealthPct,
    maxStressEdge
  };
}

/**
 * kWh estimate for one routing cycle — tied to the same hop carbon + distance model as routing (no randomness).
 * Scaled so typical corridors show meaningful deltas between fast vs green paths.
 */
export function deriveEnergyKwhFromPath(path: string[]): number {
  const segs = getPathEdgeSegments(path);
  if (!segs.length) return 0;
  let kwh = 0;
  for (const seg of segs) {
    const hi = CITY_DATA[seg.from]?.intensity ?? 0.35;
    const hj = CITY_DATA[seg.to]?.intensity ?? 0.35;
    const hopCarbon = seg.carbonFactor + (CITY_DATA[seg.to]?.nodeCarbonWeight ?? 0) * 0.08;
    // Energy proxy: transfer work scales with modeled hop carbon (g) and geographic span
    kwh += hopCarbon * 0.0115 + seg.distanceKm * 0.00018 * (hi + hj);
  }
  return Math.round(kwh * 1000) / 1000;
}
