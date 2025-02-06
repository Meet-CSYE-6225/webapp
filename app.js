const express = require('express');
const { StatusCodes } = require('http-status-codes');
const { Client } = require('pg');
const sequelize = require('./config/database');
const HealthCheck = require('./models/healthCheckModel');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT ;

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
      console.log(` Database "${dbName}" does not exist. Creating it...`);
      await client.query(`CREATE DATABASE "${dbName}";`);
      console.log(`Database "${dbName}" created successfully.`);
    } else {
      console.log(` Database "${dbName}" already exists.`);
    }
  } catch (error) {
    console.error(' Error ensuring database exists:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Function to ensure tables exist
async function ensureTablesExist() {
  try {
    console.log(' Ensuring tables exist...');
    await sequelize.sync({ alter: true }); // Create or update tables
    console.log(' Tables synchronized successfully.');
  } catch (error) {
    console.error(' Error ensuring tables exist:', error);
    throw error;
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

// Health Check Endpoint with Dynamic Database and Table Creation
// This route matches only exactly '/healthz'
app.get('/healthz', async (req, res) => {
  try {
    console.log(' Checking database and tables before processing request...');
    
    // Ensure database exists
    await ensureDatabaseExists();
    // Reconnect Sequelize to ensure pointing to the correct database
    await sequelize.authenticate();
    console.log(' Database connection verified.');

    // Ensure tables exist
    await ensureTablesExist();

    // Create a health check entry
    await HealthCheck.create({});
    console.log(' Health check entry added.');

    return res
      .status(StatusCodes.OK)
      .set('Cache-Control', 'no-cache')
      .end();
  } catch (error) {
    console.error(' Health check failed:', error);
    return res
      .status(StatusCodes.SERVICE_UNAVAILABLE)
      .set('Cache-Control', 'no-cache')
      .end();
  }
});

// This middleware catches any requests to subpaths under '/healthz'
// For example, '/healthz/app' will return 400 Bad Request
app.use('/healthz/*', (req, res) => {
  return res
    .status(StatusCodes.BAD_REQUEST)
    .set('Cache-Control', 'no-cache')
    .end();
});

// Handle unsupported methods on '/healthz'
app.all('/healthz', (req, res) => {
  if (req.method !== 'GET') {
    return res
      .status(StatusCodes.METHOD_NOT_ALLOWED)
      .set('Cache-Control', 'no-cache')
      .end();
  }
});

// Start the server after ensuring database initialization
(async function initializeServer() {
  try {
    console.log(' Starting database check...');
    await ensureDatabaseExists();
    
    console.log(' Connecting to database...');
    await sequelize.authenticate();
    console.log(' Database connection successful.');

    console.log(' Ensuring tables exist...');
    await ensureTablesExist();

    app.listen(PORT, () => {
      console.log(` Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(' Server startup failed:', error);
    process.exit(1);
  }
})();
