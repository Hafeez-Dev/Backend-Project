const asynHandler = (requestHandler) => (req, res, next) => {
  Promise.resolve(requestHandler(req, res, next)).catch(next);
};

export { asynHandler };


// High order function that takes a request handler and returns a new function that wraps the original handler in a try-catch block. If an error occurs, it passes the error to the next middleware for centralized error handling.
// const asynHandler = () => {};
// const asynHandler = (fn) => () => {};
// const asynHandler = (fn) => async () => {};


// wrapping the request handler in a try-catch block to catch any errors that may occur during its execution. If an error occurs, it sends a JSON response with the error message and status code.
// const asynHandler = (fn) => async (req, res, next) => {
//   try {
//         await fn(req, res, next);
//   } catch (error) {
//     res.status(error.code || 500).json({
//         success: false,
//         message: error.message,
//     });
//   }
// };
