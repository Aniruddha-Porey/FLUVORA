import { useEffect, useMemo, useState } from 'react';
import MapView from '../components/MapView.jsx';
import { api } from '../api.js';
import { LEVEL_META } from '../constants.js';

function StatCard({ label, value, sub, tone }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function AdminPage({ data, notify, refresh, theme, onHome }) {
  const { roads, reports, stats, weather, centers } = data;
  const [rain, setRain] = useState(weather.rainfallMmHr);
  const [roadQuery, setRoadQuery] = useState('');
  const [floodRoad, setFloodRoad] = useState('');
  const [waterLevel, setWaterLevel] = useState(75);
  const [tableQuery, setTableQuery] = useState('');

  useEffect(() => setRain(weather.rainfallMmHr), [weather.rainfallMmHr]);

  const namedRoads = useMemo(
    () => roads.filter((r) => r.name),
    [roads]
  );

  // Roads offered to the flood simulator (search-filtered)
  const simRoads = useMemo(() => {
    const q = roadQuery.trim().toLowerCase();
    const list = q ? namedRoads.filter((r) => r.name.toLowerCase().includes(q)) : [...namedRoads].sort((a, b) => b.confidence - a.confidence);
    return list.slice(0, 30);
  }, [namedRoads, roadQuery]);

  useEffect(() => {
    if (!floodRoad && simRoads.length) setFloodRoad(simRoads[0].id);
    if (floodRoad && !roads.find((r) => r.id === floodRoad)) setFloodRoad(simRoads[0]?.id || '');
  }, [simRoads, floodRoad, roads]);

  // Road table: top 40 by confidence, filterable
  const tableRoads = useMemo(() => {
    const q = tableQuery.trim().toLowerCase();
    const list = q
      ? roads.filter((r) => (r.name || '').toLowerCase().includes(q) || r.id === q)
      : roads;
    return [...list].sort((a, b) => b.confidence - a.confidence).slice(0, 40);
  }, [roads, tableQuery]);

  const roadName = (id) => roads.find((r) => r.id === id)?.name || id;

  async function act(fn, msg) {
    try {
      await fn();
      if (msg) notify(msg);
      refresh();
    } catch (e) {
      notify(e.message, 'err');
    }
  }

  return (
    <div className="admin">
      <div className="admin-title">
        <div>
          <h2>🖥️ FLUVORA Command Center</h2>
          <span className="muted">Live flood monitoring · report verification · road control</span>
        </div>
        <button className="btn btn-ghost" onClick={onHome}>⌂ Back to Home</button>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard tone="red" label="🔴 Critical Roads" value={stats.byLevel.high} />
        <StatCard tone="orange" label="🟠 High Risk Roads" value={stats.byLevel.moderate} />
        <StatCard tone="yellow" label="🟡 Caution Roads" value={stats.byLevel.caution} />
        <StatCard tone="slate" label="⚫ Blocked Roads" value={stats.byLevel.blocked} />
        <StatCard tone="blue" label="📍 Flood Reports" value={stats.totalReports} sub={`${stats.verifiedReports} verified`} />
        <StatCard tone="green" label="🏥 Emergency Centers" value={stats.centers} />
      </div>

      {/* Simulation + live map */}
      <div className="admin-cols">
        <section className="panel">
          <h3>
            🧪 Simulation Controls <span className="muted">(prototype data)</span>
          </h3>

          <label className="slider-row">
            🌧️ Rainfall
            <input type="range" min="0" max="100" value={rain} onChange={(e) => setRain(+e.target.value)} />
            <b>{rain} mm/h</b>
          </label>
          <div className="btn-row">
            <button className="btn" onClick={() => act(() => api.setWeather(rain), 'Rainfall updated 🌧️')}>
              Apply weather
            </button>
          </div>

          <hr />

          <label className="field">
            <span>Target road — search</span>
            <input
              type="text"
              placeholder="e.g. 4th Avenue, EM Bypass…"
              value={roadQuery}
              onChange={(e) => setRoadQuery(e.target.value)}
            />
          </label>
          <label className="field">
            <select value={floodRoad} onChange={(e) => setFloodRoad(e.target.value)} size={5} className="road-select">
              {simRoads.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.confidence}% · {r.waterLevelCm || 0} cm
                </option>
              ))}
            </select>
          </label>
          <label className="slider-row">
            🌊 Water level
            <input type="range" min="0" max="120" value={waterLevel} onChange={(e) => setWaterLevel(+e.target.value)} />
            <b>{waterLevel} cm</b>
          </label>
          <div className="btn-row wrap">
            <button
              className="btn btn-danger"
              onClick={() =>
                act(
                  () => api.simulateFlood({ roadId: floodRoad, waterLevelCm: waterLevel }),
                  `🌊 Flood simulated on ${roadName(floodRoad)}`
                )
              }
            >
              🌊 Trigger Flood
            </button>
            <button
              className="btn"
              onClick={() =>
                act(
                  () => api.setRoadStatus(floodRoad, { waterLevelCm: 0 }),
                  `🌤 ${roadName(floodRoad)} drained`
                )
              }
            >
              Drain road
            </button>
            <button className="btn btn-ghost" onClick={() => act(() => api.resetDemo(), '♻️ Demo reset')}>
              ♻️ Reset demo
            </button>
          </div>

          <div className="worst">
            <h4>🔥 Most critical roads</h4>
            {stats.worstRoads.map((w) => (
              <div key={w.id} className="worst-row">
                <span>{w.name}</span>
                <span className={`badge lvl-${w.level}`}>{w.confidence}%</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel map-panel">
          <h3>🗺️ Live Map</h3>
          <div className="admin-map">
            <MapView
              roads={roads}
              reports={reports}
              centers={centers}
              theme={theme}
              onRoadClick={() => {}}
              onReportConfirm={async (r) => {
                try {
                  await api.confirmReport(r.id);
                  refresh();
                } catch (e) {
                  notify(e.message, 'err');
                }
              }}
            />
          </div>
        </section>
      </div>

      {/* Reports table */}
      <section className="panel">
        <h3>📍 Flood Reports ({reports.length})</h3>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Road</th>
                <th>Water</th>
                <th>Severity</th>
                <th>Source</th>
                <th>Confirms</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="muted">
                    {new Date(r.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>{roadName(r.roadId)}</td>
                  <td>{r.waterLevelCm} cm</td>
                  <td>
                    <span className={`sev sev-${r.severity}`}>{r.severity}</span>
                  </td>
                  <td>{r.source === 'sensor' ? '🤖 sensor' : '👤 citizen'}</td>
                  <td>{r.confirmations}/6</td>
                  <td>
                    {r.verified ? <span className="tag-ok">✔ verified</span> : <span className="tag-warn">unverified</span>}
                  </td>
                  <td className="actions">
                    <button title="Community confirm" onClick={() => act(() => api.confirmReport(r.id))}>👍</button>
                    <button title="Admin verify" disabled={r.verified} onClick={() => act(() => api.verifyReport(r.id), 'Report verified ✅')}>✅</button>
                    <button title="Remove invalid report" className="danger-btn" onClick={() => act(() => api.deleteReport(r.id), 'Report removed 🗑')}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Roads table */}
      <section className="panel">
        <h3>🛣️ Road Network ({roads.length.toLocaleString('en-IN')} segments)</h3>
        <label className="field" style={{ maxWidth: 340 }}>
          <span>Filter roads</span>
          <input
            type="text"
            placeholder="Search by road name…"
            value={tableQuery}
            onChange={(e) => setTableQuery(e.target.value)}
          />
        </label>
        <p className="hint">Showing top {tableRoads.length} by flood confidence{tableQuery ? ` matching “${tableQuery}”` : ''}.</p>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Road</th>
                <th>Risk level</th>
                <th>Confidence</th>
                <th>Water (cm)</th>
                <th>Control</th>
              </tr>
            </thead>
            <tbody>
              {tableRoads.map((r) => (
                <tr key={r.id}>
                  <td>{r.name || <span className="muted">Unnamed ({r.id})</span>}</td>
                  <td>
                    <span className={`badge lvl-${r.level}`}>
                      {LEVEL_META[r.level].emoji} {LEVEL_META[r.level].label}
                    </span>
                  </td>
                  <td>{r.confidence}%</td>
                  <td>{r.waterLevelCm || 0}</td>
                  <td>
                    <select
                      value={r.statusOverride === 'blocked' ? 'blocked' : 'open'}
                      onChange={(e) =>
                        act(
                          () => api.setRoadStatus(r.id, { statusOverride: e.target.value === 'blocked' ? 'blocked' : null }),
                          e.target.value === 'blocked' ? `⚫ ${r.name || r.id} marked blocked` : `✅ ${r.name || r.id} reopened`
                        )
                      }
                    >
                      <option value="open">Open</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
