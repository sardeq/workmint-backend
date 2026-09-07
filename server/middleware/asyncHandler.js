
// Express does not catch an error thrown inside an async route handler. The
// promise rejects, nothing is listening, and the request hangs until it times
// out, an unhandled rejection can stop the whole process.

export default function asyncHandler(handler) {
  return (req, res, next) => handler(req, res, next).catch(next);
}
