import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { ApiError } from "../utils/ApiError.js";

type RequestSource = "body" | "query" | "params";

export function validate(
  schema: ZodType,
  source: RequestSource = "body",
): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => issue.message)
        .join(", ");
      next(new ApiError(400, message));
      return;
    }

    if (source === "body") {
      req.body = result.data;
    } else if (source === "params") {
      req.params = result.data as typeof req.params;
    } else {
      Object.defineProperty(req, "query", {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    next();
  };
}
