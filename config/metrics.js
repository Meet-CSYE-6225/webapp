
class DummyStatsD {
    increment(metric) {
      console.log(`Metric incremented: ${metric}`);
    }
    timing(metric, duration) {
      console.log(`Metric timing - ${metric}: ${duration}ms`);
    }
  }
  
  // Instantiate the dummy client
  const statsdClient = new DummyStatsD();
  
  // Middleware to record API metrics
  function metricsMiddleware(req, res, next) {
    const startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      // Sanitize originalUrl for metric naming: replace / with . and trim dots
      const metricName = req.originalUrl.replace(/\//g, '.').replace(/^\.+|\.+$/g, '');
      // Increment call count and record response time
      statsdClient.increment(`api.${metricName}.count`);
      statsdClient.timing(`api.${metricName}.response_time`, duration);
    });
    next();
  }
  
  module.exports = { statsdClient, metricsMiddleware };
  