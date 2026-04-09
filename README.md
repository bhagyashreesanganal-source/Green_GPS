## Green GPS

Green GPS is an intelligent eco-friendly internet routing simulator. It computes optimal paths between data centers using a modified Dijkstra algorithm with:

\[
cost = \alpha \cdot latency + \beta \cdot carbon
\]

This repo is split into:

- `engine/`: C++ routing engine (reads `shared/graph.json`, outputs JSON)
- `backend/`: FastAPI service (`POST /route`) that calls the engine
- `frontend/`: React + Tailwind dashboard UI
- `shared/`: graph data shared by backend + engine

---

## Prerequisites (Windows)

- **Python 3.11+** (for FastAPI)
- **Node.js 18+** (for React frontend)
- **C++ compiler + CMake** (e.g. Visual Studio Build Tools with MSVC, plus CMake)

> Note: Your current shell indicates Python/Node/C++ compiler aren’t on PATH yet. Install the above, then follow the steps below.

---

## Quick start (local dev)

### 1) Build the C++ engine

From repo root:

```bash
cmake -S engine -B engine/build
cmake --build engine/build --config Release
```

Engine binary will be at:

- `engine/build/Release/greengps_engine.exe` (MSVC)
- or `engine/build/greengps_engine` (other toolchains)

### 2) Run the backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3) Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open the app at the URL Vite prints (typically `http://localhost:5173`).

---

## API

### `POST /route`

Request:

```json
{
  "source": "Mumbai",
  "destination": "London",
  "mode": "eco",
  "compare": false,
  "alpha": 0.4,
  "beta": 0.6
}
```

Response (single route):

```json
{
  "path": ["Mumbai", "Singapore", "London"],
  "latency": 130,
  "carbon": 35,
  "cost": 78
}
```

Response (compare mode):

```json
{
  "routes": {
    "eco": { "...": "..." },
    "balanced": { "...": "..." },
    "fast": { "...": "..." }
  }
}
```

