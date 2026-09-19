/**
 * FLUVORA data store.
 * Loads the real OpenStreetMap road network (data/network.json) plus the
 * demo scenario (data/scenario.json). Runs in two modes:
 *  - 'memory' (default): in-memory prototype store
 *  - 'mongo' (when MONGODB_URI is set): write-through persistence to MongoDB.
 */
import fs from 'node:fs';
import { confidenceFor, levelFor, clamp } from './riskEngine.js';
import { findRoute, buildAdjacency } from './router.js';

const state = {
  nodes: [],
  roads: [],
  pois: [],
  centers: [],
  reports: [],
  weather: { rainfallMmHr: 30, condition: 'Heavy showers' },
  seq: 100,
  _adj: null,
};

let mode = 'memory';
let mongo = null;

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

function loadBase() {
  const net = JSON.parse(
    fs.readFileSync(new URL('../data/network.json', import.meta.url), 'utf8')
  );
  const sc = JSON.parse(
    fs.readFileSync(new URL('../data/scenario.json', import.meta.url), 'utf8')
  );

  state.nodes = net.nodes;
  state.roads = net.roads.map((r) => ({
    ...r,
    statusOverride: null,
    confidence: 0,
    level: 'safe',
    updatedAt: new Date(0).toISOString(),
  }));

  state.pois = sc.pois;
  state.centers = sc.centers;
  state.weather = sc.weather;
  state.seq = 200;

  // Scenario water levels
  for (const [roadId, water] of Object.entries(sc.roadOverrides || {})) {
    const road = roadById(roadId);
    if (road) road.waterLevelCm = water;
  }

  // Scenario reports (timestamps relative to server start)
  state.reports = (sc.reports || []).map((r) => ({
    ...r,
    createdAt: new Date(Date.now() - (r.ageMin ?? 120) * 60000).toISOString(),
  }));
  state.reports.forEach((r) => delete r.ageMin);

  state._adj = buildAdjacency(state);
}

export async function initStore() {
  loadBase();

  if (process.env.MONGODB_URI) {
    try {
      const mongoose = (await import('mongoose')).default;
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      const buildModels = (await import('../models/index.js')).default;
      mongo = buildModels(mongoose);
      const existing = await mongo.Report.countDocuments();
      if (existing > 0) {
        state.reports = (await mongo.Report.find().lean()).map((d) => ({
          ...d, _id: undefined, __v: undefined,
        }));
        const roads = await mongo.Road.find().lean();
        if (roads.length) {
          const risk = new Map(roads.map((d) => [d.id, d]));
          state.roads.forEach((r) => {
            const s = risk.get(r.id);
            if (s) {
              r.waterLevelCm = s.waterLevelCm ?? 0;
              r.statusOverride = s.statusOverride ?? null;
            }
          });
        }
        console.log('🗄️  Store: MongoDB connected — rehydrated reports');
      } else {
        await mongo.Report.insertMany(state.reports);
        console.log('🗄️  Store: MongoDB connected — seeded');
      }
      mode = 'mongo';
    } catch (err) {
      console.warn('⚠️  MongoDB unavailable → in-memory prototype store.', err.message);
    }
  } else {
    console.log('🗄️  Store: in-memory prototype mode (set MONGODB_URI to persist)');
  }

  recalcRoads(true);
  console.log(
    `🌊 Network: ${state.roads.length} roads · ${state.nodes.length} junctions · ${state.pois.length} POIs`
  );
}

export function getMode() {
  return mode;
}

/* ------------------------------------------------------------------ */
/* Persistence helpers (no-op in memory mode)                          */
/* ------------------------------------------------------------------ */

async function persistRoad(road) {
  if (!mongo) return;
  try {
    await mongo.Road.updateOne(
      { id: road.id },
      { $set: { id: road.id, waterLevelCm: road.waterLevelCm, statusOverride: road.statusOverride } },
      { upsert: true }
    );
  } catch (e) { console.warn('persistRoad:', e.message); }
}
async function persistReportInsert(report) {
  if (!mongo) return;
  try { await mongo.Report.create(report); } catch (e) { console.warn(e.message); }
}
async function persistReportUpdate(report) {
  if (!mongo) return;
  try {
    await mongo.Report.updateOne({ id: report.id }, { $set: report }, { upsert: true });
  } catch (e) { console.warn(e.message); }
}
async function persistReportDelete(id) {
  if (!mongo) return;
  try { await mongo.Report.deleteOne({ id }); } catch (e) { console.warn(e.message); }
}

/* ------------------------------------------------------------------ */
/* Risk recalculation (tracks which roads actually changed → /api/live)*/
/* ------------------------------------------------------------------ */

export function recalcRoads(force = false) {
  for (const road of state.roads) {
    let confidence, level;
    if (road.statusOverride === 'blocked') {
      confidence = 100;
      level = 'blocked';
    } else {
      confidence = confidenceFor(road, state.reports, state.weather.rainfallMmHr);
      level = confidenceToLevel(confidence);
    }
    if (
      force ||
      confidence !== road.confidence ||
      level !== road.level
    ) {
      road.confidence = confidence;
      road.level = level;
      road.updatedAt = new Date().toISOString();
    }
  }
}
function confidenceToLevel(c) {
  return levelFor(c);
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export function getState() { return state; }
export const nodeById = (id) => state.nodes.find((n) => n.id === id) || null;
export const roadById = (id) => state.roads.find((r) => r.id === id) || null;
export const reportById = (id) => state.reports.find((r) => r.id === id) || null;

/** Resolve a place id: graph node id OR POI id. */
export function resolvePoint(id) {
  if (nodeById(id)) return id;
  const poi = state.pois.find((p) => p.id === id);
  return poi ? poi.nodeId : null;
}

export function nearestNodeTo(lat, lng) {
  let best = null, bestD = Infinity;
  for (const n of state.nodes) {
    const d = (n.lat - lat) ** 2 + ((n.lng - lng) * 0.94) ** 2;
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

export function nearestRoadId(lat, lng) {
  let best = null, bestD = Infinity;
  for (const road of state.roads) {
    for (const [glat, glng] of road.geometry) {
      const d = (glat - lat) ** 2 + ((glng - lng) * 0.94) ** 2;
      if (d < bestD) { bestD = d; best = road.id; }
    }
  }
  return bestD <= 0.0004 ? best : null; // ~70 m
}

export function listRoads() { return state.roads; }
export function getRoadWithReports(id) {
  const road = roadById(id);
  if (!road) return null;
  return { ...road, reports: state.reports.filter((r) => r.roadId === id) };
}
export function listReports() {
  return [...state.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function listCenters(type) {
  return type ? state.centers.filter((c) => c.type === type) : state.centers;
}
export function listPois() { return state.pois; }
export function listNodes() { return state.nodes; }

/* ------------------------------------------------------------------ */
/* Stats / overview / live                                             */
/* ------------------------------------------------------------------ */

export function computeStats() {
  const byLevel = { safe: 0, caution: 0, moderate: 0, high: 0, blocked: 0 };
  state.roads.forEach((r) => { byLevel[r.level] = (byLevel[r.level] || 0) + 1; });
  const worstRoads = [...state.roads]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map((r) => ({ id: r.id, name: r.name || 'Unnamed road', confidence: r.confidence, level: r.level }));
  return {
    byLevel,
    totalRoads: state.roads.length,
    totalReports: state.reports.length,
    verifiedReports: state.reports.filter((r) => r.verified).length,
    centers: state.centers.length,
    rainfallMmHr: state.weather.rainfallMmHr,
    worstRoads,
  };
}

export function getOverview() {
  return {
    generatedAt: new Date().toISOString(),
    nodes: state.nodes,
    roads: state.roads,
    pois: state.pois,
    centers: state.centers,
    reports: listReports(),
    weather: state.weather,
    stats: computeStats(),
  };
}

/** Lightweight live update: roads changed since `since` + reports/stats. */
export function getLive(since) {
  const changedRoads = since
    ? state.roads
        .filter((r) => r.updatedAt > since)
        .map((r) => ({
          id: r.id,
          level: r.level,
          confidence: r.confidence,
          waterLevelCm: r.waterLevelCm,
          statusOverride: r.statusOverride,
        }))
    : state.roads.map((r) => ({
        id: r.id,
        level: r.level,
        confidence: r.confidence,
        waterLevelCm: r.waterLevelCm,
        statusOverride: r.statusOverride,
      }));
  return {
    serverTime: new Date().toISOString(),
    roads: changedRoads,
    reports: listReports(),
    weather: state.weather,
    stats: computeStats(),
  };
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export async function addReport(input = {}) {
  let roadId = input.roadId;
  let lat = Number(input.lat);
  let lng = Number(input.lng);

  if (roadId && !roadById(roadId)) throw new Error(`Unknown road id: ${roadId}`);
  if (!roadId) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error('Provide a roadId or lat/lng coordinates');
    }
    roadId = nearestRoadId(lat, lng);
    if (!roadId) throw new Error('No road found near the given coordinates');
  }

  const road = roadById(roadId);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const mid = road.geometry[Math.floor((road.geometry.length - 1) / 2)];
    lat = mid[0]; lng = mid[1];
  }

  const waterLevelCm = clamp(Math.round(Number(input.waterLevelCm) || 0), 0, 200);
  const severity = ['low', 'medium', 'high'].includes(input.severity)
    ? input.severity
    : waterLevelCm >= 60 ? 'high' : waterLevelCm >= 25 ? 'medium' : 'low';

  const report = {
    id: `rep-${++state.seq}`,
    roadId, lat, lng, waterLevelCm,
    roadCondition: input.roadCondition || 'waterlogged',
    severity,
    description: String(input.description || '').slice(0, 300),
    source: ['citizen', 'sensor', 'admin'].includes(input.source) ? input.source : 'citizen',
    confirmations: 0,
    verified: false,
    createdAt: new Date().toISOString(),
  };

  state.reports.unshift(report);
  if (waterLevelCm > (road.waterLevelCm || 0)) road.waterLevelCm = waterLevelCm;
  recalcRoads();
  await persistReportInsert(report);
  await persistRoad(road);
  return report;
}

export async function confirmReport(id) {
  const report = reportById(id);
  if (!report) return null;
  report.confirmations += 1;
  if (!report.verified && report.confirmations >= 6) report.verified = true;
  recalcRoads();
  await persistReportUpdate(report);
  return report;
}

export async function verifyReport(id) {
  const report = reportById(id);
  if (!report) return null;
  report.verified = true;
  recalcRoads();
  await persistReportUpdate(report);
  return report;
}

export async function deleteReport(id) {
  const idx = state.reports.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  state.reports.splice(idx, 1);
  recalcRoads();
  await persistReportDelete(id);
  return { id };
}

export async function updateRoad(id, patch = {}) {
  const road = roadById(id);
  if (!road) return null;
  if (patch.statusOverride !== undefined) {
    road.statusOverride = patch.statusOverride === 'blocked' ? 'blocked' : null;
  }
  if (patch.waterLevelCm !== undefined) {
    road.waterLevelCm = clamp(Math.round(Number(patch.waterLevelCm) || 0), 0, 200);
  }
  recalcRoads();
  await persistRoad(road);
  return road;
}

export async function setRainfall(mmHr) {
  state.weather.rainfallMmHr = clamp(Math.round(Number(mmHr) || 0), 0, 120);
  state.weather.condition =
    state.weather.rainfallMmHr >= 60 ? 'Torrential rain'
    : state.weather.rainfallMmHr >= 30 ? 'Heavy showers'
    : state.weather.rainfallMmHr >= 10 ? 'Raining'
    : 'Dry';
  recalcRoads();
  return state.weather;
}

export async function simulateFlood(roadId, waterLevelCm) {
  const road = roadById(roadId);
  if (!road) return null;
  road.waterLevelCm = Math.max(road.waterLevelCm || 0, Math.round(Number(waterLevelCm) || 0));
  const mid = road.geometry[Math.floor((road.geometry.length - 1) / 2)];
  const report = await addReport({
    roadId: road.id,
    lat: mid[0], lng: mid[1],
    waterLevelCm: road.waterLevelCm,
    roadCondition: road.waterLevelCm >= 60 ? 'blocked' : 'waterlogged',
    severity: road.waterLevelCm >= 60 ? 'high' : road.waterLevelCm >= 30 ? 'medium' : 'low',
    description: `Auto sensor: water level ${road.waterLevelCm} cm on ${road.name || 'road'}.`,
    source: 'sensor',
  });
  return { road: roadById(roadId), report };
}

export async function resetDemo() {
  loadBase();
  recalcRoads(true);
  if (mongo) {
    try {
      await mongo.Report.deleteMany({});
      await mongo.Report.insertMany(state.reports);
    } catch (e) { console.warn('Mongo reset failed:', e.message); }
  }
}

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

export function planRoutes(fromId, toId) {
  const from = resolvePoint(fromId);
  const to = resolvePoint(toId);
  if (!from || !to) return null;
  const fastest = findRoute(state, from, to, 'distance');
  const recommended = findRoute(state, from, to, 'risk');
  const samePath = !!(
    fastest && recommended && fastest.roadIds.join(',') === recommended.roadIds.join(',')
  );
  return { from, to, fastest, recommended, samePath };
}
