import type { ErrorRequestHandler } from "express";

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

function isInvalidJson(err: unknown): err is SyntaxError {
  return (
    err instanceof SyntaxError &&
    "status" in err &&
    (err as { status?: number }).status === 400
  );
}

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  let statusCode = 500;
  let message = "Internal server error";

  if (isInvalidJson(err)) {
    statusCode = 400;
    message = "Invalid JSON body";
  } else if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message =
      err.isOperational || env.NODE_ENV !== "production"
        ? err.message
        : "Internal server error";
  } else if (env.NODE_ENV !== "production" && err instanceof Error) {
    message = err.message;
  }

  if (statusCode >= 500) {
    logger.error({ err }, "Request failed");
  } else {
    logger.warn({ err }, message);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};
