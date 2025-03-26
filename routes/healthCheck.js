const express = require('express');
const { StatusCodes } = require('http-status-codes');
const HealthCheck = require('../models/healthCheckModel');
const winston = require('winston');
const StatsD = require('hot-shots');

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => `${timestamp} [${level.toUpperCase()}] ${message}`)
  ),
  transports: [new winston.transports.Console()]
});
const statsd = new StatsD({ host: 'localhost', port: 8125, prefix: 'webapp.' });

// GET /healthz
router.get('/', async (req, res) => {
  const start = Date.now();
  try {
    await HealthCheck.create({});
    logger.info('Health check successful');
    res.status(StatusCodes.OK).set('Cache-Control', 'no-cache').end();
  } catch (error) {
    logger.error('Database error', { error });
    res.status(StatusCodes.SERVICE_UNAVAILABLE).set('Cache-Control', 'no-cache').end();
  } finally {
    const duration = Date.now() - start;
    statsd.timing('api.GET.healthz', duration);
    statsd.increment('api.GET.healthz.calls');
  }
});

// GET /data (debugging)
router.get('/data', async (req, res) => {
  const start = Date.now();
  try {
    const data = await HealthCheck.findAll();
    logger.info('Fetched health check data');
    res.status(StatusCodes.OK).set('Cache-Control', 'no-cache').json(data);
  } catch (error) {
    logger.error('Database error', { error });
    res.status(StatusCodes.SERVICE_UNAVAILABLE).set('Cache-Control', 'no-cache').end();
  } finally {
    const duration = Date.now() - start;
    statsd.timing('api.GET.healthz.data', duration);
    statsd.increment('api.GET.healthz.data.calls');
  }
});

// Handle unsupported methods
router.all('/', (req, res) => {
  logger.warn(`Method ${req.method} not allowed on /`);
  res.status(StatusCodes.METHOD_NOT_ALLOWED).set('Cache-Control', 'no-cache').end();
});

module.exports = router;