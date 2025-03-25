const express = require('express');
const { StatusCodes } = require('http-status-codes');
const { Client } = require('pg');
const sequelize = require('./config/database');
const HealthCheck = require('./models/healthCheckModel');
require('dotenv').config();

// Import the logger 
const logger = require('./config/logger.js');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware to log every incoming request 
app.use((req, res, next) => {
  logger.info(`Incoming Request: ${req.method} ${req.url} - Headers: ${JSON.stringify(req.headers)}`);
  next();
});

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
    logger.info('Attempting to connect to PostgreSQL (default "postgres" database) for existence check.');
    await client.connect();
    logger.info('PostgreSQL connection established for database existence check.');
    const dbName = process.env.DB_NAME;
    logger.info(`Checking if database "${dbName}" exists.`);
    const checkDB = await client.query('SELECT 1 FROM pg_database WHERE datname = $1;', [dbName]);
    if (checkDB.rowCount === 0) {
      logger.info(`Database "${dbName}" does not exist. Creating database "${dbName}".`);
      await client.query(`CREATE DATABASE "${dbName}";`);
      logger.info(`Database "${dbName}" created successfully.`);
    } else {
      logger.info(`Database "${dbName}" already exists.`);
    }
  } catch (error) {
    logger.error('Error ensuring database exists: ' + error);
    throw error;
  } finally {
    await client.end();
    logger.info('PostgreSQL connection for database existence check closed.');
  }
}

// Function to ensure tables exist (creates or alters them as needed)
async function ensureTablesExist() {
  try {
    logger.info('Starting table synchronization process...');
    await sequelize.sync({ alter: true });
    logger.info('Tables synchronized successfully.');
  } catch (error) {
    logger.error('Error ensuring tables exist: ' + error);
    throw error;
  }
}

// Function to check if the HealthCheck table exists (used in the health check endpoint)
async function checkTableExists() {
  try {
    logger.info('Verifying that the HealthCheck table exists.');
    await HealthCheck.describe();
    logger.info('HealthCheck table exists.');
  } catch (error) {
    logger.error('HealthCheck table verification failed: ' + error);
    throw new Error('HealthCheck table does not exist');
  }
}

// Middleware to reject payloads or query parameters on GET /healthz
app.use('/healthz', (req, res, next) => {
  logger.info(`Received ${req.method} request at /healthz with query params: ${JSON.stringify(req.query)} and Content-Length: ${req.get('Content-Length')}`);
  if (req.method === 'GET') {
    const contentLength = req.get('Content-Length');
    const hasBody = contentLength && parseInt(contentLength) > 0;
    const hasQueryParams = Object.keys(req.query).length > 0;
    if (hasBody || hasQueryParams) {
      logger.warn('Rejected GET /healthz request due to presence of body or query parameters.');
      return res
        .status(StatusCodes.BAD_REQUEST)
        .set('Cache-Control', 'no-cache')
        .end();
    }
  }
  next();
});

// Explicitly handle HEAD requests for /healthz to return 405
app.head('/healthz', (req, res) => {
  logger.warn('HEAD request received at /healthz; responding with METHOD_NOT_ALLOWED.');
  return res
    .status(StatusCodes.METHOD_NOT_ALLOWED)
    .set('Cache-Control', 'no-cache')
    .end();
});

// Health Check Endpoint (GET only)
app.get('/healthz', async (req, res) => {
  logger.info('Health check endpoint invoked.');
  try {
    logger.info('Starting health check: verifying database existence.');
    await ensureDatabaseExists();
    logger.info('Attempting to authenticate with Sequelize.');
    await sequelize.authenticate();
    logger.info('Database connection verified via Sequelize.');
    await checkTableExists();
    logger.info('Inserting new health check record into HealthCheck table.');
    await HealthCheck.create({});
    logger.info('Health check record created successfully.');
    return res
      .status(StatusCodes.OK)
      .set('Cache-Control', 'no-cache')
      .end();
  } catch (error) {
    logger.error('Health check failed: ' + error);
    return res
      .status(StatusCodes.SERVICE_UNAVAILABLE)
      .set('Cache-Control', 'no-cache')
      .end();
  }
});

// Reject any requests to subpaths under /healthz 
app.use('/healthz/*', (req, res) => {
  logger.warn(`Request received for unsupported subpath under /healthz: ${req.originalUrl}`);
  return res
    .status(StatusCodes.BAD_REQUEST)
    .set('Cache-Control', 'no-cache')
    .end();
});

// Handle unsupported methods on /healthz (only GET is allowed)
app.all('/healthz', (req, res) => {
  if (req.method !== 'GET') {
    logger.warn(`Unsupported HTTP method ${req.method} received at /healthz.`);
    return res
      .status(StatusCodes.METHOD_NOT_ALLOWED)
      .set('Cache-Control', 'no-cache')
      .end();
  }
});

// Mount the versioned file routes (see routes/v1FileRoutes.js)
const v1FileRoutes = require('./routes/v1FileRoutes');
app.use('/v1/file', v1FileRoutes);
logger.info('Mounted /v1/file routes successfully.');

// Start the server only if this file is run directly
if (require.main === module) {
  (async function initializeServer() {
    logger.info('Server initialization started.');
    try {
      logger.info('Performing initial database existence check.');
      await ensureDatabaseExists();
      logger.info('Authenticating with database using Sequelize.');
      await sequelize.authenticate();
      logger.info('Database connection established successfully.');
      logger.info('Synchronizing tables (ensureTablesExist).');
      await ensureTablesExist();
      logger.info('Table synchronization complete.');
      app.listen(PORT, () => {
        logger.info(`Server is running on http://localhost:${PORT}`);
      });
    } catch (error) {
      logger.error('Server startup failed: ' + error);
      process.exit(1);
    }
  })();
} else {
  logger.info('App module imported as a library. Server initialization skipped.');
}

module.exports = app;
