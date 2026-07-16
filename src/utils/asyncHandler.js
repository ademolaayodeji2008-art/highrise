// Express 4 doesn't forward rejected promises from async route handlers to
// the error middleware — an unhandled rejection would otherwise crash the process.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
