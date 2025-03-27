const winston = require('winston');
require('winston-cloudwatch');

const transports = [];

// Add a file transport so that logs are written to /var/log/csye6225.log
transports.push(new winston.transports.File({
  filename: '/var/log/csye6225.log',
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
}));

// Add CloudWatch transport if not running in test environment
if (process.env.NODE_ENV !== 'test') {
  transports.push(new winston.transports.CloudWatch({
    logGroupName: process.env.CLOUDWATCH_LOG_GROUP || 'csye6225-app-logs',
    logStreamName: process.env.CLOUDWATCH_LOG_STREAM || 'app-logs',
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    jsonMessage: true,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
  }));
}

// Also add console transport for local development and debugging
transports.push(new winston.transports.Console());

const logger = winston.createLogger({
  level: 'info',
  transports,
});

module.exports = logger;
