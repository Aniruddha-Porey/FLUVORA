/**
 * Mongoose models — used only when MONGODB_URI is provided.
 * The prototype otherwise runs on the in-memory store.
 */
export default function buildModels(mongoose) {
  const roadSchema = new mongoose.Schema(
    {
      id: { type: String, unique: true, index: true },
      name: String,
      from: String,
      to: String,
      geometry: [[Number]],
      waterLevelCm: { type: Number, default: 0 },
      statusOverride: { type: String, default: null },
      lengthKm: Number,
      confidence: Number,
      level: String,
      updatedAt: String,
    },
    { minimize: false }
  );

  const reportSchema = new mongoose.Schema({
    id: { type: String, unique: true, index: true },
    roadId: String,
    lat: Number,
    lng: Number,
    waterLevelCm: Number,
    roadCondition: String,
    severity: String,
    description: String,
    source: String,
    confirmations: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    createdAt: String,
  });

  return {
    Road: mongoose.models.Road || mongoose.model('Road', roadSchema),
    Report: mongoose.models.Report || mongoose.model('Report', reportSchema),
  };
}
