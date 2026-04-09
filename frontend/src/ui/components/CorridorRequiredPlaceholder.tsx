import { Link } from "react-router-dom";
import { motion } from "framer-motion";

type Props = {
  title?: string;
};

export default function CorridorRequiredPlaceholder({ title = "Corridor not set yet" }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel mx-auto max-w-lg border border-amber-300/25 p-8 text-center"
    >
      <div className="text-sm font-semibold text-amber-200/95">{title}</div>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        Please select a <span className="text-slate-300">source</span> and <span className="text-slate-300">destination</span> in the
        Simulator first. Your choice is saved for all steps and will not reset when you navigate.
      </p>
      <Link
        to="/simulator"
        className="mt-6 inline-flex items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-5 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20"
      >
        Go to Simulator
      </Link>
    </motion.div>
  );
}
