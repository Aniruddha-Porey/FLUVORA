import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { LEVEL_META, CENTER_EMOJI, CENTER_LABEL } from '../constants.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

const MAP_CENTER = [22.5835, 88.4180];

// FLUVORA self-rendered basemap: no external tile provider (no API keys,
// no blocked CDNs). The real OSM road network we draw IS the map, plus
// district labels and the Salt Lake water bodies for context.
const DISTRICTS = [
  { name: 'SALT LAKE · BIDHANNAGAR', lat: 22.5868, lng: 88.4128 },
  { name: 'SECTOR V', lat: 22.5752, lng: 88.4292 },
  { name: 'KESTOPUR', lat: 22.5812, lng: 88.4372 },
  { name: 'LAKE TOWN', lat: 22.6002, lng: 88.4008 },
  { name: 'NEW TOWN', lat: 22.5962, lng: 88.4478 },
  { name: 'TANGRA', lat: 22.5712, lng: 88.3982 },
  { name: 'KOLKATA', lat: 22.5612, lng: 88.3942 },
  { name: 'DHAPA', lat: 22.5612, lng: 88.4418 },
];

const WATER = [
  // Salt Lake lake-series (approximate)
  { lat: 22.5935, lng: 88.4205, r: 320 },
  { lat: 22.5878, lng: 88.4212, r: 300 },
  { lat: 22.5818, lng: 88.4222, r: 280 },
  { lat: 22.5762, lng: 88.4232, r: 260 },
  { lat: 22.5706, lng: 88.4244, r: 240 },
];

export default function MapView({
  roads = [],
  reports = [],
  centers = [],
  route = null,
  theme = 'dark',
  pickMode = null, // 'start' | 'end' | null
  onPickPoint,
  onRoadClick,
  onReportConfirm,
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef(null);
  const keysRef = useRef({ roads: '', reports: '', centers: '' });
  const roadClickRef = useRef(onRoadClick); roadClickRef.current = onRoadClick;
  const confirmRef = useRef(onReportConfirm); confirmRef.current = onReportConfirm;
  const pickRef = useRef({ pickMode, onPickPoint }); pickRef.current = { pickMode, onPickPoint };

  /* ---------- init ---------- */
  useEffect(() => {
    const map = L.map(elRef.current, {
      zoomControl: true,
      preferCanvas: true, // render thousands of road polylines efficiently
      attributionControl: false,
    }).setView(MAP_CENTER, 14);

    L.control
      .attribution({ prefix: false })
      .addAttribution('© OpenStreetMap contributors · FLUVORA basemap')
      .addTo(map);

    layersRef.current = {
      base: L.layerGroup().addTo(map),
      roads: L.layerGroup().addTo(map),
      route: L.layerGroup().addTo(map),
      ends: L.layerGroup().addTo(map),
      reports: L.layerGroup().addTo(map),
      centers: L.layerGroup().addTo(map),
    };

    // District labels (theme-aware via CSS)
    for (const d of DISTRICTS) {
      L.marker([d.lat, d.lng], {
        interactive: false,
        icon: L.divIcon({ className: '', html: `<div class="map-label">${d.name}</div>`, iconSize: [0, 0] }),
      }).addTo(layersRef.current.base);
    }

    map.on('click', (e) => {
      const { pickMode: pm, onPickPoint: cb } = pickRef.current;
      if (pm && cb) cb({ lat: e.latlng.lat, lng: e.latlng.lng, mode: pm });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
      keysRef.current = { roads: '', reports: '', centers: '' };
    };
  }, []);

  /* ---------- water bodies follow theme ---------- */
  useEffect(() => {
    const layers = layersRef.current;
    if (!layers) return;
    layers.base.eachLayer((l) => {
      if (l instanceof L.Circle) layers.base.removeLayer(l);
    });
    const dark = theme === 'dark';
    for (const w of WATER) {
      L.circle([w.lat, w.lng], {
        radius: w.r,
        stroke: true,
        color: dark ? '#155e75' : '#60a5fa',
        weight: 1,
        fillColor: dark ? '#0b334d' : '#bfdbfe',
        fillOpacity: dark ? 0.75 : 0.65,
        interactive: false,
      }).addTo(layers.base);
    }
  }, [theme]);

  /* ---------- roads ---------- */
  useEffect(() => {
    const layers = layersRef.current;
    if (!layers) return;
    const key = roads
      .map((r) => `${r.id}:${r.level}:${r.confidence}:${r.waterLevelCm}:${r.statusOverride}`)
      .join('|');
    if (key === keysRef.current.roads) return;
    keysRef.current.roads = key;

    layers.roads.clearLayers();
    for (const road of roads) {
      const meta = LEVEL_META[road.level] || LEVEL_META.safe;
      const line = L.polyline(road.geometry, {
        color: meta.color,
        weight: road.level === 'safe' ? 3 : 5.5,
        opacity: road.level === 'safe' ? 0.65 : 0.95,
        dashArray: road.level === 'blocked' ? '3 8' : null,
        lineCap: 'round',
      });
      line.bindTooltip(
        `<b>${esc(road.name || 'Unnamed road')}</b><br>${meta.emoji} ${meta.label} · flood confidence ${road.confidence}% · water ${road.waterLevelCm || 0} cm`,
        { sticky: true, direction: 'top' }
      );
      line.on('click', (e) => {
        if (pickRef.current.pickMode) return; // picking takes precedence
        L.DomEvent.stopPropagation(e);
        roadClickRef.current?.(road);
      });
      layers.roads.addLayer(line);
    }
  }, [roads]);

  /* ---------- reports ---------- */
  useEffect(() => {
    const layers = layersRef.current;
    if (!layers) return;
    const key = reports.map((r) => `${r.id}:${r.confirmations}:${r.verified}`).join('|');
    if (key === keysRef.current.reports) return;
    keysRef.current.reports = key;

    layers.reports.clearLayers();
    reports.forEach((r) => {
      const icon = L.divIcon({
        className: '',
        html: `<div class="rp-pin">💧${r.confirmations ? `<span class="rp-count">${r.confirmations}</span>` : ''}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      const marker = L.marker([r.lat, r.lng], { icon });
      const el = document.createElement('div');
      el.className = 'rp-popup';
      el.innerHTML = `
        <div class="pop-title">💧 Flood report ${
          r.verified ? '<span class="tag-ok">✔ verified</span>' : '<span class="tag-warn">unverified</span>'
        }</div>
        <div class="pop-row">🌊 Water level: <b>${r.waterLevelCm} cm</b></div>
        <div class="pop-row">🚧 Condition: <b>${esc(r.roadCondition)}</b> · severity <b>${esc(r.severity)}</b></div>
        ${r.description ? `<div class="pop-desc">“${esc(r.description)}”</div>` : ''}
        <div class="pop-meta">${r.source === 'sensor' ? '🤖 sensor' : '👤 citizen'} · ${r.confirmations}/6 confirmations · ${new Date(r.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
      `;
      const btn = document.createElement('button');
      btn.className = 'pop-btn';
      btn.textContent = r.verified ? '✅ Verified by community' : `👍 Confirm this report (${r.confirmations}/6)`;
      btn.disabled = r.verified;
      btn.onclick = () => {
        confirmRef.current?.(r);
        mapRef.current?.closePopup();
      };
      el.appendChild(btn);
      marker.bindPopup(el, { closeButton: true, maxWidth: 300 });
      layers.reports.addLayer(marker);
    });
  }, [reports]);

  /* ---------- centers ---------- */
  useEffect(() => {
    const layers = layersRef.current;
    if (!layers) return;
    const key = centers.map((c) => c.id).join('|');
    if (key === keysRef.current.centers) return;
    keysRef.current.centers = key;

    layers.centers.clearLayers();
    centers.forEach((c) => {
      const emoji = CENTER_EMOJI[c.type] || '📍';
      const icon = L.divIcon({
        className: '',
        html: `<div class="ec-pin">${emoji}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const marker = L.marker([c.lat, c.lng], { icon });
      marker.bindPopup(
        `<div class="pop-title">${emoji} ${esc(c.name)}</div>
         <div class="pop-row">${esc(c.address || '')}</div>
         <div class="pop-meta">${CENTER_LABEL[c.type] || c.type}${c.phone ? ' · ' + esc(c.phone) : ''}</div>`,
        { maxWidth: 280 }
      );
      layers.centers.addLayer(marker);
    });
  }, [centers]);

  /* ---------- route ---------- */
  useEffect(() => {
    const layers = layersRef.current;
    const map = mapRef.current;
    if (!layers || !map) return;
    layers.route.clearLayers();
    layers.ends.clearLayers();
    if (!route) return;

    const { fastest, recommended, samePath } = route;
    if (fastest && !samePath) {
      const fl = L.polyline(fastest.pathGeometry, {
        color: '#94a3b8', weight: 5, dashArray: '7 9', opacity: 0.9,
      });
      fl.bindTooltip(
        `⏱ Shortest route · ${fastest.km} km · ${fastest.etaMin} min · ${LEVEL_META[fastest.maxLevel].label}`,
        { sticky: true }
      );
      layers.route.addLayer(fl);
    }
    if (recommended) {
      layers.route.addLayer(
        L.polyline(recommended.pathGeometry, {
          color: 'rgba(34,211,238,0.20)', weight: 15, lineCap: 'round',
        })
      );
      const rl = L.polyline(recommended.pathGeometry, {
        color: '#22d3ee', weight: 6, opacity: 0.95, lineCap: 'round',
      });
      rl.bindTooltip(
        `🛡 FLUVORA safer route · ${recommended.km} km · ${recommended.etaMin} min`,
        { sticky: true }
      );
      layers.route.addLayer(rl);
    }
    const active = recommended || fastest;
    if (active) {
      const geo = active.pathGeometry;
      const mk = (ll, cls, label) =>
        L.marker(ll, {
          icon: L.divIcon({
            className: '',
            html: `<div class="end-pin ${cls}">${label}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
          interactive: false,
          zIndexOffset: 500,
        });
      layers.ends.addLayer(mk(geo[0], 'start', 'A'));
      layers.ends.addLayer(mk(geo[geo.length - 1], 'end', 'B'));
      map.fitBounds(L.latLngBounds(geo).pad(0.18), { animate: true });
    }
  }, [route]);

  return (
    <div
      className={`map-canvas ${pickMode ? 'map-picking' : ''}`}
      ref={elRef}
    />
  );
}
