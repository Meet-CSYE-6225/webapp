// logger.js
const fs = require('fs');
const path = require('path');

// Define the log file location
const logFilePath = '/opt/csye6225/webapp/logs/app.log';
const logDir = path.dirname(logFilePath);

// Check if the directory exists; if not, create it recursively
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    console.log(`Log directory created: ${logDir}`);
  }
} catch (err) {
  console.error(`Failed to create log directory at ${logDir}:`, err);
  process.exit(1);
}

// Create a write stream in append mode
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

function formatMessage(level, message, error) {
  const timestamp = new Date().toISOString();
  let logMsg = `${timestamp} [${level}] ${message}`;
  if (error && error.stack) {
    logMsg += `\n${error.stack}`;
  }
  return logMsg;
}

function writeLog(level, message, error) {
  const logMsg = formatMessage(level, message, error);
  // Write to console
  if (level === 'error') {
    console.error(logMsg);
  } else if (level === 'warn') {
    console.warn(logMsg);
  } else {
    console.log(logMsg);
  }
  // Write to file
  logStream.write(logMsg + '\n');
}

const logger = {
  info: (msg) => writeLog('info', msg),
  warn: (msg) => writeLog('warn', msg),
  error: (msg, error) => writeLog('error', msg, error),
};

module.exports = logger;
