import type { CompareResponse, Mode, RouteResult } from "./types";

export type RouteRequest = {
  source: string;
  destination: string;
  mode: Mode;
  compare: boolean;
  alpha?: number;
  beta?: number;
};

export async function postRoute(req: RouteRequest): Promise<RouteResult | CompareResponse> {
  const res = await fetch("/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const detail = await safeDetail(res);
    throw new Error(detail || "Request failed");
  }
  return (await res.json()) as RouteResult | CompareResponse;
}

async function safeDetail(res: Response): Promise<string | null> {
  try {
    const data = (await res.json()) as any;
    if (typeof data?.detail === "string") return data.detail;
  } catch {
    // ignore
  }
  return null;
}

