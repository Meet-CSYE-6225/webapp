const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const { Client } = require('pg');
require('dotenv').config();

const baseURL = 'http://localhost:8080';
let isPostgresRunning = false;

describe('Health Check API Tests', function() {
  // Global check for PostgreSQL service before any tests run.
  before(async function() {
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
      request(baseURL)
        .get('/healthz')
        .expect('Cache-Control', 'no-cache')
        .expect(200, done);
    });

    it('should return 405 for a PUT request to /healthz', function(done) {
      if (!isPostgresRunning)
        return done(new Error('Test requires PostgreSQL to be running, but it is not.'));
      request(baseURL)
        .put('/healthz')
        .expect('Cache-Control', 'no-cache')
        .expect(405, done);
    });

    it('should return 405 for a POST request to /healthz', function(done) {
      if (!isPostgresRunning)
        return done(new Error('Test requires PostgreSQL to be running, but it is not.'));
      request(baseURL)
        .post('/healthz')
        .expect('Cache-Control', 'no-cache')
        .expect(405, done);
    });

    it('should return 405 for a PATCH request to /healthz', function(done) {
      if (!isPostgresRunning)
        return done(new Error('Test requires PostgreSQL to be running, but it is not.'));
      request(baseURL)
        .patch('/healthz')
        .expect('Cache-Control', 'no-cache')
        .expect(405, done);
    });

    it('should return 405 for a DELETE request to /healthz', function(done) {
      if (!isPostgresRunning)
        return done(new Error('Test requires PostgreSQL to be running, but it is not.'));
      request(baseURL)
        .delete('/healthz')
        .expect('Cache-Control', 'no-cache')
        .expect(405, done);
    });

    it('should return 400 for GET /healthz when a payload is sent', function(done) {
      if (!isPostgresRunning)
        return done(new Error('Test requires PostgreSQL to be running, but it is not.'));
      request(baseURL)
        .get('/healthz')
        .send({ extra: 'data' })
        .expect(400, done);
    });

    it('should return 400 for GET /healthz when query parameters are present', function(done) {
      if (!isPostgresRunning)
        return done(new Error('Test requires PostgreSQL to be running, but it is not.'));
      request(baseURL)
        .get('/healthz?param=value')
        .expect(400, done);
    });

    it('should return 400 for GET /healthz with malformed JSON in the body', function(done) {
      if (!isPostgresRunning)
        return done(new Error('Test requires PostgreSQL to be running, but it is not.'));
      request(baseURL)
        .get('/healthz')
        .set('Content-Type', 'application/json')
        .send('{"key":"value') // intentionally malformed JSON
        .expect(400, done);
    });
  });


});
