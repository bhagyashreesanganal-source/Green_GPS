import { Link, useLocation } from "react-router-dom";

const STEPS = [
  { to: "/simulator", num: 1, label: "Simulator", hint: "Choose corridor" },
  { to: "/intelligence", num: 2, label: "Analysis", hint: "Decision intelligence" },
  { to: "/impact", num: 3, label: "Impact", hint: "Outcomes" }
] as const;

export default function GuidedFlowStepper() {
  const { pathname } = useLocation();

  return (
    <div className="border-b border-white/10 bg-black/20 px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Guided flow</div>
        <nav aria-label="Analysis workflow steps" className="flex flex-wrap items-center gap-2 sm:gap-0">
          {STEPS.map((step, i) => {
            const active = pathname === step.to;
            const past =
              (step.to === "/simulator" && (pathname === "/intelligence" || pathname === "/impact")) ||
              (step.to === "/intelligence" && pathname === "/impact");

            return (
              <div key={step.to} className="flex items-center">
                {i > 0 ? <span className="mx-1 hidden text-slate-600 sm:inline" aria-hidden="true">→</span> : null}
                <Link
                  to={step.to}
                  className={`group flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition sm:px-3 ${
                    active
                      ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
                      : past
                        ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-200/90 hover:border-emerald-400/40"
                        : "border-white/10 bg-slate-950/40 text-slate-400 hover:border-white/20 hover:text-slate-200"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      active ? "bg-cyan-400/25 text-cyan-100" : past ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-400"
                    }`}
                  >
                    {step.num}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium leading-tight">{step.label}</span>
                    <span className="hidden text-[10px] text-slate-500 sm:block">{step.hint}</span>
                  </span>
                </Link>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
