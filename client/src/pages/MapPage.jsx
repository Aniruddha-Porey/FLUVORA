import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView from '../components/MapView.jsx';
import ReportModal from '../components/ReportModal.jsx';
import { api } from '../api.js';
import { LEVEL_META } from '../constants.js';

const EMERGENCY = {
  medical: { label: 'Medical Emergency', emoji: '🚑', types: ['hospital'] },
  shelter: { label: 'Need Shelter', emoji: '🏠', types: ['shelter'] },
  fire: { label: 'Fire Emergency', emoji: '🚒', types: ['fire'] },
  general: { label: 'General Emergency', emoji: '🚨', types: ['police', 'relief'] },
};

function LevelBadge({ level }) {
  const m = LEVEL_META[level] || LEVEL_META.safe;
  return (
    <span className={`badge lvl-${level}`}>
      {m.emoji} {m.label}
    </span>
  );
}

export default function MapPage({ data, notify, refresh, theme, onHome }) {
  const { nodes, roads, reports, centers, pois } = data;
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [route, setRoute] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const [emergency, setEmergency] = useState(null);
  const [pickMode, setPickMode] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const emRef = useRef(null);

  const poiStart = useMemo(() => pois.find((p) => p.id === 'saltlake') || pois[0], [pois]);
  const poiEnd = useMemo(() => pois.find((p) => p.id === 'amri') || pois[1], [pois]);

  // Defaults: Salt Lake (Karunamoyee) → AMRI Hospital
  useEffect(() => {
    if (!start && poiStart) setStart({ kind: 'poi', poiId: poiStart.id, nodeId: poiStart.nodeId, label: poiStart.name, lat: poiStart.lat, lng: poiStart.lng });
    if (!end && poiEnd) setEnd({ kind: 'poi', poiId: poiEnd.id, nodeId: poiEnd.nodeId, label: poiEnd.name, lat: poiEnd.lat, lng: poiEnd.lng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pois]);

  const plan = useCallback(
    async (a, b) => {
      if (!a || !b) return;
      if (a.nodeId === b.nodeId) {
        notify('Start and destination resolve to the same point', 'err');
        return;
      }
      setBusy(true);
      try {
        setRoute(await api.planRoute(a.nodeId, b.nodeId));
      } catch (e) {
        notify(e.message, 'err');
      } finally {
        setBusy(false);
      }
    },
    [notify]
  );

  // Auto-plan the demo route once + handle landing-page intents
  const plannedRef = useRef(false);
  useEffect(() => {
    if (start && end && !plannedRef.current) {
      plannedRef.current = true;
      plan(start, end);
    }
    const intent = sessionStorage.getItem('fluvora_intent');
    if (intent === 'report') setModal({});
    if (intent === 'emergency') {
      setDrawerOpen(true);
      setTimeout(() => emRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    }
    sessionStorage.removeItem('fluvora_intent');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  /* ---------- picking points on the map ---------- */
  function nearestNode(lat, lng) {
    let best = null, bestD = Infinity;
    for (const n of nodes) {
      const d = (n.lat - lat) ** 2 + ((n.lng - lng) * 0.94) ** 2;
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  function handlePick({ lat, lng, mode }) {
    const n = nearestNode(lat, lng);
    if (!n) return notify('No road found there — try closer to a street', 'err');
    const point = { kind: 'pin', nodeId: n.id, label: `📍 Dropped pin`, lat, lng };
    if (mode === 'start') setStart(point);
    else setEnd(point);
    setPickMode(null);
    notify(`${mode === 'start' ? 'Start' : 'Destination'} set to nearest road junction ✅`);
    if (mode === 'end' && start) plan(start, point);
    if (mode === 'start' && end) plan(point, end);
  }

  function selectToPoi(which, poiId) {
    const poi = pois.find((p) => p.id === poiId);
    if (!poi) return;
    const point = { kind: 'poi', poiId: poi.id, nodeId: poi.nodeId, label: poi.name, lat: poi.lat, lng: poi.lng };
    if (which === 'start') {
      setStart(point);
      if (end) plan(point, end);
    } else {
      setEnd(point);
      setEmergency(null);
      if (start) plan(start, point);
    }
  }

  /* ---------- emergency mode ---------- */
  async function activateEmergency(key) {
    const { types } = EMERGENCY[key];
    const origin = start;
    if (!origin) return;
    const candidates = centers.filter((c) => types.includes(c.type));
    if (!candidates.length) return notify('No nearby centers found', 'err');
    const dist = (c) => Math.hypot(c.lat - origin.lat, (c.lng - origin.lng) * 0.94);
    const center = [...candidates].sort((a, b) => dist(a) - dist(b))[0];
    const point = { kind: 'center', nodeId: center.nodeId, label: center.name, lat: center.lat, lng: center.lng };
    setEmergency({ key, center });
    setEnd(point);
    await plan(origin, point);
    setDrawerOpen(false);
    notify(`${EMERGENCY[key].emoji} Emergency mode → routing to ${center.name}`);
  }

  async function onReportDone(err) {
    setModal(null);
    if (err) notify(err, 'err');
    else {
      notify('🌊 Report submitted — road risk updated');
      refresh();
    }
  }

  const deltaKm =
    route && !route.samePath && route.recommended && route.fastest
      ? (route.recommended.km - route.fastest.km).toFixed(1)
      : null;

  function renderPointSelect(which, value) {
    return (
      <select
        value={value?.kind === 'poi' ? value.poiId : '__pin'}
        onChange={(e) => e.target.value !== '__pin' && selectToPoi(which, e.target.value)}
      >
        {value?.kind !== 'poi' && <option value="__pin">{value?.label || '📍 Dropped pin'}</option>}
        {pois.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="map-page">
      <button
        className="drawer-toggle"
        onClick={() => setDrawerOpen((o) => !o)}
        title="Route planner & tools"
      >
        {drawerOpen ? '✕ Close' : '🧭 Plan Route'}
      </button>

      <aside className={`sidebar ${drawerOpen ? 'open' : ''}`}>
        <button className="btn btn-ghost wide home-btn" onClick={onHome}>
          ⌂ Back to Home
        </button>

        {/* Route planner */}
        <section className="panel">
          <h3>🧭 Flood-Aware Route Planner</h3>
          <label className="field">
            <span>Start</span>
            {renderPointSelect('start', start)}
          </label>
          <button
            className={`pick-btn ${pickMode === 'start' ? 'active' : ''}`}
            onClick={() => setPickMode(pickMode === 'start' ? null : 'start')}
          >
            {pickMode === 'start' ? '🎯 Click anywhere on the map…' : '📍 Or pick start point on map'}
          </button>
          <label className="field">
            <span>Destination</span>
            {renderPointSelect('end', end)}
          </label>
          <button
            className={`pick-btn ${pickMode === 'end' ? 'active' : ''}`}
            onClick={() => setPickMode(pickMode === 'end' ? null : 'end')}
          >
            {pickMode === 'end' ? '🎯 Click anywhere on the map…' : '📍 Or pick destination on map'}
          </button>
          <button
            className="btn btn-primary wide"
            onClick={() => plan(start, end)}
            disabled={busy || !start || !end}
          >
            {busy ? 'Calculating…' : '🛡 Find Safer Route'}
          </button>
          {pickMode && (
            <p className="hint">
              Click any spot on the map — FLUVORA snaps to the nearest real road junction
              (OpenStreetMap network).
            </p>
          )}
        </section>

        {/* Route analysis */}
        {route && (
          <section className="panel">
            <h3>📊 Route Analysis</h3>
            {route.samePath ? (
              <div className="route-card best">
                <div className="rc-head">
                  <span>🛡 Fastest route is already the safest</span>
                  <LevelBadge level={route.fastest.maxLevel} />
                </div>
                <div className="rc-stats">
                  {route.fastest.km} km · {route.fastest.etaMin} min
                </div>
              </div>
            ) : route.recommended ? (
              <>
                <div className="route-card">
                  <div className="rc-head">
                    <span>⏱ Shortest route</span>
                    <LevelBadge level={route.fastest.maxLevel} />
                  </div>
                  <div className="rc-stats">
                    {route.fastest.km} km · {route.fastest.etaMin} min
                  </div>
                  <div className="rc-note warn">
                    ⚠️ Crosses {route.fastest.riskyRoads} flooded / risky segment
                    {route.fastest.riskyRoads === 1 ? '' : 's'}
                  </div>
                </div>

                <div className="route-card best">
                  <div className="rc-head">
                    <span>🛡 FLUVORA safer route</span>
                    <LevelBadge level={route.recommended.maxLevel} />
                  </div>
                  <div className="rc-stats">
                    {route.recommended.km} km · {route.recommended.etaMin} min
                  </div>
                  <div className="rc-note ok">✅ Keeps you away from flooded corridors</div>
                  <ol className="rc-steps">
                    {route.recommended.steps.slice(0, 8).map((s, i) => (
                      <li key={i}>
                        <span className="dot" style={{ background: LEVEL_META[s.level].color }} />
                        {s.name}
                        <em>{s.km} km</em>
                      </li>
                    ))}
                    {route.recommended.steps.length > 8 && (
                      <li className="muted">… {route.recommended.steps.length - 8} more segments</li>
                    )}
                  </ol>
                </div>

                <p className="tradeoff">
                  🛡️ Safer route: <b>{route.recommended.km} km</b>
                  {Number(deltaKm) > 0.05
                    ? ` — only +${deltaKm} km longer, while avoiding flood risk.`
                    : ' — same distance, zero flood risk.'}
                </p>
              </>
            ) : (
              <div className="route-card danger">
                ⚫ No safe corridor available — every route crosses blocked roads.
              </div>
            )}
          </section>
        )}

        {/* Emergency mode */}
        <section className="panel" ref={emRef}>
          <h3>🚨 Emergency Mode</h3>
          <div className="em-grid">
            {Object.entries(EMERGENCY).map(([key, e]) => (
              <button
                key={key}
                className={`em-btn ${emergency?.key === key ? 'active' : ''}`}
                onClick={() => activateEmergency(key)}
              >
                <span className="em-emoji">{e.emoji}</span>
                {e.label}
              </button>
            ))}
          </div>
          {emergency && (
            <div className="em-banner">
              {EMERGENCY[emergency.key].emoji} Routing to <b>{emergency.center.name}</b> —{' '}
              {emergency.center.address}
              <button className="link-btn" onClick={() => setEmergency(null)}>cancel</button>
            </div>
          )}
        </section>

        {/* Legend */}
        <section className="panel">
          <h3>🗺️ Legend</h3>
          <div className="legend">
            {Object.entries(LEVEL_META).map(([k, m]) => (
              <div key={k} className="lg-row">
                <span className="lg-line" style={{ background: m.color }} />
                {m.emoji} {m.label}
              </div>
            ))}
            <div className="lg-row"><span className="lg-line route-line" />🛡 FLUVORA safer route</div>
            <div className="lg-row"><span className="lg-line fast-line" />⏱ Shortest route</div>
            <div className="lg-row">💧 Flood report · 🏥 Emergency center</div>
          </div>
        </section>

        <button className="btn btn-accent wide report-btn" onClick={() => { setModal({}); setDrawerOpen(false); }}>
          📢 Report Waterlogging / Blocked Road
        </button>
        <p className="hint center">Tip: click any road on the map to report its condition.</p>
      </aside>

      <div className="map-wrap">
        <MapView
          roads={roads}
          reports={reports}
          centers={centers}
          route={route}
          theme={theme}
          pickMode={pickMode}
          onPickPoint={handlePick}
          onRoadClick={(road) => setModal({ roadId: road.id })}
          onReportConfirm={async (r) => {
            try {
              await api.confirmReport(r.id);
              notify('👍 Thanks — confirmation recorded');
              refresh();
            } catch (e) {
              notify(e.message, 'err');
            }
          }}
        />
        {pickMode && (
          <div className="pick-banner">
            🎯 Tap the map to set your {pickMode === 'start' ? 'start' : 'destination'} — snaps to the
            nearest road junction
            <button onClick={() => setPickMode(null)}>Cancel</button>
          </div>
        )}
      </div>

      {modal && (
        <ReportModal
          roads={roads}
          initial={modal}
          onClose={() => setModal(null)}
          onDone={onReportDone}
        />
      )}
    </div>
  );
}
