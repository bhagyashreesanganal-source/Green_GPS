from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


Mode = Literal["eco", "balanced", "fast"]


class RouteRequest(BaseModel):
    source: str
    destination: str
    mode: Mode
    compare: bool = False
    alpha: Optional[float] = Field(default=None, ge=0)
    beta: Optional[float] = Field(default=None, ge=0)


class RouteResult(BaseModel):
    path: List[str]
    latency: int
    carbon: int
    cost: int
    message: Optional[str] = None


class CompareResponse(BaseModel):
    routes: Dict[Mode, RouteResult]

