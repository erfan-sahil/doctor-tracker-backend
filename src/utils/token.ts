import { createHash } from "node:crypto";

import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { durationToMs } from "./duration.js";

type AccessTokenPayload = {
  sub: string;
  type: "access";
};

type RefreshTokenPayload = {
  sub: string;
  sid: string;
  type: "refresh";
};

function expiresInSeconds(ttl: string): number {
  return Math.floor(durationToMs(ttl) / 1000);
}

function readPayload(token: string, secret: string): jwt.JwtPayload {
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });

  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }

  return decoded;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function signAccessToken(userId: string): string {
  const payload: AccessTokenPayload = { sub: userId, type: "access" };

  return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
    algorithm: "HS256",
    expiresIn: expiresInSeconds(env.ACCESS_TOKEN_TTL),
  });
}

export function signRefreshToken(userId: string, sessionId: string): string {
  const payload: RefreshTokenPayload = {
    sub: userId,
    sid: sessionId,
    type: "refresh",
  };

  return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, {
    algorithm: "HS256",
    expiresIn: expiresInSeconds(env.REFRESH_TOKEN_TTL),
  });
}

export function verifyAccessToken(token: string): { sub: string } {
  const decoded = readPayload(token, env.ACCESS_TOKEN_SECRET);

  if (decoded.type !== "access" || typeof decoded.sub !== "string") {
    throw new Error("Invalid access token");
  }

  return { sub: decoded.sub };
}

export function verifyRefreshToken(token: string): { sub: string; sid: string } {
  const decoded = readPayload(token, env.REFRESH_TOKEN_SECRET);

  if (
    decoded.type !== "refresh" ||
    typeof decoded.sub !== "string" ||
    typeof decoded.sid !== "string"
  ) {
    throw new Error("Invalid refresh token");
  }

  return { sub: decoded.sub, sid: decoded.sid };
}
