// logger.js
const { createLogger, format, transports } = require('winston');

const logFormat = format.combine(
  format.timestamp(),
  // If an error is logged, include the stack trace.
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}] ${stack || message}`;
  })
);

const logger = createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new transports.File({
      filename: '/opt/csye6225/webapp/logs/app.log', // Ensure this directory is writable and monitored by CloudWatch
      handleExceptions: true,
      maxsize: 5242880, // 5MB per file
      maxFiles: 5,
    }),
  ],
  exitOnError: false,
});

module.exports = logger;
