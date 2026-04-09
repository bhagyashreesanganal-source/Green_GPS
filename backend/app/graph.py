from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Set


@dataclass(frozen=True)
class GraphIndex:
    nodes: Set[str]


def load_graph_index(graph_path: Path) -> GraphIndex:
    raw = json.loads(graph_path.read_text(encoding="utf-8"))
    nodes = set(raw.get("nodes", []))
    # Also include any nodes implied by edges.
    for e in raw.get("edges", []):
        if "from" in e:
            nodes.add(e["from"])
        if "to" in e:
            nodes.add(e["to"])
    return GraphIndex(nodes=nodes)

