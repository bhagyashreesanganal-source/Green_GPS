import type { ReactNode } from "react";

export default function StatCard(props: {
  title: string;
  value: ReactNode;
  sub?: string;
  tone?: "emerald" | "cyan" | "red" | "slate";
}) {
  const tone = props.tone ?? "slate";
  const toneClasses =
    tone === "emerald"
      ? "border-emerald-400/30 bg-emerald-400/5"
      : tone === "cyan"
        ? "border-cyan-400/30 bg-cyan-400/5"
        : tone === "red"
          ? "border-rose-400/30 bg-rose-400/5"
          : "border-slate-700/60 bg-slate-900/30";

  return (
    <div className={`rounded-2xl border ${toneClasses} p-4`}>
      <div className="text-xs text-slate-400">{props.title}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{props.value}</div>
      {props.sub ? <div className="mt-1 text-xs text-slate-500">{props.sub}</div> : null}
    </div>
  );
}

