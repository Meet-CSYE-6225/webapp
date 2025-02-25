const request = require('supertest');
const sinon = require('sinon');
const { Client } = require('pg');
require('dotenv').config();

let expect; // Declare expect for Chai
const app = require('../app'); // Use the app instance directly
const sequelize = require('../config/database'); // Import the Sequelize instance
let isPostgresRunning = false;

describe('Health Check API Tests', function() {
  // Dynamically import Chai and ensure the HealthCheck table exists before tests run.
  before(async function() {
    const chai = await import('chai');
    expect = chai.expect;

    // Synchronize tables to ensure HealthCheck table exists
    try {
      await sequelize.sync({ alter: true });
      console.log('Tables synchronized for testing.');
    } catch (syncError) {
      console.error('Error synchronizing tables:', syncError);
      throw syncError;
    }

    // Global check for PostgreSQL service before any tests run.
    const client = new Client({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME || 'postgres'
    });
    try {
      await client.connect();
      isPostgresRunning = true;
      console.log('PostgreSQL service is running.');
    } catch (err) {
      isPostgresRunning = false;
      console.log('PostgreSQL service is NOT running.');
    } finally {
      try {
        await client.end();
      } catch (err) {
        // Ignore disconnection errors
      }
    }
  });

  describe('When PostgreSQL is Running', function() {
    it('should return 200 for GET /healthz with no payload', function(done) {
      if (!isPostgresRunning)
        return done(new Error('Test requires PostgreSQL to be running, but it is not.'));
      request(app)
        .get('/healthz')
        .expect('Cache-Control', 'no-cache')
        .expect(200, done);
    });

    it('should return 405 for a PUT request to /healthz', function(done) {
      if (!isPostgresRunning)
        return done(new Error('Test requires PostgreSQL to be running, but it is not.'));
      request(app)
        .put('/healthz')
        .expect('Cache-Control', 'no-cache')
        .expect(405, done);
    });

    it('should return 405 for a POST request to /healthz', function(done) {
      if (!isPostgresRunning)
        return done(new Error('Test requires PostgreSQL to be running, but it is not.'));
      request(app)
        .post('/healthz')
        .expect('Cache-Control', 'no-cache')
        .expect(405, done);
    });

    it('should return 405 for a PATCH request to /healthz', function(done) {
      if (!isPostgresRunning)
        return done(new Error('Test requires PostgreSQL to be running, but it is not.'));
      request(app)
        .patch('/healthz')
        .expect('Cache-Control', 'no-cache')
        .expect(405, done);
    });

    it('should return 405 for a DELETE request to /healthz', function(done) {
      if (!isPostgresRunning)
        return done(new Error('Test requires PostgreSQL to be running, but it is not.'));
      request(app)
        .delete('/healthz')
        .expect('Cache-Control', 'no-cache')
        .expect(405, done);
    });

    it('should return 400 for GET /healthz when a payload is sent', function(done) {
      if (!isPostgresRunning)
        return done(new Error('Test requires PostgreSQL to be running, but it is not.'));
      request(app)
        .get('/healthz')
        .send({ extra: 'data' })
        .expect(400, done);
    });

    it('should return 400 for GET /healthz when query parameters are present', function(done) {
      if (!isPostgresRunning)
        return done(new Error('Test requires PostgreSQL to be running, but it is not.'));
      request(app)
        .get('/healthz?param=value')
        .expect(400, done);
    });

    it('should return 400 for GET /healthz with malformed JSON in the body', function(done) {
      if (!isPostgresRunning)
        return done(new Error('Test requires PostgreSQL to be running, but it is not.'));
      request(app)
        .get('/healthz')
        .set('Content-Type', 'application/json')
        .send('{"key":"value') // intentionally malformed JSON
        .expect(400, done);
    });
  });
});
