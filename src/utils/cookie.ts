import type { CookieOptions, Request, Response } from "express";

import { env } from "../config/env.js";
import { durationToMs } from "./duration.js";

export const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/v1/auth";

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...refreshCookieOptions(),
    maxAge: durationToMs(env.REFRESH_TOKEN_TTL),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
}

export function readRefreshCookie(req: Request): string | undefined {
  const value = req.cookies[REFRESH_COOKIE_NAME] as unknown;

  return typeof value === "string" && value.length > 0 ? value : undefined;
}
