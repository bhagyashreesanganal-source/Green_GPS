import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRoutePlanning } from "../context/RoutePlanningContext";
import CorridorRequiredPlaceholder from "../components/CorridorRequiredPlaceholder";
import { deriveEnergyKwhFromPath, getPathCarbonGramsExact } from "../lib/routeEngine";

type ImpactMetrics = {
  fastCarbonG: number;
  ecoCarbonG: number;
  fastLatency: number;
  ecoLatency: number;
  energyFastKwh: number;
  energyEcoKwh: number;
};

function useCountUp(target: number, durationMs = 1200) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

function ImpactCard(props: {
  label: string;
  value: number;
  suffix: string;
  color: "green" | "red" | "cyan";
  decimals?: number;
  detail: string;
}) {
  const display = useCountUp(props.value, 1200);
  const isGreen = props.color === "green";
  const isCyan = props.color === "cyan";

  const glow = isGreen
    ? "0 0 16px rgba(52,211,153,0.14)"
    : isCyan
      ? "0 0 16px rgba(34,211,238,0.12)"
      : "0 0 16px rgba(251,113,133,0.1)";

  const dec = props.decimals ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.03 }}
      transition={{ duration: 0.3 }}
      className="glass-panel border-white/15 p-4 sm:p-[18px]"
      style={{
        boxShadow: `0 10px 28px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03), ${glow}`
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{props.label}</div>
      <motion.div
        className={`mt-2 text-3xl font-semibold tracking-tight sm:text-[2.2rem] ${
          isGreen ? "text-emerald-300" : isCyan ? "text-cyan-300" : "text-rose-300"
        }`}
        animate={{ opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
        style={{
          filter: isGreen
            ? "drop-shadow(0 0 12px rgba(52,211,153,0.7))"
            : isCyan
              ? "drop-shadow(0 0 12px rgba(34,211,238,0.55))"
              : "drop-shadow(0 0 12px rgba(251,113,133,0.7))"
        }}
      >
        {display.toFixed(dec)}
        {props.suffix}
      </motion.div>
      <div className="mt-1 text-xs text-slate-400">{props.detail}</div>
    </motion.div>
  );
}

export default function ImpactPage() {
  const { source, destination, routes, hasComparableRoutes, hasCorridorSelection } = useRoutePlanning();

  const metrics: ImpactMetrics | null = useMemo(() => {
    if (!routes?.fast.path.length || !routes.eco.path.length || !hasComparableRoutes) return null;
    const fast = routes.fast;
    const eco = routes.eco;
    return {
      fastCarbonG: getPathCarbonGramsExact(fast.path),
      ecoCarbonG: getPathCarbonGramsExact(eco.path),
      fastLatency: fast.latency,
      ecoLatency: eco.latency,
      energyFastKwh: deriveEnergyKwhFromPath(fast.path),
      energyEcoKwh: deriveEnergyKwhFromPath(eco.path)
    };
  }, [routes, hasComparableRoutes]);

  /** Positive = green route has lower modeled carbon than fast */
  const carbonSavedG = useMemo(() => (metrics ? metrics.fastCarbonG - metrics.ecoCarbonG : 0), [metrics]);
  /** Positive = green path uses less modeled energy */
  const energySavedKwh = useMemo(() => (metrics ? metrics.energyFastKwh - metrics.energyEcoKwh : 0), [metrics]);
  const latencyImpactGreenVsFast = useMemo(
    () => (metrics ? metrics.ecoLatency - metrics.fastLatency : 0),
    [metrics]
  );
  /** Positive % = green path lower carbon than fast (same formula as engine, unrounded inputs) */
  const efficiencyGainPct = useMemo(() => {
    if (!metrics || metrics.fastCarbonG <= 0) return 0;
    return (1 - metrics.ecoCarbonG / metrics.fastCarbonG) * 100;
  }, [metrics]);

  const co2SavedPct = useMemo(() => {
    if (!metrics || metrics.fastCarbonG <= 0) return 0;
    return carbonSavedG / metrics.fastCarbonG;
  }, [metrics, carbonSavedG]);

  const routeLabel = source && destination ? `${source} → ${destination}` : "No corridor selected";

  if (!hasCorridorSelection) {
    return (
      <section className="mx-auto max-w-4xl py-6">
        <CorridorRequiredPlaceholder title="Impact needs a corridor" />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5 pb-4">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="text-center sm:text-left"
      >
        <div className="text-xs uppercase tracking-[0.26em] text-slate-400">Impact Overview</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">Routing Outcomes Dashboard</h2>
        <p className="mt-2 text-sm text-slate-400">
          Values use the same graph edges and hub weights as the simulator: carbon is summed per hop without per-hop rounding; energy is a
          deterministic function of hop carbon and distance.
        </p>
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
          <span className="text-slate-500">Active corridor: </span>
          <span className="font-medium text-slate-200">{routeLabel}</span>
        </div>
      </motion.div>

      {!metrics ? (
        <div className="glass-panel border-amber-300/20 p-6 text-sm text-slate-300">
          <p className="font-medium text-amber-200/90">No comparable routes yet</p>
          <p className="mt-2 text-slate-400">
            Choose two different cities in the <span className="text-cyan-200/90">Simulator</span>. Metrics update from the same fast and
            green paths as everywhere else.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-500">
            Raw inputs: Fast {metrics.fastCarbonG.toFixed(2)} g CO₂ · {metrics.fastLatency} ms · {metrics.energyFastKwh.toFixed(3)} kWh — Green{" "}
            {metrics.ecoCarbonG.toFixed(2)} g · {metrics.ecoLatency} ms · {metrics.energyEcoKwh.toFixed(3)} kWh
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ImpactCard
              label="CO₂ advantage (Fast − Green)"
              value={carbonSavedG}
              suffix=" g"
              color={carbonSavedG >= 0 ? "green" : "red"}
              decimals={2}
              detail="Unrounded sum of hop carbon (edge + hub weight), same model as routing"
            />
            <ImpactCard
              label="Energy advantage (Fast − Green)"
              value={energySavedKwh}
              suffix=" kWh"
              color={energySavedKwh >= 0 ? "green" : "red"}
              decimals={3}
              detail="From hop carbon × scale + distance × intensity per edge"
            />
            <ImpactCard
              label="Latency (Green − Fast)"
              value={latencyImpactGreenVsFast}
              suffix=" ms"
              color={latencyImpactGreenVsFast > 0 ? "red" : latencyImpactGreenVsFast < 0 ? "cyan" : "green"}
              decimals={0}
              detail="Sum of edge latencies on each path (integer ms from engine)"
            />
            <ImpactCard
              label="Carbon efficiency (vs fast)"
              value={efficiencyGainPct}
              suffix="%"
              color={efficiencyGainPct >= 0 ? "green" : "red"}
              decimals={2}
              detail="(1 − Green/Fast) × 100 using exact path carbon totals"
            />
          </div>
        </>
      )}

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="glass-panel p-4"
      >
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Summary Insights</div>
        {!metrics ? (
          <p className="mt-3 text-sm text-slate-500">Select a valid corridor in the Simulator to generate insights.</p>
        ) : (
          <div className="mt-3 grid gap-2 text-sm text-slate-200">
            <div>
              {carbonSavedG >= 0
                ? `Green route avoids about ${carbonSavedG.toFixed(2)} g CO₂ vs fast (${(co2SavedPct * 100).toFixed(1)}% lower than fast path carbon).`
                : `Green route adds about ${Math.abs(carbonSavedG).toFixed(2)} g CO₂ vs fast on this corridor (green path not cleaner here).`}
            </div>
            <div>
              {energySavedKwh >= 0
                ? `Modeled energy drops by ${energySavedKwh.toFixed(3)} kWh when choosing green (fast ${metrics.energyFastKwh.toFixed(3)} → green ${metrics.energyEcoKwh.toFixed(3)} kWh).`
                : `Green uses ${Math.abs(energySavedKwh).toFixed(3)} kWh more than fast for this topology.`}
            </div>
            <div>
              {latencyImpactGreenVsFast === 0
                ? "Latency is identical for both routes on this corridor."
                : latencyImpactGreenVsFast > 0
                  ? `Green adds ${latencyImpactGreenVsFast.toFixed(0)} ms vs fast (${metrics.ecoLatency} ms vs ${metrics.fastLatency} ms).`
                  : `Green saves ${Math.abs(latencyImpactGreenVsFast).toFixed(0)} ms vs fast.`}
            </div>
            <div>
              {efficiencyGainPct >= 0
                ? `Carbon efficiency vs fast: +${efficiencyGainPct.toFixed(2)}% (lower is better for green).`
                : `Carbon efficiency vs fast: ${efficiencyGainPct.toFixed(2)}% (green path higher carbon than fast).`}
            </div>
          </div>
        )}
      </motion.div>
    </section>
  );
}
