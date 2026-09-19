import { simulateFlood, setRainfall, resetDemo, getState } from '../services/store.js';

export async function flood(req, res) {
  const { roadId, waterLevelCm } = req.body || {};
  const out = await simulateFlood(roadId, waterLevelCm);
  if (!out) return res.status(404).json({ error: 'Road not found' });
  res.json(out);
}

export async function weather(req, res) {
  const updated = await setRainfall(Number((req.body || {}).rainfallMmHr));
  res.json({ weather: updated });
}

export async function reset(req, res) {
  await resetDemo();
  res.json({ ok: true, message: 'Demo state reset to initial scenario' });
}

export function weatherNow(req, res) {
  res.json(getState().weather);
}
