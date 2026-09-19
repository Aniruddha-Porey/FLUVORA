# 🌊 FLUVORA

### **Intelligent Flood-Aware Mobility**

**Navigate Safer. Respond Faster.**

FLUVORA is a smart flood-aware navigation and emergency coordination platform. Traditional navigation optimizes for distance and time — FLUVORA adds a third factor: **current road flood risk**. It runs on the **real OpenStreetMap road network of Salt Lake, Kolkata** (8,491 road segments, 6,173 junctions) and combines citizen reports, simulated rainfall/water-level data and road conditions to flag dangerous streets and recommend safer alternative routes.

> **When flooding changes the roads, mobility should adapt too.**

Built for **HackDevengers 2.0 — Open Innovation Hackathon** · Category: Disaster Management / Smart Mobility / Civic Technology

---

## ✨ Features

- 🗺️ **Real road network** — OpenStreetMap data for Salt Lake, Kolkata; click anywhere on the map and FLUVORA snaps your start/destination to the nearest real junction
- 🎨 **Self-rendered basemap** — no external tile provider: the real OSM road network *is* the map (theme-aware), with district labels, the Salt Lake water bodies and a subtle grid. No API keys, no blocked CDNs, works offline
- 🧭 **Risk-aware routing** — heap-based Dijkstra compares the naive *shortest* route with the FLUVORA *safer* route and explains the trade-off
- 🏠 **Landing page** — professional home with live city stats, menu cards (Live Map / Report / Emergency / Command Center) and How-It-Works
- 🔐 **Role-based login** — sign in as **Normal User** (navigate, report, emergency) or **Admin** (`admin` / `fluvora123`) to unlock the Command Center; sessions persist, logout from the header
- 🎬 **10-second intro** — cinematic first-visit intro (shown once, skippable)
- 🌗 **Dark & light themes** — one-tap toggle, persisted across visits; map tiles switch too
- 📱 **Fully mobile responsive** — slide-up route planner drawer, icon navigation, responsive dashboards
- 📢 **Citizen flood reporting** — report water level, condition, severity, description & photo on any road (search 1,300+ named roads or click a road on the map)
- 🤝 **Community verification** — 6+ confirmations auto-verify a report and raise road confidence
- 🚨 **Emergency Mode** — one-tap routing to the nearest hospital / shelter / fire station / police / relief camp, avoiding flooded roads
- 🖥️ **Command Center** — live stats, report moderation, road blocking, flood simulation, rainfall control, demo reset

## 🧮 Flood Risk Engine

Weighted flood-confidence score per road:

```text
Citizen Reports       45%
Water Level           25%
Rainfall              20%
Recent Confirmation   10%
```

Confidence bands: `0–25 🟢 Safe · 26–50 🟡 Caution · 51–75 🟠 Moderate · 76–100 🔴 High` plus `⚫ Blocked` (admin override). Routing multiplies distance by a risk factor (`safe ×1 … high ×4.5`, blocked = impassable).

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Leaflet (canvas renderer), key-free OpenStreetMap tiles (CSS-inverted for dark mode) |
| Backend | Node.js, Express |
| Routing | Custom binary-heap Dijkstra with flood-risk edge penalties |
| Map data | OpenStreetMap (fetched via the official API, processed into `server/data/network.json`) |
| Database | MongoDB (optional) — falls back to an in-memory prototype store when `MONGODB_URI` is not set |

## 🚀 Running the Project

### 1. Backend

```bash
cd server
npm install
npm run dev          # API on http://localhost:5000
```

Optional: create `server/.env` from `.env.example` and set `MONGODB_URI` to persist reports.

### 2. Frontend

```bash
cd client
npm install
npm run dev          # UI on http://localhost:5173 (proxies /api → :5000)
```

### Demo scenario (pre-loaded)

**Salt Lake (Karunamoyee) → AMRI Hospital** — the shortest route crosses the flooded 7th Cross Road / 4th Avenue corridor:

> **Shortest: 2.55 km · 🔴 High Risk** (6 flooded segments)
> **FLUVORA safer: 2.59 km · 🟢 Safe** via the Street Number 13 corridor

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/overview` | Full snapshot (nodes, roads, POIs, centers, reports, weather, stats) |
| GET | `/api/live?since=ISO` | Compact delta: only roads changed since timestamp + reports/stats |
| GET | `/api/reports` | All flood reports |
| POST | `/api/reports` | Create citizen report (`roadId` or `lat/lng`, `waterLevelCm`, `severity`, …) |
| PATCH | `/api/reports/:id/confirm` | Community confirmation (+1, auto-verify at 6) |
| PATCH | `/api/reports/:id/verify` | Admin verification |
| DELETE | `/api/reports/:id` | Remove invalid report |
| GET | `/api/roads` · `/api/roads/:id` | Road list / single road with its reports |
| PATCH | `/api/roads/:id/status` | `{ statusOverride: 'blocked' | null, waterLevelCm }` |
| POST | `/api/route` | `{ from, to }` — accepts node ids **or POI ids** → fastest + safer route with geometry |
| GET | `/api/emergency-centers?type=hospital` | Emergency facilities |
| GET | `/api/pois` · `/api/nodes` · `/api/weather` | Reference data |
| POST | `/api/simulate/flood` | `{ roadId, waterLevelCm }` — simulate a sensor flood event |
| POST | `/api/simulate/weather` | `{ rainfallMmHr }` |
| POST | `/api/simulate/reset` | Restore the initial demo scenario |

## 🗂️ Data Pipeline (real map data)

```text
OpenStreetMap API  →  server/scripts/buildNetwork.mjs  →  server/data/network.json
(9 tiles, Salt Lake)   parse · chain-compress · simplify     8,491 roads · 6,173 nodes
                       · prune stubs · largest component

server/data/scenario.config.json  →  server/scripts/buildScenario.mjs  →  server/data/scenario.json
(POIs, centers, flood zones,         snap POIs to junctions · match        (resolved scenario the
 report templates)                   flood zones to named roads             server loads at boot)
```

Regenerate the network anytime with `node server/scripts/buildNetwork.mjs <tiles-dir>` and the scenario with `node server/scripts/buildScenario.mjs`.

## 🎯 Demo Flow (hackathon)

1. **First open** — 10 s intro plays once → professional landing page with live stats.
2. Open **Live Map** — the Salt Lake → AMRI route is pre-calculated: *Shortest 🔴* vs *🛡 Safer 🟢*.
3. Use **📍 pick on map** to drop a custom start or destination — it snaps to the nearest real junction.
4. Click any flooded road → **📢 Report** → watch risk levels update live.
5. Open a 💧 report marker → press **Confirm** six times → report becomes *verified*.
6. Switch to **Command Center** → **Trigger Flood** on a road on the safe route → back to the map: FLUVORA recalculates around the new hazard.
7. Activate **🚨 Emergency Mode → Medical**: nearest hospital + safe route.
8. Toggle **🌗 light/dark**, resize to phone width to show the mobile layout, and use **♻️ Reset demo** between runs.

## 📁 Project Structure

```text
FLUVORA/
├── client/                      # React + Vite + Leaflet frontend
│   ├── src/
│   │   ├── components/          # Header, MapView, ReportModal, Intro
│   │   ├── pages/               # HomePage, MapPage, AdminPage
│   │   ├── api.js               # API client (relative URLs via Vite proxy)
│   │   ├── constants.js         # risk levels & colors
│   │   └── App.jsx              # views, theme, intro, live polling
│   └── vite.config.js           # dev proxy /api → :5000
├── server/                      # Node + Express backend
│   ├── controllers/             # reports, roads, route, emergency, simulate, overview
│   ├── models/                  # mongoose schemas (Mongo mode)
│   ├── routes/                  # API router
│   ├── services/                # store, riskEngine, router (heap Dijkstra)
│   ├── scripts/                 # buildNetwork.mjs, buildScenario.mjs
│   ├── data/                    # network.json, scenario.json (+config)
│   └── server.js
├── .env.example
└── README.md
```

## 🧪 Prototype Data

Flood conditions are **simulated** so the team can demonstrate flood detection, risk changes, route recalculation, emergency navigation and admin monitoring without live flood infrastructure. Production can plug in IoT water-level sensors, government flood alerts, satellite flood mapping, real weather APIs and verified emergency-location datasets.

## 🌍 Future Scope

Real-time IoT water-level sensors · government flood alerts · satellite-based flood detection · automatic flood-area mapping · public transport disruption info · emergency-service coordination · offline emergency maps · SMS-based reporting · multilingual support (including Bengali) · historical flood-risk analysis · predictive flood modelling.
