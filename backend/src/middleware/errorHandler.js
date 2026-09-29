function errorHandler(err, req, res, next) {
  const isProduction = (process.env.NODE_ENV || 'development') === 'production';
  const status = err.status || 500;

  // Log full error server-side always (console only, not in response)
  if (status >= 500) {
    console.error('[Silent Ledger Server Error]:', err);
  }

  res.status(status).json({
    success: false,
    error: err.name || 'InternalServerError',
    // In production, mask internal 500 messages to avoid leaking stack traces or paths
    message: (isProduction && status >= 500)
      ? 'An unexpected server error occurred.'
      : (err.message || 'An unexpected server error occurred.'),
    timestamp: new Date().toISOString()
  });
}

module.exports = errorHandler;
