from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class EngineConfig:
    engine_path: Path
    graph_path: Path
    timeout_s: float = 8.0


class EngineError(RuntimeError):
    pass


def _coerce_int(x: object, key: str) -> int:
    if isinstance(x, int):
        return x
    if isinstance(x, float):
        return int(round(x))
    raise EngineError(f"Invalid engine field {key!r}")


def run_engine(
    *,
    cfg: EngineConfig,
    source: str,
    destination: str,
    mode: str,
    alpha: Optional[float] = None,
    beta: Optional[float] = None,
) -> dict:
    args = [
        str(cfg.engine_path),
        "--graph",
        str(cfg.graph_path),
        "--source",
        source,
        "--destination",
        destination,
        "--mode",
        mode,
    ]
    if alpha is not None:
        args += ["--alpha", str(alpha)]
    if beta is not None:
        args += ["--beta", str(beta)]

    try:
        proc = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=cfg.timeout_s,
            check=False,
        )
    except Exception as e:  # noqa: BLE001
        raise EngineError(f"Routing engine error: {e}") from e

    if proc.returncode != 0:
        details = proc.stderr.strip() or proc.stdout.strip()
        raise EngineError(f"Routing engine error")

    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise EngineError("Routing engine error") from e

    # Normalize/validate minimal shape.
    if not isinstance(data, dict) or "path" not in data:
        raise EngineError("Routing engine error")
    if not isinstance(data["path"], list) or not all(isinstance(p, str) for p in data["path"]):
        raise EngineError("Routing engine error")

    latency = _coerce_int(data.get("latency", 0), "latency")
    carbon = _coerce_int(data.get("carbon", 0), "carbon")
    cost = _coerce_int(data.get("cost", 0), "cost")
    return {"path": data["path"], "latency": latency, "carbon": carbon, "cost": cost}

