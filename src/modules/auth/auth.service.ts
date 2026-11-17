import mongoose from "mongoose";

import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";
import { durationToMs } from "../../utils/duration.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/token.js";
import { toPublicUser, type PublicUser } from "../user/user.mapper.js";
import { User } from "../user/user.model.js";
import type { LoginInput } from "./auth.schema.js";
import { RefreshSession } from "./refreshSession.model.js";

const invalidPasswordHash = hashPassword("invalid-credential-placeholder");

type IssuedSession = {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
};

async function createRefreshSession(userId: string): Promise<string> {
  const sessionId = new mongoose.Types.ObjectId();
  const refreshToken = signRefreshToken(userId, sessionId.toString());
  const expiresAt = new Date(Date.now() + durationToMs(env.REFRESH_TOKEN_TTL));

  await RefreshSession.create({
    _id: sessionId,
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt,
  });

  return refreshToken;
}

export async function loginUser(input: LoginInput): Promise<IssuedSession> {
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  const passwordHash = user?.passwordHash ?? (await invalidPasswordHash);
  const passwordMatches = await verifyPassword(input.password, passwordHash);

  if (!user || !user.passwordHash || !passwordMatches) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (!user.isActive) {
    throw new ApiError(403, "Account is inactive");
  }

  const refreshToken = await createRefreshSession(user.id);

  return {
    accessToken: signAccessToken(user.id),
    refreshToken,
    user: toPublicUser(user),
  };
}

export async function rotateRefreshToken(
  refreshToken: string | undefined,
): Promise<IssuedSession> {
  if (!refreshToken) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  let payload: { sub: string; sid: string };

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const existing = await RefreshSession.findOne({ tokenHash: hashToken(refreshToken) });

  if (
    !existing ||
    existing.userId.toString() !== payload.sub ||
    existing.id !== payload.sid
  ) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const now = new Date();

  if (existing.revokedAt) {
    await RefreshSession.updateMany(
      { userId: existing.userId, revokedAt: null },
      { $set: { revokedAt: now } },
    );
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  if (existing.expiresAt.getTime() <= now.getTime()) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(existing.userId);

  if (!user || !user.isActive) {
    await RefreshSession.updateOne(
      { _id: existing._id, revokedAt: null },
      { $set: { revokedAt: now } },
    );
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const newSessionId = new mongoose.Types.ObjectId();
  const nextRefreshToken = signRefreshToken(user.id, newSessionId.toString());
  const claimed = await RefreshSession.findOneAndUpdate(
    { _id: existing._id, revokedAt: null },
    { $set: { revokedAt: now, replacedBySessionId: newSessionId } },
  );

  if (!claimed) {
    await RefreshSession.updateMany(
      { userId: existing.userId, revokedAt: null },
      { $set: { revokedAt: now } },
    );
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  await RefreshSession.create({
    _id: newSessionId,
    userId: user._id,
    tokenHash: hashToken(nextRefreshToken),
    expiresAt: new Date(Date.now() + durationToMs(env.REFRESH_TOKEN_TTL)),
  });

  return {
    accessToken: signAccessToken(user.id),
    refreshToken: nextRefreshToken,
    user: toPublicUser(user),
  };
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);

  if (!user || !user.isActive) {
    throw new ApiError(401, "Authentication required");
  }

  return toPublicUser(user);
}

export async function revokeRefreshToken(
  refreshToken: string | undefined,
): Promise<void> {
  if (!refreshToken) {
    return;
  }

  try {
    verifyRefreshToken(refreshToken);
  } catch {
    return;
  }

  await RefreshSession.updateOne(
    { tokenHash: hashToken(refreshToken), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}
