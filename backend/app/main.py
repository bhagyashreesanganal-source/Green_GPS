from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import json

# ---- PATHS ----
ROOT = Path(__file__).resolve().parents[2]
SHARED = ROOT / "shared"
GRAPH_PATH = SHARED / "graph.json"

ENGINE_PATH = ROOT / "engine" / "green_dijkstra"  # your compiled engine binary

if not ENGINE_PATH.exists():
    raise RuntimeError(f"Engine binary not found at {ENGINE_PATH}. Compile main.cpp first.")

# ---- LOGGING ----
def _setup_logging() -> None:
    logs_dir = ROOT / "backend" / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(
        logs_dir / "app.log",
        maxBytes=512_000,
        backupCount=3,
        encoding="utf-8",
    )
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    handler.setFormatter(fmt)
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(handler)

_setup_logging()
log = logging.getLogger("greengps")

# ---- LOAD GRAPH NODES ----
def load_graph_nodes(graph_path: Path) -> set:
    if not graph_path.exists():
        raise RuntimeError(f"Graph JSON not found at {graph_path}")
    with open(graph_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return set(data.get("nodes", []))

graph_nodes = load_graph_nodes(GRAPH_PATH)

# ---- FASTAPI APP ----
app = FastAPI(title="Green GPS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- SCHEMAS ----
from pydantic import BaseModel
from typing import Optional, List, Dict

class RouteRequest(BaseModel):
    source: str
    destination: str
    mode: str = "eco"
    alpha: Optional[float] = None
    beta: Optional[float] = None
    compare: Optional[bool] = False

class RouteResult(BaseModel):
    path: List[str]
    latency: int
    carbon: int
    cost: int
    message: Optional[str] = None

class CompareResponse(BaseModel):
    routes: Dict[str, RouteResult]

# ---- ROUTE LOGIC ----
def run_engine(source: str, destination: str, mode: str, alpha=None, beta=None) -> dict:
    cmd = [str(ENGINE_PATH), "--graph", str(GRAPH_PATH),
           "--source", source, "--destination", destination, "--mode", mode]
    if alpha is not None:
        cmd.extend(["--alpha", str(alpha)])
    if beta is not None:
        cmd.extend(["--beta", str(beta)])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        output = result.stdout.strip()
        return json.loads(output)
    except subprocess.CalledProcessError as e:
        log.error("Engine failed: %s", e.stderr)
        raise HTTPException(status_code=500, detail="Routing engine error")
    except json.JSONDecodeError as e:
        log.error("Engine returned invalid JSON: %s", output)
        raise HTTPException(status_code=500, detail="Routing engine returned invalid JSON")

# ---- API ENDPOINTS ----
@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}

@app.post("/route", response_model_exclude_none=True)
def route(req: RouteRequest):
    source = req.source.strip()
    destination = req.destination.strip()

    if source == destination:
        log.info("Edge case: same node %s", source)
        return RouteResult(
            path=[source],
            latency=0,
            carbon=0,
            cost=0,
            message="Source and destination are the same. No routing needed."
        )

    if source not in graph_nodes or destination not in graph_nodes:
        log.info("Edge case: invalid node source=%s destination=%s", source, destination)
        raise HTTPException(status_code=400, detail="Invalid node selection")

    def compute(mode: str) -> RouteResult:
        payload = run_engine(
            source=source,
            destination=destination,
            mode=mode,
            alpha=req.alpha,
            beta=req.beta,
        )
        return RouteResult(**payload)

    if req.compare:
        routes = {m: compute(m) for m in ["eco", "balanced", "fast"]}
        return CompareResponse(routes=routes)
    else:
        return compute(req.mode)