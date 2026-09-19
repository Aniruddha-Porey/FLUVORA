import {
  listReports,
  addReport,
  confirmReport,
  verifyReport,
  deleteReport,
} from '../services/store.js';

export function list(req, res) {
  res.json(listReports());
}

export async function create(req, res) {
  try {
    const report = await addReport(req.body || {});
    res.status(201).json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function confirm(req, res) {
  const report = await confirmReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json(report);
}

export async function verify(req, res) {
  const report = await verifyReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json(report);
}

export async function remove(req, res) {
  const report = await deleteReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json({ ok: true, removed: report.id });
}
