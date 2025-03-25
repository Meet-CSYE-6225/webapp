// metrics.js
const StatsD = require('node-statsd');

// Create a StatsD client (ensure STATSD_HOST and STATSD_PORT are set in your environment)
const statsdClient = new StatsD({
  host: process.env.STATSD_HOST || 'localhost',
  port: process.env.STATSD_PORT || 8125
});

// Middleware to record API metrics
function metricsMiddleware(req, res, next) {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    // Use the originalUrl sanitized for metric naming
    const metricName = req.originalUrl.replace(/\//g, '.').replace(/^\.+|\.+$/g, '');
    // Increment call count and record response time
    statsdClient.increment(`api.${metricName}.count`);
    statsdClient.timing(`api.${metricName}.response_time`, duration);
  });
  next();
}

module.exports = { statsdClient, metricsMiddleware };
