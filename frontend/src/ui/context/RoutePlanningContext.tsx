import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { NODES } from "../data/nodes";
import { computeRoutes } from "../lib/routeEngine";
import type { CompareResponse } from "../types";

export type NodeValue = (typeof NODES)[number] | "";

type RoutePlanningContextValue = {
  source: NodeValue;
  destination: NodeValue;
  setSource: (v: NodeValue) => void;
  setDestination: (v: NodeValue) => void;
  /** Same `computeRoutes` output used app-wide; updates when source/destination change */
  routes: CompareResponse["routes"] | null;
  /** True when fast and green paths exist with at least one hop (comparable metrics) */
  hasComparableRoutes: boolean;
  /** Two distinct cities chosen — guided flow can proceed past Simulator */
  hasCorridorSelection: boolean;
};

const RoutePlanningContext = createContext<RoutePlanningContextValue | null>(null);

export function RoutePlanningProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<NodeValue>("");
  const [destination, setDestination] = useState<NodeValue>("");

  const routes = useMemo(() => {
    if (!source || !destination || source === destination) return null;
    return computeRoutes(source, destination);
  }, [source, destination]);

  const hasComparableRoutes = useMemo(() => {
    if (!routes) return false;
    return routes.fast.path.length >= 2 && routes.eco.path.length >= 2;
  }, [routes]);

  const hasCorridorSelection = Boolean(source && destination && source !== destination);

  const value = useMemo(
    () => ({
      source,
      destination,
      setSource,
      setDestination,
      routes,
      hasComparableRoutes,
      hasCorridorSelection
    }),
    [source, destination, routes, hasComparableRoutes, hasCorridorSelection]
  );

  return <RoutePlanningContext.Provider value={value}>{children}</RoutePlanningContext.Provider>;
}

export function useRoutePlanning(): RoutePlanningContextValue {
  const ctx = useContext(RoutePlanningContext);
  if (!ctx) {
    throw new Error("useRoutePlanning must be used within RoutePlanningProvider");
  }
  return ctx;
}
