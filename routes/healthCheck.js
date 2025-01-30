
const express = require('express');
const { StatusCodes } = require('http-status-codes');
const HealthCheck = require('../models/healthCheckModel');

const router = express.Router();

// Health Check - Insert a record and confirm health
router.get('/', async (req, res) => {
  try {
    await HealthCheck.create({});
    res.status(StatusCodes.OK)
      .set('Cache-Control', 'no-cache')
      .end();
  } catch (error) {
    console.error('Database error:', error);
    res.status(StatusCodes.SERVICE_UNAVAILABLE)
      .set('Cache-Control', 'no-cache')
      .end();
  }
});

// Fetch table data debugging 
router.get('/data', async (req, res) => {
  try {
    const data = await HealthCheck.findAll();
    res.status(StatusCodes.OK)
      .set('Cache-Control', 'no-cache')
      .json(data);
  } catch (error) {
    console.error('Database error:', error);
    res.status(StatusCodes.SERVICE_UNAVAILABLE)
      .set('Cache-Control', 'no-cache')
      .end();
  }
});

// Handle unsupported methods
router.all('/', (req, res) => {
  res.status(StatusCodes.METHOD_NOT_ALLOWED)
    .set('Cache-Control', 'no-cache')
    .end();
});

module.exports = router;
