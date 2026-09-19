import { planRoutes } from '../services/store.js';

/**
 * POST /api/route  { from: nodeId, to: nodeId }
 * Returns the naive fastest route plus the FLUVORA risk-aware recommendation.
 */
export function plan(req, res) {
  const { from, to } = req.body || {};
  if (!from || !to) {
    return res.status(400).json({ error: 'Provide "from" and "to" node ids' });
  }
  const result = planRoutes(from, to);
  if (!result) {
    return res.status(404).json({ error: 'Unknown node id(s). See GET /api/nodes' });
  }
  if (!result.fastest) {
    return res
      .status(409)
      .json({ error: 'No route available — all corridors are blocked', ...result });
  }
  res.json(result);
}
