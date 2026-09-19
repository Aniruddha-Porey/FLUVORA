import { listCenters } from '../services/store.js';

export function list(req, res) {
  const { type } = req.query;
  res.json(listCenters(type));
}
