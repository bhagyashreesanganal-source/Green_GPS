import { Route, Routes } from "react-router-dom";
import Nav from "./components/Nav";
import GuidedFlowStepper from "./components/GuidedFlowStepper";
import HomePage from "./pages/HomePage";
import SimulatorPage from "./pages/SimulatorPage";
import DecisionIntelligencePage from "./pages/DecisionIntelligencePage";
import ImpactPage from "./pages/ImpactPage";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-night text-slate-100">
      <Nav />
      <GuidedFlowStepper />
      <main className="relative z-10 min-h-0 flex-1 overflow-auto px-4 pb-4 sm:px-6 sm:pb-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/intelligence" element={<DecisionIntelligencePage />} />
          <Route path="/impact" element={<ImpactPage />} />
        </Routes>
      </main>
    </div>
  );
}

