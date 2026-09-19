import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initStore, getMode } from './services/store.js';
import apiRoutes from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/', (req, res) => {
  res.json({
    app: 'FLUVORA API',
    tagline: 'Navigate Safer. Respond Faster.',
    status: 'online',
    endpoints: [
      'GET  /api/overview',
      'GET  /api/roads',
      'GET  /api/roads/:id',
      'PATCH /api/roads/:id/status',
      'GET  /api/reports',
      'POST /api/reports',
      'PATCH /api/reports/:id/confirm',
      'PATCH /api/reports/:id/verify',
      'DELETE /api/reports/:id',
      'POST /api/route',
      'GET  /api/emergency-centers',
      'POST /api/simulate/flood',
      'POST /api/simulate/weather',
      'POST /api/simulate/reset',
    ],
  });
});

app.get('/api/health', (req, res) => {
  res.json({ app: 'FLUVORA API', status: 'online', store: getMode() });
});

app.use('/api', apiRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('💥', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

initStore()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🌊 FLUVORA API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize store:', err);
    process.exit(1);
  });
