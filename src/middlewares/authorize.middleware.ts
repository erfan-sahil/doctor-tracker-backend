import type { RequestHandler } from "express";

import type { UserRole } from "../modules/user/user.model.js";
import { ApiError } from "../utils/ApiError.js";

export function authorize(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new ApiError(401, "Authentication required"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, "Forbidden"));
      return;
    }

    next();
  };
}
