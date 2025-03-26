// v1FileRoutes.js

const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
// Use Node's built-in crypto module instead of the 'uuid' package
const { randomUUID } = require('crypto');
const File = require('../models/fileModel');
const { statsdClient } = require('../config/metrics');
const logger = require('../config/logger');

const router = express.Router();
const upload = multer();

// Initialize the S3 client (credentials are automatically picked up from the instance IAM role)
const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME;

/**
 * Check for authentication header.
 * Logs details of the authentication check.
 */
function requireAuth(req, res) {
  if (!req.headers['x-authenticated-user']) {
    logger.warn('Authentication failed: Missing x-authenticated-user header.');
    res.status(401).json({ message: 'Authentication required' });
    return false;
  }
  logger.info(`Authentication successful for user: ${req.headers['x-authenticated-user']}`);
  return true;
}

/**
 * Helper to format a Date as YYYY-MM-DD.
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// POST /v1/file - Upload a file (Authenticated)
router.post('/', upload.single('file'), async (req, res) => {
  const start = Date.now();
  logger.info('Received POST /v1/file request for file upload.');

  if (!requireAuth(req, res)) return;
  
  try {
    const file = req.file;
    if (!file) {
      logger.warn('File upload failed: No file provided in the request.');
      return res.status(400).json({ message: 'No file provided.' });
    }
    logger.info(`File received: ${file.originalname} (Size: ${file.size} bytes)`);
    
    const userId = req.headers['x-authenticated-user'];
    
    // Upload file to S3 and log the timing
    const s3CallStart = Date.now();
    // Generate a unique file key using crypto.randomUUID()
    const fileKey = `${randomUUID()}_${file.originalname}`;
    const params = {
      Bucket: bucketName,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    };
    logger.info(`Initiating S3 putObject for key: ${fileKey}`);
    await s3.putObject(params).promise();
    const s3Duration = Date.now() - s3CallStart;
    statsdClient.timing('s3.putObject', s3Duration);
    logger.info(`S3 putObject successful for key: ${fileKey} (Duration: ${s3Duration} ms)`);

    // Insert file record into the database
    const dbQueryStart = Date.now();
    logger.info('Inserting file metadata into the database.');
    const fileRecord = await File.create({
      fileName: file.originalname,
      s3Key: fileKey,
      contentType: file.mimetype,
      size: file.size,
    });
    const dbDuration = Date.now() - dbQueryStart;
    statsdClient.timing('db.insertFile', dbDuration);
    logger.info(`Database insert successful for file: ${file.originalname} (Duration: ${dbDuration} ms, Record ID: ${fileRecord.id})`);

    // Build file URL based on bucket and user information
    const fileUrl = `${bucketName}/${userId}/${file.originalname}`;
    const totalDuration = Date.now() - start;
    statsdClient.timing('api.v1File.post', totalDuration);
    logger.info(`POST /v1/file completed successfully (Total Duration: ${totalDuration} ms).`);

    return res.status(201).json({
      file_name: file.originalname,
      id: fileRecord.id,
      url: fileUrl,
      upload_date: formatDate(fileRecord.uploadDate),
    });
  } catch (error) {
    logger.error('Error in POST /v1/file: ' + error);
    statsdClient.increment('api.v1File.post.error');
    return res.status(500).json({ message: 'File upload failed.' });
  }
});

// Explicit HEAD route for /v1/file/:id to return 405
router.head('/:id', (req, res) => {
  logger.warn(`HEAD request received for /v1/file/${req.params.id} - Method not supported.`);
  return res
    .status(405)
    .json({ message: 'HTTP Method not supported on this endpoint.' });
});

// GET /v1/file/:id - Retrieve file info (Public)
router.get('/:id', async (req, res) => {
  const start = Date.now();
  logger.info(`Received GET /v1/file/${req.params.id} request for file retrieval.`);
  try {
    const fileRecord = await File.findByPk(req.params.id);
    if (!fileRecord) {
      logger.warn(`File retrieval failed: File with ID ${req.params.id} not found.`);
      return res.status(404).json({ message: 'File not found.' });
    }
    // Generate a pre-signed URL for file retrieval (valid for 1 hour)
    const fileUrl = s3.getSignedUrl('getObject', {
      Bucket: bucketName,
      Key: fileRecord.s3Key,
      Expires: 3600,
    });
    const duration = Date.now() - start;
    statsdClient.timing('api.v1File.get', duration);
    logger.info(`GET /v1/file/${req.params.id} successful (Duration: ${duration} ms).`);
    return res.status(200).json({
      file_name: fileRecord.fileName,
      id: fileRecord.id,
      url: fileUrl,
      upload_date: formatDate(fileRecord.uploadDate),
    });
  } catch (error) {
    logger.error('Error in GET /v1/file/:id: ' + error);
    return res.status(500).json({ message: 'File retrieval failed.' });
  }
});

// DELETE /v1/file/:id - Delete file (Authenticated)
router.delete('/:id', async (req, res) => {
  const start = Date.now();
  logger.info(`Received DELETE /v1/file/${req.params.id} request for file deletion.`);
  if (!requireAuth(req, res)) return;
  
  try {
    const fileRecord = await File.findByPk(req.params.id);
    if (!fileRecord) {
      logger.warn(`File deletion failed: File with ID ${req.params.id} not found.`);
      return res.status(404).json({ message: 'File not found.' });
    }
    const params = {
      Bucket: bucketName,
      Key: fileRecord.s3Key,
    };
    logger.info(`Initiating deletion of file from S3 for key: ${fileRecord.s3Key}`);
    await s3.deleteObject(params).promise();
    logger.info(`S3 deletion successful for key: ${fileRecord.s3Key}`);
    
    logger.info(`Deleting file record from the database for file ID: ${fileRecord.id}`);
    await fileRecord.destroy();
    const duration = Date.now() - start;
    statsdClient.timing('api.v1File.delete', duration);
    logger.info(`DELETE /v1/file/${req.params.id} completed successfully (Duration: ${duration} ms).`);
    return res.status(204).end();
  } catch (error) {
    logger.error('Error in DELETE /v1/file/:id: ' + error);
    return res.status(500).json({ message: 'File deletion failed.' });
  }
});

// Reject unsupported HTTP methods on the /v1/file base route
router.all('/', (req, res) => {
  logger.warn(`Unsupported HTTP method ${req.method} received on /v1/file.`);
  // For GET and DELETE on /v1/file without an ID, return 400 Bad Request
  if (req.method === 'GET' || req.method === 'DELETE') {
    return res.status(400).json({ message: 'Bad Request' });
  }
  return res
    .status(405)
    .json({ message: 'HTTP Method not supported on this endpoint.' });
});

// Reject unsupported HTTP methods on the /v1/file/:id route
router.all('/:id', (req, res) => {
  logger.warn(`Unsupported HTTP method ${req.method} received on /v1/file/${req.params.id}.`);
  if (!['GET', 'DELETE'].includes(req.method)) {
    return res
      .status(405)
      .json({ message: 'HTTP Method not supported on this endpoint.' });
  }
});

module.exports = router;
