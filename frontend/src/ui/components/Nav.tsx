import { NavLink } from "react-router-dom";

const linkBase =
  "px-3 py-2 rounded-full text-xs sm:text-sm transition border border-white/10 hover:border-cyan-300/40 hover:bg-cyan-300/10";

export default function Nav() {
  return (
    <div className="relative z-20 flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 overflow-hidden rounded-xl border border-emerald-300/60 bg-emerald-300/20 shadow-glow animate-floaty">
          <img src="/green-gps-logo.png" alt="Green GPS logo" className="h-full w-full object-cover" />
        </div>
        <div>
          <div className="text-lg font-semibold tracking-tight">Green GPS</div>
          <div className="text-xs text-slate-400">Real-time eco-aware internet routing simulator</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="glass-panel hidden items-center gap-2 px-3 py-2 text-xs text-slate-200 md:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(74,222,128,0.95)]" />
          <span className="tracking-wide">Routing Engine: ACTIVE</span>
        </div>
        <div className="glass-panel flex items-center gap-2 p-1.5">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100" : "text-slate-300"}`
          }
          end
        >
          Home
        </NavLink>
        <NavLink
          to="/simulator"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100" : "text-slate-300"}`
          }
        >
          Simulator
        </NavLink>
        <NavLink
          to="/intelligence"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100" : "text-slate-300"}`
          }
        >
          Decision Intelligence
        </NavLink>
        <NavLink
          to="/impact"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100" : "text-slate-300"}`
          }
        >
          Impact
        </NavLink>
        </div>
      </div>
    </div>
  );
}

