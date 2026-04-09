import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useRoutePlanning } from "../context/RoutePlanningContext";
import CorridorRequiredPlaceholder from "../components/CorridorRequiredPlaceholder";
import {
  CITY_DATA,
  derivePathSignals,
  getPathEdgeSegments,
  type PathSegment
} from "../lib/routeEngine";
import type { CompareResponse, Mode, RouteResult } from "../types";

/** Geographic region labels for insight copy (fixed per city, not generated). */
const CITY_REGION: Record<string, string> = {
  Mumbai: "South Asia",
  Dubai: "Middle East / Gulf",
  Singapore: "Southeast Asia",
  Frankfurt: "Central Europe",
  London: "UK / Western Europe",
  "New York": "North America (East)",
  Tokyo: "East Asia",
  Sydney: "Oceania",
  "Sao Paulo": "South America"
};

const HIGH_INTENSITY = 0.45;

function activeRouteForMode(routes: CompareResponse["routes"] | null, mode: Mode): RouteResult | null {
  if (!routes) return null;
  if (mode === "fast") return routes.fast.path.length ? routes.fast : null;
  if (mode === "eco") return routes.eco.path.length ? routes.eco : null;
  return routes.balanced.path.length ? routes.balanced : null;
}

function pathRegions(path: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of path) {
    const r = CITY_REGION[c];
    if (r && !seen.has(r)) {
      seen.add(r);
      out.push(r);
    }
  }
  return out;
}

function highCarbonNodesOnPath(path: string[]) {
  return path.filter((c) => (CITY_DATA[c]?.intensity ?? 0) >= HIGH_INTENSITY);
}

function buildSelectionReasonLines(mode: Mode, fast: RouteResult, eco: RouteResult, balanced: RouteResult): string[] {
  if (!fast.path.length || !eco.path.length) {
    return ["Compute a route by selecting two different cities."];
  }
  const carbonDelta = fast.carbon - eco.carbon;
  const latencyDelta = eco.latency - fast.latency;
  const carbonPctVsFast = fast.carbon > 0 ? Math.round((carbonDelta / fast.carbon) * 100) : 0;
  const latencyPctVsFast = fast.latency > 0 ? Math.round((latencyDelta / fast.latency) * 100) : 0;

  if (mode === "eco") {
    const lines = [
      carbonDelta > 0
        ? `Green route selected: about ${carbonPctVsFast}% lower modeled carbon than the fast path (${eco.carbon} g vs ${fast.carbon} g).`
        : `Green route selected: carbon estimate ${eco.carbon} g (fast path ${fast.carbon} g on this corridor).`
    ];
    if (latencyDelta > 0) {
      lines.push(`Latency trade-off vs fast: green path +${latencyDelta} ms (~${latencyPctVsFast}% vs fast).`);
    } else if (latencyDelta < 0) {
      lines.push(`Latency vs fast: ${latencyDelta} ms (green path is quicker on this graph instance).`);
    }
    return lines;
  }

  if (mode === "fast") {
    const lines = [
      latencyDelta !== 0
        ? `Fast route selected: ${fast.latency} ms end-to-end vs ${eco.latency} ms on the green path.`
        : `Fast route selected: ${fast.latency} ms end-to-end (same latency estimate as green here).`
    ];
    if (latencyDelta > 0) {
      lines.push(`Latency advantage vs green: ${latencyDelta} ms faster than the green path.`);
    }
    if (carbonDelta > 0) {
      lines.push(`Carbon cost vs green: +${carbonDelta} g (${fast.carbon} g vs ${eco.carbon} g).`);
    } else {
      lines.push(`Carbon estimate ${fast.carbon} g vs green ${eco.carbon} g.`);
    }
    return lines;
  }

  if (balanced.path.length) {
    return [
      `Balanced route: ${balanced.path.join(" → ")} — ${balanced.latency} ms, ${balanced.carbon} g (weighted blend from the graph).`,
      `Compared to fast: ${fast.latency} ms / ${fast.carbon} g · Compared to green: ${eco.latency} ms / ${eco.carbon} g.`
    ];
  }
  return [
    `Balanced mode uses the weighted cost from the graph.`,
    `Fast: ${fast.latency} ms / ${fast.carbon} g · Green: ${eco.latency} ms / ${eco.carbon} g.`
  ];
}

function buildInsightSteps(
  fast: RouteResult,
  eco: RouteResult,
  signals: ReturnType<typeof derivePathSignals>,
  stressEdge: PathSegment | null
): Array<{ text: string }> {
  if (!fast.path.length || !eco.path.length) {
    return [{ text: "Select a source and destination to analyze live routing insights." }];
  }

  const fastRegs = pathRegions(fast.path);
  const ecoRegs = pathRegions(eco.path);
  const fastHigh = highCarbonNodesOnPath(fast.path);
  const ecoHigh = highCarbonNodesOnPath(eco.path);

  const steps: Array<{ text: string }> = [
    {
      text: `Fast path ${fast.path.join(" → ")} crosses ${fastRegs.length ? fastRegs.join(", ") : "selected hubs"}; Green path ${eco.path.join(" → ")} crosses ${ecoRegs.length ? ecoRegs.join(", ") : "selected hubs"}.`
    }
  ];

  if (fastHigh.length) {
    steps.push({
      text: `High carbon-intensity hubs on fast route (≥${HIGH_INTENSITY} kgCO2/kWh): ${fastHigh.map((c) => `${c} (${CITY_DATA[c].intensity.toFixed(2)})`).join(", ")}.`
    });
  }
  if (ecoHigh.length && eco.path.join("|") !== fast.path.join("|")) {
    steps.push({
      text: `Green route exposure: ${ecoHigh.map((c) => `${c} (${CITY_DATA[c].intensity.toFixed(2)})`).join(", ")}.`
    });
  }

  if (stressEdge) {
    steps.push({
      text: `Highest stress hop (latency per km): ${stressEdge.from}–${stressEdge.to} (${stressEdge.latencyMs} ms over ${stressEdge.distanceKm} km).`
    });
  } else if (signals) {
    steps.push({
      text: `Aggregate hop stress from edge metrics: ${signals.hopCount} hops, ${signals.totalLatencyMs} ms total modeled latency.`
    });
  }

  const shared = fast.path.filter((n) => eco.path.includes(n));
  if (shared.length && fast.path.join("|") !== eco.path.join("|")) {
    steps.push({ text: `Shared hubs between routes: ${[...new Set(shared)].join(", ")}.` });
  }

  return steps;
}

function highlightInsightText(text: string) {
  const tokens = text.split(/(\d+(?:\.\d+)?(?:\s*(?:ms|g|kgCO2\/kWh|%))?)/g);
  return tokens.map((part, i) => {
    if (/^\d/.test(part.trim())) {
      return (
        <span key={`n-${i}`} className="text-cyan-200/95">
          {part}
        </span>
      );
    }
    if (part.includes("High carbon")) {
      return (
        <span key={`h-${i}`} className="text-rose-300/95">
          {part}
        </span>
      );
    }
    return <span key={`t-${i}`}>{part}</span>;
  });
}

export default function DecisionIntelligencePage() {
  const { source, destination, routes, hasCorridorSelection } = useRoutePlanning();
  const [mode, setMode] = useState<Mode>("eco");
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [typedChars, setTypedChars] = useState(0);

  const activeRoute = useMemo(() => (routes ? activeRouteForMode(routes, mode) : null), [routes, mode]);

  const signals = useMemo(() => (activeRoute?.path.length ? derivePathSignals(activeRoute.path) : null), [activeRoute?.path]);

  const segments = useMemo(() => (activeRoute?.path.length ? getPathEdgeSegments(activeRoute.path) : []), [activeRoute?.path]);

  const networkConditions = useMemo(() => {
    if (!signals) {
      return { trafficLoad: 0, congestion: 0, nodeHealth: 0 };
    }
    return {
      trafficLoad: signals.trafficLoadPct,
      congestion: signals.congestionPct,
      nodeHealth: signals.nodeHealthPct
    };
  }, [signals]);

  const routeSelectionReasons = useMemo(() => {
    if (!routes?.fast.path.length || !routes.eco.path.length) {
      return ["Select two cities to compare fast vs green routes."];
    }
    return buildSelectionReasonLines(mode, routes.fast, routes.eco, routes.balanced);
  }, [routes, mode]);

  const analysisSteps = useMemo(() => {
    if (!routes) return [{ text: "Choose source and destination to load route intelligence." }];
    return buildInsightSteps(routes.fast, routes.eco, signals, signals?.maxStressEdge ?? null);
  }, [routes, signals]);

  useEffect(() => {
    setVisibleSteps(0);
    setTypedChars(0);
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    for (let i = 0; i < analysisSteps.length; i += 1) {
      timers.push(setTimeout(() => setVisibleSteps((prev) => Math.max(prev, i + 1)), i * 700));
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, [analysisSteps, source, destination, mode]);

  useEffect(() => {
    const latest = analysisSteps[Math.max(0, visibleSteps - 1)]?.text ?? "";
    setTypedChars(0);
    if (!latest) return;
    const interval = setInterval(() => {
      setTypedChars((prev) => {
        if (prev >= latest.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 20);
    return () => clearInterval(interval);
  }, [analysisSteps, visibleSteps]);

  const carbonMapRows = useMemo(() => {
    if (!activeRoute?.path.length) return [];
    const cities = [...new Set(activeRoute.path)];
    return cities
      .map((city) => {
        const data = CITY_DATA[city];
        if (!data) return null;
        const intensity = data.intensity;
        const level = intensity >= 0.55 ? "High" : intensity >= 0.35 ? "Medium" : "Low";
        return { city, intensity, level };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => b.intensity - a.intensity);
  }, [activeRoute?.path]);

  const hasPair = Boolean(source && destination && source !== destination);

  if (!hasCorridorSelection) {
    return (
      <div className="py-6">
        <CorridorRequiredPlaceholder title="Set your corridor in Simulator" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <div className="glass-panel p-4">
          <div className="text-sm font-medium">Decision Intelligence</div>
          <div className="mt-1 text-xs text-slate-500">Signals for your saved corridor (set once in Simulator)</div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Corridor</div>
              <div className="mt-1 text-sm font-medium text-slate-100">
                {source} <span className="text-slate-500">→</span> {destination}
              </div>
              <Link to="/simulator" className="mt-2 inline-block text-xs text-cyan-300/90 underline-offset-2 hover:underline">
                Change in Simulator
              </Link>
            </div>

            <label className="grid gap-1">
              <span className="text-xs text-slate-400">Route preference</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="control-select">
                <option value="eco">Green (carbon)</option>
                <option value="balanced">Balanced</option>
                <option value="fast">Fast (latency)</option>
              </select>
            </label>

            <Link
              to="/impact"
              className="block w-full rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-2.5 text-center text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/18"
            >
              Continue to Impact →
            </Link>
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Live routing signals</div>
            <p className="mt-1 text-[11px] text-slate-500">Based on active path ({mode === "fast" ? "fast" : mode === "eco" ? "green" : "balanced"})</p>
            {!hasPair || !signals ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
                Select source and destination to populate signals.
              </div>
            ) : (
              <div className="mt-3 grid gap-2.5 text-sm">
                <div className="flex justify-between rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                  <span className="text-slate-400">End-to-end latency</span>
                  <span className="font-medium text-slate-100">{activeRoute?.latency ?? 0} ms</span>
                </div>
                <div className="flex justify-between rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                  <span className="text-slate-400">Path carbon (modeled)</span>
                  <span className="font-medium text-slate-100">{activeRoute?.carbon ?? 0} g</span>
                </div>
                <div className="flex justify-between rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                  <span className="text-slate-400">Mean grid intensity (path)</span>
                  <span className="font-medium text-slate-100">{signals.pathAvgIntensityKgPerKwh.toFixed(2)} kgCO2/kWh</span>
                </div>
                <div className="flex justify-between rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                  <span className="text-slate-400">Congestion index</span>
                  <span className="font-medium text-amber-200/90">{signals.congestionPct}%</span>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
                  {segments.length} hop{segments.length === 1 ? "" : "s"} · edge latency sum {signals.totalLatencyMs} ms · link carbon sum{" "}
                  {signals.totalEdgeCarbonG.toFixed(1)} g
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-8 grid gap-5">
        <div className="glass-panel border border-cyan-300/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-medium">Live Routing Insights</div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-200">
                <motion.span
                  className="h-2.5 w-2.5 rounded-full bg-emerald-300"
                  animate={{ opacity: [0.35, 1, 0.35], scale: [0.9, 1.2, 0.9] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                Routing Engine Active
              </div>
              <div className="flex items-center gap-1.5 text-emerald-200">
                <motion.span
                  className="h-2.5 w-2.5 rounded-full bg-emerald-300"
                  animate={{ opacity: [0.35, 1, 0.35], scale: [0.9, 1.2, 0.9] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.25 }}
                />
                CO2 Monitoring Live
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 text-xs text-slate-400">Decision Stream</div>
              <div className="grid gap-2">
                <AnimatePresence mode="popLayout">
                  {analysisSteps.slice(0, visibleSteps).map((step, index, arr) => {
                    const isLatest = index === arr.length - 1;
                    const rendered = isLatest ? step.text.slice(0, typedChars) : step.text;
                    return (
                      <motion.div
                        key={`${step.text}-${index}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.22 }}
                        className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                      >
                        {highlightInsightText(rendered)}
                        {isLatest ? (
                          <motion.span
                            className="ml-1 inline-block h-4 w-[2px] bg-cyan-200 align-middle"
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                          />
                        ) : null}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="glass-panel p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Route Selection Reason</div>
              <div className="mt-3 grid gap-2 text-sm text-slate-200">
                {routeSelectionReasons.map((reason, idx) => (
                  <div key={`${idx}-${reason.slice(0, 32)}`} className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 leading-snug">
                    {reason}
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Network Conditions</div>
              <p className="mt-1 text-[11px] text-slate-500">From active path edges & hubs only</p>
              {!hasPair || !signals ? (
                <div className="mt-3 text-xs text-slate-500">No path loaded.</div>
              ) : (
                <div className="mt-3 grid gap-3">
                  {[
                    { label: "Traffic load", value: networkConditions.trafficLoad, color: "bg-cyan-300" },
                    { label: "Congestion level", value: networkConditions.congestion, color: "bg-amber-300" },
                    { label: "Node health", value: networkConditions.nodeHealth, color: "bg-emerald-300" }
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                        <span>{item.label}</span>
                        <span>{item.value}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-900/70">
                        <motion.div
                          className={`h-2 rounded-full ${item.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${item.value}%` }}
                          transition={{ duration: 0.8 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Carbon Intensity Map</div>
              <p className="mt-1 text-[11px] text-slate-500">Cities on the active route — values from routing grid data</p>
              {!carbonMapRows.length ? (
                <div className="mt-3 text-xs text-slate-500">Select a valid route to see hubs.</div>
              ) : (
                <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1">
                  {carbonMapRows.map(({ city, intensity, level }) => {
                    const tone = level === "High" ? "text-rose-300" : level === "Medium" ? "text-amber-300" : "text-emerald-300";
                    return (
                      <div key={city} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm">
                        <div className="flex flex-col">
                          <span className="text-slate-100">{city}</span>
                          <span className="text-[10px] text-slate-500">{CITY_REGION[city] ?? "—"}</span>
                        </div>
                        <span className={tone}>
                          {level} · {intensity.toFixed(2)} kgCO2/kWh
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
