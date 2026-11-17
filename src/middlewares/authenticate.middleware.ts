import type { Request } from "express";

import { User } from "../modules/user/user.model.js";
import type { AuthUser } from "../types/auth.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyAccessToken } from "../utils/token.js";

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication required");
  }

  const token = header.slice("Bearer ".length).trim();

  if (!token) {
    throw new ApiError(401, "Authentication required");
  }

  let userId: string;

  try {
    userId = verifyAccessToken(token).sub;
  } catch {
    throw new ApiError(401, "Invalid or expired access token");
  }

  const user = await User.findById(userId);

  if (!user || !user.isActive) {
    throw new ApiError(401, "Authentication required");
  }

  const authUser: AuthUser = {
    id: user.id,
    role: user.role,
  };

  if (user.doctorId) {
    authUser.doctorId = user.doctorId.toString();
  }

  req.user = authUser;
  next();
});

export function requireUser(req: Request): AuthUser {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  return req.user;
}
