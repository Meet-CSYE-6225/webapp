const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const File = require('../models/fileModel');

const router = express.Router();
const upload = multer();

// Initialize the S3 client (credentials are automatically picked up from the instance IAM role)
const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME;

// Inline authentication helper function
function requireAuth(req, res) {
  if (!req.headers['x-authenticated-user']) {
    res.status(401).json({ message: 'Authentication required' });
    return false;
  }
  return true;
}

// Helper to format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// POST /v1/file - Add file (Authenticated)
router.post('/', upload.single('file'), async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file provided.' });
    }
    const userId = req.headers['x-authenticated-user'];
    // Generate a unique S3 key using UUID
    const fileKey = `${uuidv4()}_${file.originalname}`;
    const params = {
      Bucket: bucketName,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    };
    // Upload file to S3
    await s3.putObject(params).promise();
    // Save file metadata in the database
    const fileRecord = await File.create({
      fileName: file.originalname,
      s3Key: fileKey,
      contentType: file.mimetype,
      size: file.size,
    });
    // Construct URL per the requirement (bucket-name/user-id/image-file.extension)
    const fileUrl = `${bucketName}/${userId}/${file.originalname}`;
    return res.status(201).json({
      file_name: file.originalname,
      id: fileRecord.id,
      url: fileUrl,
      upload_date: formatDate(fileRecord.uploadDate),
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return res.status(500).json({ message: 'File upload failed.' });
  }
});

// Explicit HEAD route for /v1/file/:id to return 405
router.head('/:id', (req, res) => {
  return res
    .status(405)
    .json({ message: 'HTTP Method not supported on this endpoint.' });
});

// GET /v1/file/:id - Retrieve file info (Public)
router.get('/:id', async (req, res) => {
  try {
    const fileRecord = await File.findByPk(req.params.id);
    if (!fileRecord) {
      return res.status(404).json({ message: 'File not found.' });
    }
    // Generate a pre-signed URL for file retrieval (valid for 1 hour)
    const fileUrl = s3.getSignedUrl('getObject', {
      Bucket: bucketName,
      Key: fileRecord.s3Key,
      Expires: 3600,
    });
    return res.status(200).json({
      file_name: fileRecord.fileName,
      id: fileRecord.id,
      url: fileUrl,
      upload_date: formatDate(fileRecord.uploadDate),
    });
  } catch (error) {
    console.error('Error retrieving file:', error);
    return res.status(500).json({ message: 'File retrieval failed.' });
  }
});

// DELETE /v1/file/:id - Delete file (Authenticated)
router.delete('/:id', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const fileRecord = await File.findByPk(req.params.id);
    if (!fileRecord) {
      return res.status(404).json({ message: 'File not found.' });
    }
    const params = {
      Bucket: bucketName,
      Key: fileRecord.s3Key,
    };
    // Delete file from S3
    await s3.deleteObject(params).promise();
    // Remove file record from the database
    await fileRecord.destroy();
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting file:', error);
    return res.status(500).json({ message: 'File deletion failed.' });
  }
});

// Reject unsupported HTTP methods on the /v1/file base route
router.all('/', (req, res) => {
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
  if (!['GET', 'DELETE'].includes(req.method)) {
    return res
      .status(405)
      .json({ message: 'HTTP Method not supported on this endpoint.' });
  }
});

module.exports = router;
