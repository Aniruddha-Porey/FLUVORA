import { Router } from 'express';
import * as overview from '../controllers/overviewController.js';
import * as reports from '../controllers/reportsController.js';
import * as roads from '../controllers/roadsController.js';
import * as route from '../controllers/routeController.js';
import * as emergency from '../controllers/emergencyController.js';
import * as simulate from '../controllers/simulateController.js';
import { listNodes, listPois, getLive } from '../services/store.js';

const router = Router();

// Flood reports
router.get('/reports', reports.list);
router.post('/reports', reports.create);
router.patch('/reports/:id/confirm', reports.confirm);
router.patch('/reports/:id/verify', reports.verify);
router.delete('/reports/:id', reports.remove);

// Roads
router.get('/roads', roads.list);
router.get('/roads/:id', roads.get);
router.patch('/roads/:id/status', roads.updateStatus);

// Routing
router.post('/route', route.plan);

// Emergency centers
router.get('/emergency-centers', emergency.list);

// Reference data
router.get('/nodes', (req, res) => res.json(listNodes()));
router.get('/pois', (req, res) => res.json(listPois()));
router.get('/weather', simulate.weatherNow);

// Overview (full snapshot — first load)
router.get('/overview', overview.overview);

// Live updates (compact — polled by the UI; ?since=ISO keeps it tiny)
router.get('/live', (req, res) => res.json(getLive(req.query.since || null)));

// Simulation / demo controls
router.post('/simulate/flood', simulate.flood);
router.post('/simulate/weather', simulate.weather);
router.post('/simulate/reset', simulate.reset);

export default router;
