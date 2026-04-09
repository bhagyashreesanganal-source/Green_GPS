import { useMemo, useState } from "react";
import { geoMercator } from "d3-geo";
import { motion } from "framer-motion";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { CITY_DATA } from "../lib/routeEngine";
import type { RouteResult } from "../types";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const WIDTH = 1100;
const HEIGHT = 620;
const SCALE = 178;
/** Center meridian / latitude so all nine cities sit on the visible world map naturally */
const CENTER: [number, number] = [20, 18];

const COLOR_FAST = "#ff4d4d";
const COLOR_GREEN = "#00ff9f";

type RouteMode = "eco" | "fast";

export type RouteVariant = { id: RouteMode; route: RouteResult };

type Props = {
  routes: RouteVariant[];
  selectedMode: RouteMode;
  onSelectMode: (mode: RouteMode) => void;
  source: string | null;
  destination: string | null;
};

function uniqueRoute(nodes: string[]) {
  const out: string[] = [];
  for (const node of nodes) {
    if (!CITY_DATA[node]) continue;
    if (out[out.length - 1] !== node) out.push(node);
  }
  return out;
}

/** Offset polyline perpendicular to each segment so the two routes stay visually separated. */
function offsetProjectedPoints(pts: [number, number][], offset: number): [number, number][] {
  if (pts.length < 2) return pts;
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i += 1) {
    let nx = 0;
    let ny = 0;
    if (i === 0) {
      const dx = pts[1][0] - pts[0][0];
      const dy = pts[1][1] - pts[0][1];
      const len = Math.hypot(dx, dy) || 1;
      nx = -dy / len;
      ny = dx / len;
    } else if (i === pts.length - 1) {
      const dx = pts[i][0] - pts[i - 1][0];
      const dy = pts[i][1] - pts[i - 1][1];
      const len = Math.hypot(dx, dy) || 1;
      nx = -dy / len;
      ny = dx / len;
    } else {
      const dx1 = pts[i][0] - pts[i - 1][0];
      const dy1 = pts[i][1] - pts[i - 1][1];
      const len1 = Math.hypot(dx1, dy1) || 1;
      const n1x = -dy1 / len1;
      const n1y = dx1 / len1;
      const dx2 = pts[i + 1][0] - pts[i][0];
      const dy2 = pts[i + 1][1] - pts[i][1];
      const len2 = Math.hypot(dx2, dy2) || 1;
      const n2x = -dy2 / len2;
      const n2y = dx2 / len2;
      nx = n1x + n2x;
      ny = n1y + n2y;
      const nlen = Math.hypot(nx, ny) || 1;
      nx /= nlen;
      ny /= nlen;
    }
    out.push([pts[i][0] + offset * nx, pts[i][1] + offset * ny]);
  }
  return out;
}

/** Smooth quadratic Bézier per hop — single control point, clean arcs following geography. */
function buildSmoothPath(
  nodes: string[],
  projection: ReturnType<typeof geoMercator>,
  lateralOffset: number,
  arcLift: number
) {
  const raw = nodes
    .map((n) => projection(CITY_DATA[n].coordinates))
    .filter((p): p is [number, number] => Boolean(p))
    .map((p) => [p[0], p[1]] as [number, number]);

  if (raw.length < 2) return "";
  const pts = offsetProjectedPoints(raw, lateralOffset);

  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i += 1) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const mx = (p0[0] + p1[0]) / 2 + nx * arcLift;
    const my = (p0[1] + p1[1]) / 2 + ny * arcLift;
    d += ` Q ${mx} ${my} ${p1[0]} ${p1[1]}`;
  }
  return d;
}

export default function RouteMap({ routes, selectedMode, onSelectMode, source, destination }: Props) {
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [hoveredRoute, setHoveredRoute] = useState<RouteMode | null>(null);

  const projection = useMemo(() => geoMercator().scale(SCALE).center(CENTER).translate([WIDTH / 2, HEIGHT / 2]), []);

  const fastRoute = routes.find((r) => r.id === "fast")?.route;
  const ecoRoute = routes.find((r) => r.id === "eco")?.route;

  const fastNodes = useMemo(() => uniqueRoute(fastRoute?.path ?? []), [fastRoute?.path]);
  const ecoNodes = useMemo(() => uniqueRoute(ecoRoute?.path ?? []), [ecoRoute?.path]);

  const canDraw =
    Boolean(source && destination && source !== destination && CITY_DATA[source] && CITY_DATA[destination]) &&
    routes.length > 0 &&
    fastNodes.length >= 2 &&
    ecoNodes.length >= 2;

  const fastPath = useMemo(
    () => (canDraw ? buildSmoothPath(fastNodes, projection, 14, -38) : ""),
    [canDraw, fastNodes, projection]
  );
  const ecoPath = useMemo(
    () => (canDraw ? buildSmoothPath(ecoNodes, projection, -14, 42) : ""),
    [canDraw, ecoNodes, projection]
  );

  const pathKeys = useMemo(
    () => ({ fast: fastNodes.join("|"), eco: ecoNodes.join("|") }),
    [fastNodes, ecoNodes]
  );

  const activeRoute = hoveredRoute ?? selectedMode;

  const projectedCities = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    Object.entries(CITY_DATA).forEach(([name, data]) => {
      const p = projection(data.coordinates);
      if (p) out[name] = p as [number, number];
    });
    return out;
  }, [projection]);

  return (
    <div className="relative h-full min-h-[540px] w-full overflow-hidden rounded-3xl border border-white/10 bg-black/30">
      <div className="map-stars absolute inset-0 opacity-70" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(160,160,160,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(160,160,160,0.06)_1px,transparent_1px)] bg-[size:34px_34px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.08),transparent_42%),radial-gradient(circle_at_80%_18%,rgba(255,255,255,0.07),transparent_38%),radial-gradient(circle_at_50%_80%,rgba(0,255,159,0.08),transparent_42%)]" />

      <ComposableMap width={WIDTH} height={HEIGHT} projection="geoMercator" projectionConfig={{ scale: SCALE, center: CENTER }} className="relative z-10 h-full w-full">
        <defs>
          <linearGradient id="land-shade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1f2229" />
            <stop offset="0.55" stopColor="#11141b" />
            <stop offset="1" stopColor="#090b10" />
          </linearGradient>
          <filter id="land-depth" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.2" floodColor="#000000" floodOpacity="0.75" />
          </filter>
        </defs>
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="url(#land-shade)"
                stroke="#343944"
                strokeWidth={0.5}
                filter="url(#land-depth)"
                style={{ default: { outline: "none" }, hover: { outline: "none" }, pressed: { outline: "none" } }}
              />
            ))
          }
        </Geographies>
      </ComposableMap>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="absolute inset-0 z-20 h-full w-full">
        <defs>
          <filter id="glow-fast-strong" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-fast-faint" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-eco-strong" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-eco-faint" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {canDraw ? (
          <>
            <motion.path
              key={`fast-${pathKeys.fast}`}
              d={fastPath}
              fill="none"
              stroke={COLOR_FAST}
              strokeWidth={activeRoute === "fast" ? 4.2 : 2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="cursor-pointer pointer-events-auto"
              filter={activeRoute === "fast" ? "url(#glow-fast-strong)" : "url(#glow-fast-faint)"}
              opacity={activeRoute === "fast" ? 1 : 0.14}
              onMouseEnter={() => setHoveredRoute("fast")}
              onMouseLeave={() => setHoveredRoute(null)}
              onClick={() => onSelectMode("fast")}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: activeRoute === "fast" ? 1 : 0.14
              }}
              transition={{ pathLength: { duration: 0.85, ease: "easeOut" }, opacity: { duration: 0.35 } }}
            />

            <motion.path
              key={`eco-${pathKeys.eco}`}
              d={ecoPath}
              fill="none"
              stroke={COLOR_GREEN}
              strokeWidth={activeRoute === "eco" ? 4.4 : 2.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="cursor-pointer pointer-events-auto"
              filter={activeRoute === "eco" ? "url(#glow-eco-strong)" : "url(#glow-eco-faint)"}
              opacity={activeRoute === "eco" ? 1 : 0.14}
              onMouseEnter={() => setHoveredRoute("eco")}
              onMouseLeave={() => setHoveredRoute(null)}
              onClick={() => onSelectMode("eco")}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: activeRoute === "eco" ? 1 : 0.14
              }}
              transition={{ pathLength: { duration: 0.85, ease: "easeOut" }, opacity: { duration: 0.35 } }}
            />

            {[0, 1, 2].map((p) => (
              <circle
                key={`fast-p-${pathKeys.fast}-${p}`}
                r={3}
                fill={COLOR_FAST}
                opacity={activeRoute === "fast" ? 0.92 - p * 0.22 : 0.12}
                className="pointer-events-none"
              >
                <animateMotion dur={`${1.85 + p * 0.28}s`} begin={`${p * 0.25}s`} repeatCount="indefinite" path={fastPath} />
              </circle>
            ))}
            {[0, 1, 2, 3].map((p) => (
              <circle
                key={`eco-p-${pathKeys.eco}-${p}`}
                r={3.2}
                fill={COLOR_GREEN}
                opacity={activeRoute === "eco" ? 0.9 - p * 0.18 : 0.12}
                className="pointer-events-none"
              >
                <animateMotion dur={`${3.4 + p * 0.45}s`} begin={`${p * 0.5}s`} repeatCount="indefinite" path={ecoPath} />
              </circle>
            ))}
          </>
        ) : null}

        {Object.entries(projectedCities).map(([name, point]) => (
          <g key={name} className="pointer-events-auto" onMouseEnter={() => setHoveredCity(name)} onMouseLeave={() => setHoveredCity(null)}>
            <motion.circle
              cx={point[0]}
              cy={point[1]}
              r={5}
              fill="#eef7ff"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.7, repeat: Infinity }}
              style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.85))" }}
            />
            <text x={point[0] + 8} y={point[1] - 6} className="fill-white/85 text-[11px] tracking-wide">
              {name}
            </text>
          </g>
        ))}
      </svg>

      {hoveredCity ? (
        <div className="glass-panel absolute left-5 top-5 z-30 min-w-44 p-3 text-xs text-slate-200">
          <div className="font-medium text-white">{hoveredCity}</div>
          <div className="mt-1 text-slate-300">
            Carbon intensity: <span className="text-emerald-300">{CITY_DATA[hoveredCity].intensity.toFixed(2)} kgCO2/kWh</span>
          </div>
        </div>
      ) : null}

      {canDraw ? (
        <div className="absolute bottom-5 right-5 z-30 flex gap-2">
          <button
            type="button"
            onClick={() => onSelectMode("eco")}
            className={`glass-panel px-3 py-1.5 text-xs transition ${selectedMode === "eco" ? "border-white/35 text-white" : "text-slate-300"}`}
            style={selectedMode === "eco" ? { boxShadow: `0 0 18px ${COLOR_GREEN}99` } : undefined}
          >
            Green
          </button>
          <button
            type="button"
            onClick={() => onSelectMode("fast")}
            className={`glass-panel px-3 py-1.5 text-xs transition ${selectedMode === "fast" ? "border-white/35 text-white" : "text-slate-300"}`}
            style={selectedMode === "fast" ? { boxShadow: `0 0 18px ${COLOR_FAST}99` } : undefined}
          >
            Fast
          </button>
        </div>
      ) : null}
    </div>
  );
}
