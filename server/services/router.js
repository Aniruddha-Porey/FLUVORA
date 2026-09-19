/**
 * FLUVORA Route Calculation — Dijkstra with a binary heap (fast on the
 * full OSM graph). Two modes:
 *  - 'distance': naive navigation (shortest distance, ignores flooding)
 *  - 'risk':     distance × flood-risk penalty (prefers safer corridors,
 *                never crosses blocked roads)
 */

const RISK_MULTIPLIER = {
  safe: 1,
  caution: 1.25,
  moderate: 2.0,
  high: 4.5,
  blocked: Infinity,
};

const LEVEL_ORDER = { safe: 0, caution: 1, moderate: 2, high: 3, blocked: 4 };
const AVG_SPEED_KMH = 24; // urban average under wet conditions

class MinHeap {
  constructor() { this.h = []; }
  get size() { return this.h.length; }
  push(item) {
    const h = this.h;
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p].d <= h[i].d) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  }
  pop() {
    const h = this.h;
    const top = h[0];
    const last = h.pop();
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < h.length && h[l].d < h[m].d) m = l;
        if (r < h.length && h[r].d < h[m].d) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  }
}

export function buildAdjacency(state) {
  const adj = new Map();
  for (const n of state.nodes) adj.set(n.id, []);
  for (const r of state.roads) {
    adj.get(r.from)?.push({ road: r, other: r.to });
    adj.get(r.to)?.push({ road: r, other: r.from });
  }
  return adj;
}

export function findRoute(state, from, to, mode) {
  const adj = state._adj || buildAdjacency(state);
  if (!adj.has(from) || !adj.has(to) || from === to) return null;

  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const visited = new Set();
  const heap = new MinHeap();
  heap.push({ d: 0, node: from });

  while (heap.size) {
    const { d, node: u } = heap.pop();
    if (visited.has(u)) continue;
    visited.add(u);
    if (u === to) break;
    for (const { road, other } of adj.get(u) || []) {
      if (visited.has(other)) continue;
      const mult = mode === 'risk' ? RISK_MULTIPLIER[road.level] : 1;
      if (!Number.isFinite(mult)) continue; // blocked — never cross in risk mode
      const nd = d + road.lengthKm * mult;
      if (nd < (dist.get(other) ?? Infinity)) {
        dist.set(other, nd);
        prev.set(other, { node: u, road });
        heap.push({ d: nd, node: other });
      }
    }
  }

  if (!dist.has(to) || !prev.has(to)) return null;

  const nodeIds = [to];
  const roads = [];
  let cur = to;
  while (cur !== from) {
    const p = prev.get(cur);
    roads.unshift(p.road);
    nodeIds.unshift(p.node);
    cur = p.node;
  }

  const km = roads.reduce((s, r) => s + r.lengthKm, 0);
  const maxLevel = roads.length
    ? [...roads].sort((a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level])[0].level
    : 'safe';
  const avgConfidence = roads.length
    ? Math.round(roads.reduce((s, r) => s + r.confidence, 0) / roads.length)
    : 0;

  const pathGeometry = [];
  roads.forEach((r, i) => {
    const forward = r.from === nodeIds[i];
    const pts = forward ? r.geometry : [...r.geometry].reverse();
    pts.forEach((p, j) => {
      if (i > 0 && j === 0) return;
      pathGeometry.push(p);
    });
  });

  return {
    nodeIds,
    roadIds: roads.map((r) => r.id),
    km: +km.toFixed(2),
    etaMin: Math.max(1, Math.round((km / AVG_SPEED_KMH) * 60)),
    maxLevel,
    avgConfidence,
    riskyRoads: roads.filter((r) => ['moderate', 'high', 'blocked'].includes(r.level)).length,
    steps: compressSteps(roads),
    pathGeometry,
  };
}

/** Merge consecutive segments of the same named road into readable steps. */
function compressSteps(roads) {
  const steps = [];
  for (const r of roads) {
    const last = steps[steps.length - 1];
    if (last && last.name === (r.name || '') && last.level === r.level) {
      last.km = +(last.km + r.lengthKm).toFixed(2);
      last.confidence = Math.max(last.confidence, r.confidence);
      last.count++;
    } else {
      steps.push({
        roadId: r.id,
        name: r.name || 'Unnamed road',
        km: +r.lengthKm.toFixed(2),
        level: r.level,
        confidence: r.confidence,
        count: 1,
      });
    }
  }
  return steps;
}
