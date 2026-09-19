/**
 * FLUVORA Flood Risk Engine
 * Combines citizen reports, water-level data, rainfall and community
 * confirmations into a flood-confidence score per road.
 *
 * Weights (configurable prototype rules, not official safety thresholds):
 *   Citizen Reports       45%
 *   Water Level           25%
 *   Rainfall              20%
 *   Recent Confirmation   10%
 */

export const LEVELS = {
  SAFE: 'safe',
  CAUTION: 'caution',
  MODERATE: 'moderate',
  HIGH: 'high',
  BLOCKED: 'blocked',
};

export const WEIGHTS = { reports: 0.45, water: 0.25, rainfall: 0.2, confirm: 0.1 };

const SEVERITY_SCORE = { low: 0.35, medium: 0.7, high: 1 };

export const LEVEL_META = {
  safe: { label: 'Safe', color: '#34d399', emoji: '🟢', order: 0 },
  caution: { label: 'Caution', color: '#facc15', emoji: '🟡', order: 1 },
  moderate: { label: 'Moderate Risk', color: '#fb923c', emoji: '🟠', order: 2 },
  high: { label: 'High Risk', color: '#f87171', emoji: '🔴', order: 3 },
  blocked: { label: 'Blocked', color: '#94a3b8', emoji: '⚫', order: 4 },
};

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function geometryLengthKm(geometry) {
  let km = 0;
  for (let i = 1; i < geometry.length; i++) {
    km += haversineKm(
      { lat: geometry[i - 1][0], lng: geometry[i - 1][1] },
      { lat: geometry[i][0], lng: geometry[i][1] }
    );
  }
  return km;
}

/** Compute flood confidence (0–100) for a road. */
export function confidenceFor(road, reports, rainfallMmHr) {
  const roadReports = reports.filter((r) => r.roadId === road.id);

  // 1) Citizen reports (severity of worst report, boosted by volume)
  let reportScore = 0;
  if (roadReports.length > 0) {
    const maxSev = Math.max(...roadReports.map((r) => SEVERITY_SCORE[r.severity] ?? 0.35));
    const volumeBoost = Math.min(1, roadReports.length / 3);
    reportScore = maxSev * (0.5 + 0.5 * volumeBoost);
  }

  // 2) Water level sensors / reported water depth (saturates at 80 cm)
  const waterScore = clamp((road.waterLevelCm || 0) / 80, 0, 1);

  // 3) Rainfall intensity (saturates at 80 mm/h)
  const rainScore = clamp((rainfallMmHr || 0) / 80, 0, 1);

  // 4) Community confirmation (6+ confirmations or an admin verification)
  const totalConfirmations = roadReports.reduce((s, r) => s + (r.confirmations || 0), 0);
  const anyVerified = roadReports.some((r) => r.verified);
  const confirmScore = anyVerified ? 1 : clamp(totalConfirmations / 6, 0, 1);

  const conf =
    100 *
    (WEIGHTS.reports * reportScore +
      WEIGHTS.water * waterScore +
      WEIGHTS.rainfall * rainScore +
      WEIGHTS.confirm * confirmScore);

  return Math.round(clamp(conf, 0, 100));
}

/** Map confidence to a risk level. 0–25 🟢 | 26–50 🟡 | 51–75 🟠 | 76–100 🔴 */
export function levelFor(confidence) {
  if (confidence <= 25) return LEVELS.SAFE;
  if (confidence <= 50) return LEVELS.CAUTION;
  if (confidence <= 75) return LEVELS.MODERATE;
  return LEVELS.HIGH;
}
