const StatsD = require('hot-shots');

// Create a singleton instance of the real StatsD client.
const statsdClient = new StatsD({
  host: process.env.STATSD_HOST || 'localhost',
  port: process.env.STATSD_PORT || 8125,
  prefix: process.env.STATSD_PREFIX || 'webapp.'
});

// Middleware to record API metrics:
// It measures the total processing time (timer metric)
// and increments a counter for each API call.
function metricsMiddleware(req, res, next) {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    // Generate a metric name by replacing "/" with "." and trimming extra dots.
    const metricName = req.originalUrl.replace(/\//g, '.').replace(/^\.+|\.+$/g, '');
    // Record the API call duration (Timer metric, in ms)
    statsdClient.timing(`api.${metricName}.response_time`, duration);
    // Increment the counter for this API endpoint
    statsdClient.increment(`api.${metricName}.calls`);
  });
  next();
}

module.exports = { statsdClient, metricsMiddleware };
