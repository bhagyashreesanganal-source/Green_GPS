import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { RoutePlanningProvider } from "./ui/context/RoutePlanningContext";
import App from "./ui/App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RoutePlanningProvider>
        <App />
      </RoutePlanningProvider>
    </BrowserRouter>
  </React.StrictMode>
);

