/**
 * FLUVORA network builder — parses OSM /api/0.6/map XML tiles into a
 * chain-compressed, simplified road graph for the risk engine & router.
 * Usage: node server/scripts/buildNetwork.mjs /path/to/tile/dir
 */
import fs from 'node:fs';

const TILE_DIR = process.argv[2] || '/tmp/osm';
const OUT = new URL('../data/network.json', import.meta.url).pathname;
const HIGHWAYS = new Set([
  'trunk','primary','secondary','tertiary','unclassified','residential','living_street',
  'trunk_link','primary_link','secondary_link','tertiary_link',
]);

const decode = (s) =>
  s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
   .replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'");

/* ---------- 1. parse tiles ---------- */
const nodes = new Map(); // osmId -> [lat, lon]
const ways = new Map();  // osmId -> { name, highway, refs[] }

for (const f of fs.readdirSync(TILE_DIR).filter((x) => x.endsWith('.xml'))) {
  const xml = fs.readFileSync(`${TILE_DIR}/${f}`, 'utf8');
  for (const m of xml.matchAll(/<node id="(\d+)"[^>]*lat="(-?[\d.]+)" lon="(-?[\d.]+)"/g)) {
    nodes.set(m[1], [+m[2], +m[3]]);
  }
  for (const m of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
    if (ways.has(m[1])) continue;
    const body = m[2];
    const hw = /k="highway" v="([^"]+)"/.exec(body);
    if (!hw || !HIGHWAYS.has(hw[1])) continue;
    const refs = [...body.matchAll(/<nd ref="(\d+)"\/>/g)].map((x) => x[1]);
    if (refs.length < 2) continue;
    const nm = /k="name" v="([^"]*)"/.exec(body);
    ways.set(m[1], { name: nm ? decode(nm[1]).trim() : '', highway: hw[1], refs });
  }
}
console.log('tiles parsed:', nodes.size, 'osm nodes,', ways.size, 'highways');

/* ---------- 2. junction detection ---------- */
const usage = new Map();
for (const w of ways.values()) {
  for (const r of new Set(w.refs)) usage.set(r, (usage.get(r) || 0) + 1);
}

/* ---------- geometry helpers ---------- */
function haversineKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function rdp(pts, eps) {
  if (pts.length <= 2) return pts;
  let maxD = 0, idx = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i][1] - ax) * dy - (pts[i][0] - ay) * dx) / len;
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    const l = rdp(pts.slice(0, idx + 1), eps), r = rdp(pts.slice(idx), eps);
    return l.slice(0, -1).concat(r);
  }
  return [pts[0], pts[pts.length - 1]];
}

/* ---------- 3. chain compression into edges ---------- */
const edgeMap = new Map(); // sorted "a|b" -> { from, to, name, geometry }
let skippedNoNode = 0, skippedShort = 0;

for (const w of ways.values()) {
  const refs = w.refs;
  let last = 0;
  for (let i = 1; i < refs.length; i++) {
    const atJunction = (usage.get(refs[i]) || 0) >= 2 || i === refs.length - 1;
    if (!atJunction) continue;
    const a = refs[last], b = refs[i];
    const sliceRefs = refs.slice(last, i + 1);
    last = i;
    if (a === b) continue;
    const pts = [];
    let ok = true;
    for (const r of sliceRefs) {
      const c = nodes.get(r);
      if (!c) { ok = false; break; }
      pts.push(c);
    }
    if (!ok) { skippedNoNode++; continue; }
    let km = 0;
    for (let j = 1; j < pts.length; j++) km += haversineKm(pts[j-1], pts[j]);
    if (km < 0.004) { skippedShort++; continue; }
    const key = [a, b].sort().join('|');
    if (edgeMap.has(key)) {
      const ex = edgeMap.get(key);
      if (!ex.name && w.name) ex.name = w.name;
      continue;
    }
    edgeMap.set(key, { from: a, to: b, name: w.name, geometry: pts });
  }
}
console.log('raw edges:', edgeMap.size, '| skipped no-node:', skippedNoNode, 'short:', skippedShort);

/* ---------- 4. simplify geometry ---------- */
for (const e of edgeMap.values()) {
  e.geometry = rdp(e.geometry, 0.00006);
}

/* ---------- 5. keep largest connected component ---------- */
const adj = new Map();
for (const e of edgeMap.values()) {
  if (!adj.has(e.from)) adj.set(e.from, []);
  if (!adj.has(e.to)) adj.set(e.to, []);
  adj.get(e.from).push(e);
  adj.get(e.to).push(e);
}
const ANCHOR = [22.5855, 88.4155]; // Salt Lake centre
let anchorNode = null, bestD = Infinity;
for (const id of adj.keys()) {
  const [la, lo] = nodes.get(id);
  const d = (la - ANCHOR[0]) ** 2 + (lo - ANCHOR[1]) ** 2;
  if (d < bestD) { bestD = d; anchorNode = id; }
}
const seen = new Set([anchorNode]);
const stack = [anchorNode];
while (stack.length) {
  const u = stack.pop();
  for (const e of adj.get(u) || []) {
    const v = e.from === u ? e.to : e.from;
    if (!seen.has(v)) { seen.add(v); stack.push(v); }
  }
}
for (const [k, e] of [...edgeMap]) {
  if (!seen.has(e.from) || !seen.has(e.to)) edgeMap.delete(k);
}
console.log('largest component:', edgeMap.size, 'edges,', seen.size, 'nodes');

/* ---------- 6. prune unnamed leaf stubs ---------- */
const KEEP_NEAR = [
  [22.5925, 88.4148],[22.5789, 88.4153],[22.5760, 88.4300],[22.5930, 88.4262],
  [22.5764, 88.4183],[22.5663, 88.4249],[22.5845, 88.3990],[22.5640, 88.4110],
  [22.5866, 88.4198],[22.5730, 88.3966],[22.5860, 88.4170],[22.5895, 88.4095],
  [22.5600, 88.4325],[22.6020, 88.4470],
];
const nearKeep = (lat, lon) =>
  KEEP_NEAR.some(([a, b]) => (lat-a)**2 + (lon-b)**2 < 7e-8);
for (let pass = 0; pass < 3; pass++) {
  const deg = new Map();
  for (const e of edgeMap.values()) {
    deg.set(e.from, (deg.get(e.from) || 0) + 1);
    deg.set(e.to, (deg.get(e.to) || 0) + 1);
  }
  let removed = 0;
  for (const [k, e] of [...edgeMap]) {
    if (e.name) continue;
    const [la, lo] = nodes.get(e.from), [lb, ob] = nodes.get(e.to);
    if ((deg.get(e.from) === 1 && !nearKeep(la, lo)) ||
        (deg.get(e.to) === 1 && !nearKeep(lb, ob))) {
      edgeMap.delete(k);
      removed++;
    }
  }
  if (!removed) break;
}
console.log('after stub pruning:', edgeMap.size, 'edges');

/* ---------- 7. emit ---------- */
const usedNodes = new Set();
for (const e of edgeMap.values()) { usedNodes.add(e.from); usedNodes.add(e.to); }
const nodeOut = [...usedNodes].map((osm, i) => ({
  id: `n${i + 1}`,
  name: 'junction',
  lat: +nodes.get(osm)[0].toFixed(6),
  lng: +nodes.get(osm)[1].toFixed(6),
}));
const idMap = new Map(nodeOut.map((n, i) => [[...usedNodes][i], n.id]));

const roadOut = [...edgeMap.values()].map((e, i) => {
  const pts = e.geometry.map(([la, lo]) => [+la.toFixed(6), +lo.toFixed(6)]);
  let km = 0;
  for (let j = 1; j < pts.length; j++) km += haversineKm(pts[j-1], pts[j]);
  return {
    id: `r${i + 1}`, name: e.name,
    from: idMap.get(e.from), to: idMap.get(e.to),
    geometry: pts, waterLevelCm: 0, lengthKm: +km.toFixed(3),
  };
});

fs.writeFileSync(OUT, JSON.stringify({ nodes: nodeOut, roads: roadOut }));
const named = roadOut.filter((r) => r.name);
console.log('FINAL:', roadOut.length, 'roads ·', nodeOut.length, 'nodes ·', named.length, 'named');
const nameCount = {};
named.forEach((r) => (nameCount[r.name] = (nameCount[r.name] || 0) + 1));
console.log('--- top named roads ---');
Object.entries(nameCount).sort((a,b)=>b[1]-a[1]).slice(0,50)
  .forEach(([n,c]) => console.log(`  ${n} ×${c}`));
