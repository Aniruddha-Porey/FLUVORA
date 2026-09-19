import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

export default function ReportModal({ roads, initial, onClose, onDone }) {
  const [roadId, setRoadId] = useState(initial?.roadId || '');
  const [query, setQuery] = useState('');
  const [water, setWater] = useState(35);
  const [condition, setCondition] = useState('waterlogged');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => roads.find((r) => r.id === roadId) || null, [roads, roadId]);

  // Searchable named-road list (the network has thousands of segments)
  const matches = useMemo(() => {
    const named = roads.filter((r) => r.name);
    const q = query.trim().toLowerCase();
    const list = q ? named.filter((r) => r.name.toLowerCase().includes(q)) : named;
    return [...list]
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .filter((r, i, arr) => arr.findIndex((x) => x.name === r.name && x.id !== r.id) === -1 || i >= 0)
      .slice(0, 40);
  }, [roads, query]);

  useEffect(() => {
    if (!selected && matches.length && !roadId && !initial?.roadId) {
      // leave unselected until user chooses
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!roadId) return;
    setSaving(true);
    try {
      await api.createReport({
        roadId,
        waterLevelCm: water,
        roadCondition: condition,
        severity,
        description,
      });
      onDone();
    } catch (err) {
      setSaving(false);
      onDone(err.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>📢 Report Road Flooding</h3>
          <button type="button" className="x-btn" onClick={onClose}>✕</button>
        </div>

        {selected ? (
          <div className="field">
            <span>📍 Affected road</span>
            <div className="selected-road">
              <b>{selected.name || 'Unnamed road'}</b>
              {!initial?.roadId && (
                <button type="button" className="link-btn" onClick={() => setRoadId('')}>
                  change
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="field">
            <span>📍 Search the affected road</span>
            <input
              type="text"
              placeholder="Type a road name e.g. 4th Avenue…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="road-results">
              {matches.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className="road-result"
                  onClick={() => setRoadId(r.id)}
                >
                  {r.name}
                  <em>{r.lengthKm.toFixed(1)} km</em>
                </button>
              ))}
              {!matches.length && <p className="hint">No matching roads — try another spelling.</p>}
            </div>
            <p className="hint">Tip: you can also click a road directly on the map to report it.</p>
          </div>
        )}

        <label className="field">
          <span>🌊 Water level — <b>{water} cm</b></span>
          <input type="range" min="0" max="120" value={water} onChange={(e) => setWater(+e.target.value)} />
        </label>

        <div className="field-row">
          <label className="field">
            <span>🚧 Road condition</span>
            <select value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="wet">Wet</option>
              <option value="waterlogged">Waterlogged</option>
              <option value="difficult">Difficult to cross</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
          <label className="field">
            <span>⚠️ Severity</span>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <label className="field">
          <span>📝 Description</span>
          <textarea
            rows={2}
            placeholder="What do you see on the road?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label className="field file-field">
          <span>📷 Photo (optional)</span>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0]?.name || '')} />
          {photo && <em className="muted">attached: {photo}</em>}
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !roadId}>
            {saving ? 'Submitting…' : '🌊 Submit report'}
          </button>
        </div>
        <p className="hint">
          6+ community confirmations verify this report automatically and raise the road's flood risk.
        </p>
      </form>
    </div>
  );
}
