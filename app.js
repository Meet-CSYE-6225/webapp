const express = require('express');
const { StatusCodes } = require('http-status-codes');
const { Client } = require('pg');
const sequelize = require('./config/database');
const HealthCheck = require('./models/healthCheckModel');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT;

// PostgreSQL Client for database creation
async function ensureDatabaseExists() {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: 'postgres', // Connect to default PostgreSQL database
  });

  try {
    await client.connect();
    const dbName = process.env.DB_NAME;
    const checkDB = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1;`,
      [dbName]
    );

    if (checkDB.rowCount === 0) {
      console.log(`Database "${dbName}" does not exist. Creating it...`);
      await client.query(`CREATE DATABASE "${dbName}";`);
      console.log(`Database "${dbName}" created successfully.`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } catch (error) {
    console.error('Error ensuring database exists:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Function to ensure tables exist (creates or alters them as needed)
async function ensureTablesExist() {
  try {
    console.log('Ensuring tables exist...');
    await sequelize.sync({ alter: true });
    console.log('Tables synchronized successfully.');
  } catch (error) {
    console.error('Error ensuring tables exist:', error);
    throw error;
  }
}

// Function to check if the HealthCheck table exists (used in the health check endpoint)
async function checkTableExists() {
  try {
    await HealthCheck.describe();
  } catch (error) {
    throw new Error('HealthCheck table does not exist');
  }
}

// Middleware to reject payloads or query parameters on GET /healthz
app.use('/healthz', (req, res, next) => {
  if (req.method === 'GET') {
    const contentLength = req.get('Content-Length');
    const hasBody = contentLength && parseInt(contentLength) > 0;
    const hasQueryParams = Object.keys(req.query).length > 0;
    if (hasBody || hasQueryParams) {
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
  return res
    .status(StatusCodes.METHOD_NOT_ALLOWED)
    .set('Cache-Control', 'no-cache')
    .end();
});

// Health Check Endpoint (GET only)
app.get('/healthz', async (req, res) => {
  try {
    console.log('Checking database and tables before processing request...');
    await ensureDatabaseExists();
    await sequelize.authenticate();
    console.log('Database connection verified.');
    await checkTableExists();
    await HealthCheck.create({});
    console.log('Health check entry added.');
    return res
      .status(StatusCodes.OK)
      .set('Cache-Control', 'no-cache')
      .end();
  } catch (error) {
    console.error('Health check failed:', error);
    return res
      .status(StatusCodes.SERVICE_UNAVAILABLE)
      .set('Cache-Control', 'no-cache')
      .end();
  }
});

// Reject any requests to subpaths under /healthz (e.g., /healthz/app)
app.use('/healthz/*', (req, res) => {
  return res
    .status(StatusCodes.BAD_REQUEST)
    .set('Cache-Control', 'no-cache')
    .end();
});

// Handle unsupported methods on /healthz (only GET is allowed)
app.all('/healthz', (req, res) => {
  if (req.method !== 'GET') {
    return res
      .status(StatusCodes.METHOD_NOT_ALLOWED)
      .set('Cache-Control', 'no-cache')
      .end();
  }
});

// Mount the versioned file routes (see routes/v1FileRoutes.js)
const v1FileRoutes = require('./routes/v1FileRoutes');
app.use('/v1/file', v1FileRoutes);

// Start the server only if this file is run directly
if (require.main === module) {
  (async function initializeServer() {
    try {
      console.log('Starting database check...');
      await ensureDatabaseExists();
      console.log('Connecting to database...');
      await sequelize.authenticate();
      console.log('Database connection successful.');
      console.log('Ensuring tables exist...');
      await ensureTablesExist();
      app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
      });
    } catch (error) {
      console.error('Server startup failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = app;
