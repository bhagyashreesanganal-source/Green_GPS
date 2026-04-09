import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const FEATURES = [
  {
    icon: "🌱",
    title: "Eco Routing",
    description: "Continuously favors lower-carbon network paths with intelligent hop selection."
  },
  {
    icon: "⚡",
    title: "Fast vs Green Comparison",
    description: "Visualize trade-offs instantly between latency-focused and sustainability-focused routes."
  },
  {
    icon: "🌍",
    title: "Real-time Impact",
    description: "Track emissions, energy savings, and route efficiency as decisions update live."
  }
];

export default function HomePage() {
  return (
    <section className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="landing-ambient absolute inset-0" />
      </div>

      <div className="relative min-h-[calc(100vh-96px)] overflow-hidden rounded-3xl border border-white/10 bg-black/20">
        <div className="network-overlay absolute inset-0 opacity-90" />

        <svg viewBox="0 0 1200 720" className="pointer-events-none absolute inset-0 h-full w-full opacity-70">
          <defs>
            <linearGradient id="hero-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(52,211,153,0)" />
              <stop offset="45%" stopColor="rgba(52,211,153,0.65)" />
              <stop offset="100%" stopColor="rgba(59,130,246,0)" />
            </linearGradient>
          </defs>
          <path d="M120 520 Q 360 390 560 430 T 1040 290" stroke="url(#hero-line)" strokeWidth="2.5" fill="none" />
          <path d="M120 250 Q 360 180 600 220 T 1080 170" stroke="url(#hero-line)" strokeWidth="2.2" fill="none" opacity="0.55" />
          <circle cx="280" cy="450" r="5" fill="#34d399" className="pulse-dot" />
          <circle cx="560" cy="430" r="5" fill="#34d399" className="pulse-dot" />
          <circle cx="840" cy="340" r="5" fill="#34d399" className="pulse-dot" />
        </svg>

        <div className="relative z-10 flex min-h-[calc(100vh-96px)] flex-col">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-10 text-center"
          >
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="mx-auto max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl"
            >
              Route the Internet. <span className="text-emerald-300">Reduce Carbon.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18 }}
              className="mx-auto mt-5 max-w-2xl text-base text-slate-300 sm:text-lg"
            >
              Green GPS intelligently chooses eco-friendly internet paths.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.26 }}
              className="mt-8"
            >
              <Link
                to="/simulator"
                className="inline-flex items-center rounded-full border border-emerald-300/60 bg-emerald-300/15 px-8 py-3 text-sm font-medium text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.4)] transition hover:scale-105 hover:bg-emerald-300/25 hover:shadow-[0_0_34px_rgba(52,211,153,0.6)]"
              >
                Start Routing
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-4 pb-4 md:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.35, delay: index * 0.08 }}
            whileHover={{ y: -5, scale: 1.01 }}
            className="glass-panel border-white/15 p-5"
          >
            <div className="text-2xl">{feature.icon}</div>
            <div className="mt-3 text-lg font-medium text-slate-100">{feature.title}</div>
            <div className="mt-2 text-sm leading-relaxed text-slate-300">{feature.description}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
