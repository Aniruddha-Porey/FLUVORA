/**
 * Resolves scenario.config.json against the real OSM network:
 * snaps POIs/centers to junction nodes, matches flood zones to named
 * road segments, and generates the demo reports. → data/scenario.json
 */
import fs from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const network = JSON.parse(fs.readFileSync(root + 'data/network.json', 'utf8'));
const cfg = JSON.parse(fs.readFileSync(root + 'data/scenario.config.json', 'utf8'));

const dist = (a, b, cosLat = 1) =>
  Math.hypot(a[0] - b[0], (a[1] - b[1]) * cosLat);

function nearestNode(lat, lng) {
  let best = null, bestD = Infinity;
  for (const n of network.nodes) {
    const d = (n.lat - lat) ** 2 + ((n.lng - lng) * 0.94) ** 2;
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

function roadMid(r) {
  return r.geometry[Math.floor((r.geometry.length - 1) / 2)];
}

function matchZone(zone) {
  const needle = zone.name.toLowerCase();
  const matches = network.roads.filter(
    (r) => r.name && r.name.toLowerCase().includes(needle)
  );
  matches.sort(
    (a, b) =>
      dist(roadMid(a), zone.near) - dist(roadMid(b), zone.near)
  );
  return matches.slice(0, zone.count || 1);
}

/* ---- resolve POIs ---- */
const pois = cfg.pois.map((p) => ({
  ...p,
  nodeId: nearestNode(p.lat, p.lng).id,
}));

/* ---- resolve centers ---- */
const centers = cfg.centers.map((c) => ({
  ...c,
  nodeId: nearestNode(c.lat, c.lng).id,
}));

/* ---- resolve flood zones ---- */
const roadOverrides = {};
const zoneRoads = [];
for (const z of cfg.floodZones) {
  const roads = matchZone(z);
  if (!roads.length) console.warn('⚠️  zone matched nothing:', z.name);
  zoneRoads.push(roads);
  for (const r of roads) {
    roadOverrides[r.id] = Math.max(roadOverrides[r.id] || 0, z.waterLevelCm);
  }
  console.log(
    `zone "${z.name}" → ${roads.length} segments:`,
    roads.map((r) => `${r.id}@${roadMid(r).map((x) => x.toFixed(4))}`).join(' ')
  );
}

/* ---- direct road overrides (for unnamed segments) ---- */
for (const d of cfg.directRoads || []) {
  roadOverrides[d.roadId] = Math.max(roadOverrides[d.roadId] || 0, d.waterLevelCm);
}
console.log('direct overrides:', (cfg.directRoads || []).length);

/* ---- generate reports ---- */
const reports = cfg.reportTemplates.map((t, i) => {
  let road;
  if (t.roadId) {
    road = network.roads.find((r) => r.id === t.roadId);
  }
  if (!road) {
    const roads = zoneRoads[t.zone] || [];
    road = roads[i % Math.max(1, roads.length)] || network.roads[0];
  }
  const mid = roadMid(road);
  return {
    id: `rep-${i + 1}`,
    roadId: road.id,
    lat: mid[0],
    lng: mid[1],
    waterLevelCm: t.waterLevelCm,
    roadCondition: t.severity === 'high' ? 'waterlogged' : 'difficult',
    severity: t.severity,
    description: t.description,
    source: 'citizen',
    confirmations: t.confirmations,
    verified: false,
    ageMin: t.ageMin,
  };
});

fs.writeFileSync(
  root + 'data/scenario.json',
  JSON.stringify(
    {
      weather: cfg.weather,
      pois,
      centers,
      roadOverrides,
      reports,
    },
    null,
    2
  )
);
console.log(
  `\nscenario.json written — ${pois.length} pois, ${centers.length} centers,`,
  `${Object.keys(roadOverrides).length} flooded segments, ${reports.length} reports`
);
