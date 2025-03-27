const express = require('express');
const { StatusCodes } = require('http-status-codes');
const HealthCheck = require('../models/healthCheckModel');
const winston = require('winston');
const { statsdClient } = require('../config/metrics'); // Use shared StatsD client

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) =>
      `${timestamp} [${level.toUpperCase()}] ${message}`
    )
  ),
  transports: [new winston.transports.Console()]
});

// GET /healthz: Create a health check entry and record metrics.
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
    statsdClient.timing('api.GET.healthz', duration);
    statsdClient.increment('api.GET.healthz.calls');
  }
});

// GET /healthz/data: Retrieve health check data and record metrics.
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
    statsdClient.timing('api.GET.healthz.data', duration);
    statsdClient.increment('api.GET.healthz.data.calls');
  }
});

// Handle unsupported methods on /healthz.
router.all('/', (req, res) => {
  logger.warn(`Method ${req.method} not allowed on /healthz`);
  res.status(StatusCodes.METHOD_NOT_ALLOWED).set('Cache-Control', 'no-cache').end();
});

module.exports = router;
