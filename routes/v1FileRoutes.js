const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const File = require('../models/fileModel');
const winston = require('winston');
const StatsD = require('hot-shots');

const router = express.Router();
const upload = multer();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => `${timestamp} [${level.toUpperCase()}] ${message}`)
  ),
  transports: [new winston.transports.Console()]
});
const statsd = new StatsD({ host: 'localhost', port: 8125, prefix: 'webapp.' });

const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME;

function requireAuth(req, res) {
  if (!req.headers['x-authenticated-user']) {
    logger.warn('Authentication required');
    res.status(401).json({ message: 'Authentication required' });
    return false;
  }
  return true;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// POST /v1/file
router.post('/', upload.single('file'), async (req, res) => {
  const start = Date.now();
  if (!requireAuth(req, res)) return;
  try {
    const file = req.file;
    if (!file) {
      logger.warn('No file provided');
      return res.status(400).json({ message: 'No file provided.' });
    }
    const userId = req.headers['x-authenticated-user'];
    const fileKey = `${uuidv4()}_${file.originalname}`;
    const params = {
      Bucket: bucketName,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    };
    const s3Start = Date.now();
    await s3.putObject(params).promise();
    statsd.timing('s3.putObject', Date.now() - s3Start);
    const fileRecord = await File.create({
      fileName: file.originalname,
      s3Key: fileKey,
      contentType: file.mimetype,
      size: file.size,
    });
    const fileUrl = `${bucketName}/${userId}/${file.originalname}`;
    logger.info(`File uploaded: ${file.originalname}`);
    res.status(201).json({
      file_name: file.originalname,
      id: fileRecord.id,
      url: fileUrl,
      upload_date: formatDate(fileRecord.uploadDate),
    });
  } catch (error) {
    logger.error('Error uploading file', { error });
    res.status(500).json({ message: 'File upload failed.' });
  } finally {
    statsd.timing('api.POST.v1.file', Date.now() - start);
    statsd.increment('api.POST.v1.file.calls');
  }
});

// HEAD /v1/file/:id
router.head('/:id', (req, res) => {
  logger.warn('HEAD request not supported');
  res.status(405).json({ message: 'HTTP Method not supported on this endpoint.' });
});

// GET /v1/file/:id
router.get('/:id', async (req, res) => {
  const start = Date.now();
  try {
    const fileRecord = await File.findByPk(req.params.id);
    if (!fileRecord) {
      logger.warn(`File not found: ${req.params.id}`);
      return res.status(404).json({ message: 'File not found.' });
    }
    const fileUrl = s3.getSignedUrl('getObject', {
      Bucket: bucketName,
      Key: fileRecord.s3Key,
      Expires: 3600,
    });
    logger.info(`File retrieved: ${fileRecord.fileName}`);
    res.status(200).json({
      file_name: fileRecord.fileName,
      id: fileRecord.id,
      url: fileUrl,
      upload_date: formatDate(fileRecord.uploadDate),
    });
  } catch (error) {
    logger.error('Error retrieving file', { error });
    res.status(500).json({ message: 'File retrieval failed.' });
  } finally {
    statsd.timing('api.GET.v1.file.id', Date.now() - start);
    statsd.increment('api.GET.v1.file.id.calls');
  }
});

// DELETE /v1/file/:id
router.delete('/:id', async (req, res) => {
  const start = Date.now();
  if (!requireAuth(req, res)) return;
  try {
    const fileRecord = await File.findByPk(req.params.id);
    if (!fileRecord) {
      logger.warn(`File not found: ${req.params.id}`);
      return res.status(404).json({ message: 'File not found.' });
    }
    const params = { Bucket: bucketName, Key: fileRecord.s3Key };
    const s3Start = Date.now();
    await s3.deleteObject(params).promise();
    statsd.timing('s3.deleteObject', Date.now() - s3Start);
    await fileRecord.destroy();
    logger.info(`File deleted: ${fileRecord.fileName}`);
    res.status(204).end();
  } catch (error) {
    logger.error('Error deleting file', { error });
    res.status(500).json({ message: 'File deletion failed.' });
  } finally {
    statsd.timing('api.DELETE.v1.file.id', Date.now() - start);
    statsd.increment('api.DELETE.v1.file.id.calls');
  }
});

// Handle unsupported methods
router.all('/', (req, res) => {
  if (['GET', 'DELETE'].includes(req.method)) {
    logger.warn('Bad request on /v1/file');
    res.status(400).json({ message: 'Bad Request' });
  } else {
    logger.warn(`Method ${req.method} not supported on /v1/file`);
    res.status(405).json({ message: 'HTTP Method not supported on this endpoint.' });
  }
});

router.all('/:id', (req, res) => {
  if (!['GET', 'DELETE'].includes(req.method)) {
    logger.warn(`Method ${req.method} not supported on /v1/file/:id`);
    res.status(405).json({ message: 'HTTP Method not supported on this endpoint.' });
  }
});

module.exports = router;