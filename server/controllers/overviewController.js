import { getOverview } from '../services/store.js';

export function overview(req, res) {
  res.json(getOverview());
}
