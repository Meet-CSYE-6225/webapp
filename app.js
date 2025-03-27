// app.js
const express = require('express');
const { StatusCodes } = require('http-status-codes');
const { Client } = require('pg');
const sequelize = require('./config/database');
const HealthCheck = require('./models/healthCheckModel');
const logger = require('./config/logger');
const StatsD = require('hot-shots');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Configure StatsD using hot-shots
const statsd = new StatsD({ host: 'localhost', port: 8125, prefix: 'webapp.' });

// Wrap raw pg queries to measure execution time (in ms) and record a Timer metric.
async function timedPgQuery(client, queryText, values, metricName) {
  const start = Date.now();
  const result = await client.query(queryText, values);
  const duration = Date.now() - start;
  statsd.timing(`db.${metricName}`, duration);
  return result;
}

// Wrap Sequelize query calls to measure execution time (in ms) and record a Timer metric.
async function timedSequelizeQuery(queryFunction, metricName, ...args) {
  const start = Date.now();
  const result = await queryFunction(...args);
  const duration = Date.now() - start;
  statsd.timing(`db.${metricName}`, duration);
  return result;
}


// PostgreSQL Client for database creation
async function ensureDatabaseExists() {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: 'postgres',
  });

  try {
    await client.connect();
    const dbName = process.env.DB_NAME;
    const checkDB = await timedPgQuery(
      client,
      `SELECT 1 FROM pg_database WHERE datname = $1;`,
      [dbName],
      'ensureDatabaseExists.check'
    );

    if (checkDB.rowCount === 0) {
      logger.info(`Database "${dbName}" does not exist. Creating it...`);
      await timedPgQuery(client, `CREATE DATABASE "${dbName}";`, [], 'ensureDatabaseExists.create');
      logger.info(`Database "${dbName}" created successfully`);
    } else {
      logger.info(`Database "${dbName}" already exists`);
    }
  } catch (error) {
    logger.error('Error ensuring database exists', { error });
    throw error;
  } finally {
    await client.end();
  }
}

// Ensure tables exist via Sequelize
async function ensureTablesExist() {
  try {
    logger.info('Ensuring tables exist...');
    await timedSequelizeQuery(() => sequelize.sync({ alter: true }), 'sync_tables');
    logger.info('Tables synchronized successfully');
  } catch (error) {
    logger.error('Error ensuring tables exist', { error });
    throw error;
  }
}

// Check if HealthCheck table exists
async function checkTableExists() {
  try {
    await HealthCheck.describe();
  } catch (error) {
    logger.error('HealthCheck table does not exist', { error });
    throw error;
  }
}

// Request logging middleware records API call duration and count.
app.use((req, res, next) => {
  const start = Date.now();
  logger.info(`Received ${req.method} request to ${req.path}`);
  res.on('finish', () => {
    const duration = Date.now() - start;
    // Timer metric for the API call duration
    statsd.timing(`api.${req.method}.${req.path.replace(/\//g, '_')}`, duration);
    // Counter metric for number of calls
    statsd.increment(`api.${req.method}.${req.path.replace(/\//g, '_')}.calls`);
    logger.info(`Completed ${req.method} ${req.path} with status ${res.statusCode} in ${duration}ms`);
  });
  next();
});

// Middleware to reject payloads or query parameters on GET /healthz
app.use('/healthz', (req, res, next) => {
  if (req.method === 'GET') {
    const contentLength = req.get('Content-Length');
    const hasBody = contentLength && parseInt(contentLength) > 0;
    const hasQueryParams = Object.keys(req.query).length > 0;
    if (hasBody || hasQueryParams) {
      logger.warn('Bad request: Payload or query parameters on GET /healthz');
      return res.status(StatusCodes.BAD_REQUEST).set('Cache-Control', 'no-cache').end();
    }
  }
  next();
});

// HEAD /healthz - Not allowed
app.head('/healthz', (req, res) => {
  logger.warn('HEAD request to /healthz not allowed');
  res.status(StatusCodes.METHOD_NOT_ALLOWED).set('Cache-Control', 'no-cache').end();
});

// GET /healthz: If RDS is down, an error is caught and 503 is returned.
app.get('/healthz', async (req, res) => {
  try {
    logger.info('Checking database and tables before processing request');
    await ensureDatabaseExists();
    await sequelize.authenticate();
    logger.info('Database connection verified');
    await checkTableExists();
    await HealthCheck.create({});
    logger.info('Health check entry added');
    res.status(StatusCodes.OK).set('Cache-Control', 'no-cache').end();
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(StatusCodes.SERVICE_UNAVAILABLE).set('Cache-Control', 'no-cache').end();
  }
});

// Reject subpaths under /healthz
app.use('/healthz/*', (req, res) => {
  logger.warn(`Invalid subpath ${req.path} under /healthz`);
  res.status(StatusCodes.BAD_REQUEST).set('Cache-Control', 'no-cache').end();
});

// Handle unsupported methods on /healthz
app.all('/healthz', (req, res) => {
  if (req.method !== 'GET') {
    logger.warn(`Method ${req.method} not allowed on /healthz`);
    res.status(StatusCodes.METHOD_NOT_ALLOWED).set('Cache-Control', 'no-cache').end();
  }
});

// Mount file routes
const v1FileRoutes = require('./routes/v1FileRoutes');
app.use('/v1/file', v1FileRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.stack });
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).send('Internal Server Error');
});

// Start server
if (require.main === module) {
  (async function initializeServer() {
    try {
      logger.info('Starting database check...');
      await ensureDatabaseExists();
      logger.info('Connecting to database...');
      await sequelize.authenticate();
      logger.info('Database connection successful');
      await ensureTablesExist();
      app.listen(PORT, () => {
        logger.info(`Server is running on http://localhost:${PORT}`);
      });
    } catch (error) {
      logger.error('Server startup failed', { error });
      process.exit(1);
    }
  })();
}

module.exports = app;
