import { listRoads, getRoadWithReports, updateRoad } from '../services/store.js';

export function list(req, res) {
  res.json(listRoads());
}

export function get(req, res) {
  const road = getRoadWithReports(req.params.id);
  if (!road) return res.status(404).json({ error: 'Road not found' });
  res.json(road);
}

export async function updateStatus(req, res) {
  const road = await updateRoad(req.params.id, req.body || {});
  if (!road) return res.status(404).json({ error: 'Road not found' });
  res.json(road);
}
