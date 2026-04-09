export type Mode = "eco" | "balanced" | "fast";

export type RouteResult = {
  path: string[];
  latency: number;
  carbon: number;
  cost: number;
  message?: string;
};

export type CompareResponse = {
  routes: Record<Mode, RouteResult>;
};

