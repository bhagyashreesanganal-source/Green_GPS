import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { NODES } from "../data/nodes";
import { useRoutePlanning } from "../context/RoutePlanningContext";
import { recommendRoute } from "../lib/routeEngine";
import type { Mode, RouteResult } from "../types";
import RouteMap from "../components/RouteMap";

type DisplayMode = "eco" | "fast";

/** Map UI mode to eco vs fast for route selection */
function preferenceFromMode(m: Mode): DisplayMode {
  return m === "fast" ? "fast" : "eco";
}

export default function SimulatorPage() {
  const navigate = useNavigate();
  const { source, destination, setSource, setDestination, routes, hasCorridorSelection } = useRoutePlanning();
  const [mode, setMode] = useState<Mode>("eco");
  const [selectedRoute, setSelectedRoute] = useState<DisplayMode>("eco");
  const [preferenceAtRun, setPreferenceAtRun] = useState<DisplayMode | null>(null);

  const hasSelection = Boolean(source && destination);
  const routeVariants = useMemo<Array<{ id: DisplayMode; route: RouteResult }>>(() => {
    if (!routes) return [];
    return [
      { id: "eco", route: routes.eco },
      { id: "fast", route: routes.fast }
    ];
  }, [routes]);

  const activeRoute: RouteResult | undefined = routes ? routes[selectedRoute] : undefined;
  const co2Savings = routes && activeRoute ? Math.max(0, routes.fast.carbon - activeRoute.carbon) : 0;

  const recommendation = useMemo(() => (routes ? recommendRoute(routes.fast, routes.eco) : null), [routes]);

  useEffect(() => {
    if (!routes?.fast.path.length) return;
    const pref = preferenceFromMode(mode);
    setSelectedRoute(pref);
    setPreferenceAtRun(pref);
  }, [routes, mode]);

  function selectRouteView(m: DisplayMode) {
    setSelectedRoute(m);
    setMode(m === "fast" ? "fast" : "eco");
    setPreferenceAtRun(m);
  }

  const cardHeadline = selectedRoute === "fast" ? "Fast route" : "Green route";
  const cardSubline = useMemo(() => {
    if (!routes?.fast?.path.length || !routes?.eco?.path.length) return null;
    if (preferenceAtRun == null) return null;
    if (preferenceAtRun === selectedRoute) {
      return `Matches your preference (${preferenceAtRun === "fast" ? "latency" : "lower carbon"} priority).`;
    }
    return `You switched focus — last sync used ${preferenceAtRun === "fast" ? "Fast" : "Green"} priority.`;
  }, [routes, preferenceAtRun, selectedRoute]);

  const insightLine = recommendation?.reason ?? null;
  const alignedWithSuggestion =
    recommendation && routes && selectedRoute === recommendation.mode ? "Aligned with the automatic recommendation." : null;

  return (
    <section className="relative h-full">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_20%,rgba(39,219,255,0.14),transparent_40%),radial-gradient(circle_at_80%_90%,rgba(55,160,255,0.15),transparent_35%),radial-gradient(circle_at_10%_90%,rgba(48,229,150,0.1),transparent_35%)]" />
      </div>

      <div className="relative h-full rounded-3xl border border-white/10 bg-black/10 p-2 sm:p-3">
        <RouteMap
          routes={routeVariants}
          selectedMode={selectedRoute}
          onSelectMode={selectRouteView}
          source={source || null}
          destination={destination || null}
        />

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel absolute left-4 top-4 z-30 w-[300px] p-4 sm:w-[340px]"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-cyan-100">Routing Control</div>
            <div className="text-[11px] text-slate-400">Shared across pages</div>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
            Source and destination are stored for Simulator, Decision Intelligence, and Impact. Routes update when both cities are
            chosen and differ.
          </p>

          <div className="grid gap-2.5">
            <select value={source} onChange={(e) => setSource(e.target.value as (typeof NODES)[number] | "")} className="control-select">
              <option value="">Source: Select city</option>
              {NODES.map((node) => (
                <option key={node} value={node}>
                  Source: {node}
                </option>
              ))}
            </select>

            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value as (typeof NODES)[number] | "")}
              className="control-select"
            >
              <option value="">Destination: Select city</option>
              {NODES.map((node) => (
                <option key={node} value={node}>
                  Destination: {node}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-slate-950/45 p-1">
              {(["eco", "fast"] as DisplayMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m === "fast" ? "fast" : "eco")}
                  className={`rounded-lg px-2 py-1.5 text-xs transition ${
                    preferenceFromMode(mode) === m ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {m === "fast" ? "Fast" : "Green"}
                </button>
              ))}
            </div>

            {hasCorridorSelection ? (
              <button
                type="button"
                onClick={() => navigate("/intelligence")}
                className="mt-1 w-full rounded-xl border border-emerald-400/45 bg-emerald-400/10 px-3 py-2.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/18"
              >
                View analysis →
              </button>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">Pick two different cities to unlock analysis and impact.</p>
            )}
          </div>
        </motion.div>

        {activeRoute && hasSelection ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            key={`${selectedRoute}-${source}-${destination}-${activeRoute.path.join("→")}`}
            className="glass-panel absolute bottom-4 left-4 z-30 w-[min(100%,320px)] max-w-[calc(100%-2rem)] p-4"
          >
            <div
              className={`text-base font-semibold tracking-tight ${
                selectedRoute === "fast" ? "text-[#ff8a8a]" : "text-[#5effc4]"
              }`}
            >
              {cardHeadline}
              <span className="ml-2 text-xs font-normal uppercase tracking-[0.2em] text-slate-500">active</span>
            </div>

            {cardSubline ? <div className="mt-1.5 text-xs leading-snug text-slate-400">{cardSubline}</div> : null}

            {insightLine ? (
              <div className="mt-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-[11px] leading-relaxed text-slate-300">
                <span className="text-slate-500">Insight: </span>
                {insightLine}
              </div>
            ) : null}

            {alignedWithSuggestion ? <div className="mt-1.5 text-[11px] text-emerald-400/90">{alignedWithSuggestion}</div> : null}

            {activeRoute.message ? <div className="mt-2 text-xs text-amber-200/90">{activeRoute.message}</div> : null}

            <div className="mt-2 text-sm text-slate-200">
              {activeRoute.path.length ? activeRoute.path.join(" → ") : "—"}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-black/30 p-2">
                <div className="text-[11px] text-slate-400">Latency</div>
                <div className="text-sm font-semibold">{activeRoute.latency} ms</div>
              </div>
              <div className="rounded-lg bg-black/30 p-2">
                <div className="text-[11px] text-slate-400">Carbon</div>
                <div className="text-sm font-semibold">{activeRoute.carbon} g</div>
              </div>
              <div className="rounded-lg bg-black/30 p-2">
                <div className="text-[11px] text-slate-400">CO₂ vs view</div>
                <div className="text-sm font-semibold text-emerald-300">{co2Savings} g</div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}
